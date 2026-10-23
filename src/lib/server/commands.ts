import { and, eq, inArray, sql } from 'drizzle-orm';
import { z } from 'zod';
import { authorizeCommand } from '../domain/authz';
import { isColumnKey } from '../domain/formats';
import { nextPhase } from '../domain/phases';
import { CommandSchema, type Command } from '../domain/schemas';
import type { CommandType } from '../domain/types';
import { evaluateVote } from '../domain/votes';
import { getDb } from './db';
import { actions, cards, groups, retros, teamMembers, votes } from './db/schema';
import { HttpError } from './http';
import { publish } from './hub';
import { assertRate } from './limiter';
import { buildRetroView } from './retro-view';

const MAX_CARDS = 400;

export async function executeCommand(userId: string, retroId: string, body: unknown) {
	if (!z.uuid().safeParse(retroId).success || !z.uuid().safeParse(userId).success) {
		throw new HttpError(404, 'Not found');
	}
	const parsed = CommandSchema.safeParse(body);
	if (!parsed.success) throw new HttpError(400, 'That input is not valid');
	assertRate(`cmd:${userId}`);

	const access = await loadAccess(retroId, userId);
	const command = parsed.data;
	const isAuthor = await authorOf(command, access.retro.id, userId);
	const decision = authorizeCommand({
		isMember: true,
		isFacilitator: access.retro.facilitatorId === userId,
		phase: access.retro.phase,
		command: command.type,
		isAuthor
	});
	if (!decision.ok) throw new HttpError(decision.status, decision.message);

	await applyCommand(userId, access, command);
	publish(access.retro.id);
	const view = await buildRetroView(access.retro.id, userId);
	if (!view) throw new HttpError(404, 'Not found');
	return view;
}

async function loadAccess(retroId: string, userId: string) {
	const db = getDb();
	const [retro] = await db.select().from(retros).where(eq(retros.id, retroId)).limit(1);
	if (!retro) throw new HttpError(404, 'Not found');
	const [member] = await db
		.select({ userId: teamMembers.userId })
		.from(teamMembers)
		.where(and(eq(teamMembers.teamId, retro.teamId), eq(teamMembers.userId, userId)))
		.limit(1);
	if (!member) throw new HttpError(404, 'Not found');
	return { retro };
}

async function authorOf(command: Command, retroId: string, userId: string) {
	if (command.type !== 'edit-card' && command.type !== 'delete-card') return false;
	const card = await findCard(retroId, command.cardId);
	return card.authorId === userId;
}

async function findCard(retroId: string, cardId: string) {
	const [card] = await getDb()
		.select()
		.from(cards)
		.where(and(eq(cards.id, cardId), eq(cards.retroId, retroId)))
		.limit(1);
	if (!card) throw new HttpError(404, 'Not found');
	return card;
}

async function findGroup(retroId: string, groupId: string) {
	const [group] = await getDb()
		.select()
		.from(groups)
		.where(and(eq(groups.id, groupId), eq(groups.retroId, retroId)))
		.limit(1);
	if (!group) throw new HttpError(404, 'Not found');
	return group;
}

async function applyCommand(userId: string, access: Awaited<ReturnType<typeof loadAccess>>, command: Command) {
	const db = getDb();
	const retro = access.retro;

	switch (command.type) {
		case 'add-card': {
			if (!isColumnKey(retro.format, command.columnKey)) {
				throw new HttpError(400, 'That column is not part of this retro');
			}
			const existing = await db.select({ id: cards.id }).from(cards).where(eq(cards.retroId, retro.id));
			if (existing.length >= MAX_CARDS) throw new HttpError(400, 'This retro is full of notes');
			await db.insert(cards).values({
				id: crypto.randomUUID(),
				retroId: retro.id,
				columnKey: command.columnKey,
				text: command.text,
				authorId: userId,
				groupId: null,
				createdAt: new Date()
			});
			return;
		}
		case 'edit-card': {
			await findCard(retro.id, command.cardId);
			await db.update(cards).set({ text: command.text }).where(eq(cards.id, command.cardId));
			return;
		}
		case 'delete-card': {
			const card = await findCard(retro.id, command.cardId);
			await db.transaction(async (tx) => {
				await tx.delete(votes).where(and(eq(votes.targetType, 'card'), eq(votes.targetId, card.id)));
				await tx.delete(cards).where(eq(cards.id, card.id));
				await dissolveIfSmall(tx, card.groupId);
			});
			return;
		}
		case 'group-cards': {
			const source = await findCard(retro.id, command.sourceCardId);
			const target = await findCard(retro.id, command.targetCardId);
			if (source.id === target.id) throw new HttpError(400, 'Drop a note onto a different note');
			if (source.columnKey !== target.columnKey) {
				throw new HttpError(400, 'Notes from different columns stay apart');
			}
			if (source.groupId && source.groupId === target.groupId) return;
			await db.transaction(async (tx) => {
				if (target.groupId) {
					await tx.update(cards).set({ groupId: target.groupId }).where(eq(cards.id, source.id));
					await dissolveIfSmall(tx, source.groupId);
				} else if (source.groupId) {
					await tx.update(cards).set({ groupId: source.groupId }).where(eq(cards.id, target.id));
				} else {
					const groupId = crypto.randomUUID();
					await tx.insert(groups).values({
						id: groupId,
						retroId: retro.id,
						columnKey: source.columnKey,
						name: '',
						createdAt: new Date()
					});
					await tx
						.update(cards)
						.set({ groupId })
						.where(inArray(cards.id, [source.id, target.id]));
				}
			});
			return;
		}
		case 'move-to-group': {
			const card = await findCard(retro.id, command.cardId);
			const group = await findGroup(retro.id, command.groupId);
			if (card.columnKey !== group.columnKey) {
				throw new HttpError(400, 'Notes from different columns stay apart');
			}
			if (card.groupId === group.id) return;
			await db.transaction(async (tx) => {
				const previous = card.groupId;
				await tx.update(cards).set({ groupId: group.id }).where(eq(cards.id, card.id));
				await dissolveIfSmall(tx, previous);
			});
			return;
		}
		case 'rename-group': {
			await findGroup(retro.id, command.groupId);
			await db.update(groups).set({ name: command.name }).where(eq(groups.id, command.groupId));
			return;
		}
		case 'ungroup-card': {
			const card = await findCard(retro.id, command.cardId);
			if (!card.groupId) return;
			await db.transaction(async (tx) => {
				const previous = card.groupId;
				await tx.update(cards).set({ groupId: null }).where(eq(cards.id, card.id));
				await dissolveIfSmall(tx, previous);
			});
			return;
		}
		case 'add-vote':
		case 'remove-vote': {
			await assertVotable(retro.id, command.targetType, command.targetId);
			await db.transaction(async (tx) => {
				await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${userId}), hashtext(${retro.id}))`);
				const mine = await tx
					.select({ id: votes.id })
					.from(votes)
					.where(and(eq(votes.retroId, retro.id), eq(votes.userId, userId)));
				const decision = evaluateVote({
					budget: retro.voteBudget,
					existingCount: mine.length,
					action: command.type === 'add-vote' ? 'add' : 'remove'
				});
				if (!decision.ok) {
					throw new HttpError(
						400,
						decision.reason === 'vote-budget-exhausted'
							? 'You have used all of your votes'
							: 'You have no vote on that item'
					);
				}
				if (command.type === 'add-vote') {
					await tx.insert(votes).values({
						id: crypto.randomUUID(),
						retroId: retro.id,
						userId,
						targetType: command.targetType,
						targetId: command.targetId,
						createdAt: new Date()
					});
					return;
				}
				const [existing] = await tx
					.select({ id: votes.id })
					.from(votes)
					.where(
						and(
							eq(votes.retroId, retro.id),
							eq(votes.userId, userId),
							eq(votes.targetType, command.targetType),
							eq(votes.targetId, command.targetId)
						)
					)
					.limit(1);
				if (!existing) throw new HttpError(400, 'You have no vote on that item');
				await tx.delete(votes).where(eq(votes.id, existing.id));
			});
			return;
		}
		case 'advance-phase': {
			const next = nextPhase(retro.phase);
			if (!next) throw new HttpError(400, 'This retro is already closed');
			await db.update(retros).set({ phase: next }).where(eq(retros.id, retro.id));
			return;
		}
		case 'add-action': {
			if (command.ownerId) {
				const [owner] = await db
					.select({ userId: teamMembers.userId })
					.from(teamMembers)
					.where(and(eq(teamMembers.teamId, retro.teamId), eq(teamMembers.userId, command.ownerId)))
					.limit(1);
				if (!owner) throw new HttpError(400, 'The owner needs to be on this team');
			}
			if (command.cardId) await findCard(retro.id, command.cardId);
			if (command.groupId) await findGroup(retro.id, command.groupId);
			await db.insert(actions).values({
				id: crypto.randomUUID(),
				teamId: retro.teamId,
				retroId: retro.id,
				text: command.text,
				ownerId: command.ownerId ?? null,
				dueDate: command.dueDate ?? null,
				cardId: command.cardId ?? null,
				groupId: command.groupId ?? null,
				status: 'open',
				createdAt: new Date()
			});
			return;
		}
		case 'set-action-status': {
			const [action] = await db
				.select({ id: actions.id })
				.from(actions)
				.where(and(eq(actions.id, command.actionId), eq(actions.teamId, retro.teamId)))
				.limit(1);
			if (!action) throw new HttpError(404, 'Not found');
			await db.update(actions).set({ status: command.status }).where(eq(actions.id, action.id));
			return;
		}
		default: {
			const _never: never = command;
			throw new HttpError(400, 'That input is not valid');
		}
	}
}

async function assertVotable(retroId: string, targetType: 'card' | 'group', targetId: string) {
	if (targetType === 'card') {
		const card = await findCard(retroId, targetId);
		if (card.groupId) throw new HttpError(400, 'Vote on the group instead of a note inside it');
		return;
	}
	await findGroup(retroId, targetId);
}

type Tx = Parameters<Parameters<ReturnType<typeof getDb>['transaction']>[0]>[0];

async function dissolveIfSmall(tx: Tx, groupId: string | null) {
	if (!groupId) return;
	const remaining = await tx.select({ id: cards.id }).from(cards).where(eq(cards.groupId, groupId));
	if (remaining.length >= 2) return;
	if (remaining[0]) {
		await tx.update(cards).set({ groupId: null }).where(eq(cards.id, remaining[0].id));
	}
	await tx.delete(votes).where(and(eq(votes.targetType, 'group'), eq(votes.targetId, groupId)));
	await tx.delete(groups).where(eq(groups.id, groupId));
}

export type { CommandType };
