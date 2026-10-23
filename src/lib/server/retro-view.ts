import { and, asc, eq, inArray } from 'drizzle-orm';
import { z } from 'zod';
import { assembleRetroView } from '../domain/assemble';
import type { ActionInput, CardInput, GroupInput, Phase, VoteInput } from '../domain/types';
import { getDb } from './db';
import { actions, cards, groups, retros, teamMembers, teams, users, votes } from './db/schema';

export async function buildRetroView(retroId: string, viewerId: string) {
	if (!z.uuid().safeParse(retroId).success || !z.uuid().safeParse(viewerId).success) return null;
	const db = getDb();
	const [row] = await db
		.select({
			retro: retros,
			teamName: teams.name,
			facilitatorName: users.name
		})
		.from(retros)
		.innerJoin(teams, eq(teams.id, retros.teamId))
		.innerJoin(users, eq(users.id, retros.facilitatorId))
		.where(eq(retros.id, retroId))
		.limit(1);
	if (!row) return null;

	const memberRows = await db
		.select({ id: users.id, name: users.name })
		.from(teamMembers)
		.innerJoin(users, eq(users.id, teamMembers.userId))
		.where(eq(teamMembers.teamId, row.retro.teamId))
		.orderBy(asc(users.name));
	if (!memberRows.some((member) => member.id === viewerId)) return null;

	const cardRows = await db
		.select({
			id: cards.id,
			columnKey: cards.columnKey,
			text: cards.text,
			authorId: cards.authorId,
			authorName: users.name,
			groupId: cards.groupId,
			createdAt: cards.createdAt
		})
		.from(cards)
		.innerJoin(users, eq(users.id, cards.authorId))
		.where(eq(cards.retroId, retroId));

	const groupRows = await db.select().from(groups).where(eq(groups.retroId, retroId));
	const voteRows = await db.select().from(votes).where(eq(votes.retroId, retroId));

	const actionRows = await db
		.select({
			action: actions,
			retroTitle: retros.title,
			retroCreatedAt: retros.createdAt,
			ownerName: users.name
		})
		.from(actions)
		.innerJoin(retros, eq(retros.id, actions.retroId))
		.leftJoin(users, eq(users.id, actions.ownerId))
		.where(eq(actions.teamId, row.retro.teamId));

	const linkCardIds = [...new Set(actionRows.map((item) => item.action.cardId).filter((id): id is string => Boolean(id)))];
	const linkGroupIds = [...new Set(actionRows.map((item) => item.action.groupId).filter((id): id is string => Boolean(id)))];

	const linkedCards = linkCardIds.length
		? await db
				.select({
					id: cards.id,
					text: cards.text,
					authorId: cards.authorId,
					phase: retros.phase
				})
				.from(cards)
				.innerJoin(retros, eq(retros.id, cards.retroId))
				.where(inArray(cards.id, linkCardIds))
		: [];
	const linkedGroups = linkGroupIds.length
		? await db.select({ id: groups.id, name: groups.name }).from(groups).where(inArray(groups.id, linkGroupIds))
		: [];

	const cardMap = new Map(linkedCards.map((card) => [card.id, card]));
	const groupMap = new Map(linkedGroups.map((group) => [group.id, group]));

	const toAction = (item: (typeof actionRows)[number]): ActionInput => ({
		id: item.action.id,
		text: item.action.text,
		status: item.action.status,
		dueDate: item.action.dueDate,
		ownerId: item.action.ownerId,
		ownerName: item.ownerName,
		linkLabel: linkLabel(item.action.cardId, item.action.groupId, viewerId, cardMap, groupMap),
		retroId: item.action.retroId,
		retroTitle: item.retroTitle,
		createdAt: item.action.createdAt.toISOString()
	});

	const currentActions = actionRows
		.filter((item) => item.action.retroId === retroId)
		.sort((a, b) => a.action.createdAt.getTime() - b.action.createdAt.getTime())
		.map(toAction);
	const previousActions = actionRows
		.filter(
			(item) =>
				item.action.status === 'open' &&
				item.action.retroId !== retroId &&
				item.retroCreatedAt.getTime() < row.retro.createdAt.getTime()
		)
		.sort((a, b) => b.action.createdAt.getTime() - a.action.createdAt.getTime())
		.map(toAction);

	const cardInputs: CardInput[] = cardRows.map((card) => ({
		id: card.id,
		columnKey: card.columnKey,
		text: card.text,
		authorId: card.authorId,
		authorName: card.authorName,
		groupId: card.groupId,
		createdAt: card.createdAt.toISOString()
	}));
	const groupInputs: GroupInput[] = groupRows.map((group) => ({
		id: group.id,
		columnKey: group.columnKey,
		name: group.name,
		createdAt: group.createdAt.toISOString()
	}));
	const voteInputs: VoteInput[] = voteRows.map((vote) => ({
		userId: vote.userId,
		targetType: vote.targetType,
		targetId: vote.targetId
	}));

	return assembleRetroView({
		viewerId,
		retro: {
			id: row.retro.id,
			title: row.retro.title,
			teamId: row.retro.teamId,
			teamName: row.teamName,
			format: row.retro.format,
			phase: row.retro.phase,
			voteBudget: row.retro.voteBudget,
			anonymous: row.retro.anonymous,
			facilitatorId: row.retro.facilitatorId,
			facilitatorName: row.facilitatorName
		},
		members: memberRows,
		cards: cardInputs,
		groups: groupInputs,
		votes: voteInputs,
		actions: currentActions,
		previousActions
	});
}

function linkLabel(
	cardId: string | null,
	groupId: string | null,
	viewerId: string,
	cardMap: Map<string, { text: string; authorId: string; phase: Phase }>,
	groupMap: Map<string, { name: string }>
): string | null {
	if (groupId) {
		const group = groupMap.get(groupId);
		if (!group) return null;
		return group.name.trim() || 'Untitled group';
	}
	if (cardId) {
		const card = cardMap.get(cardId);
		if (!card) return null;
		if (card.phase === 'write' && card.authorId !== viewerId) return null;
		return card.text;
	}
	return null;
}

export async function retroMembership(retroId: string, userId: string) {
	const db = getDb();
	const [row] = await db
		.select({ teamId: retros.teamId, phase: retros.phase, facilitatorId: retros.facilitatorId, format: retros.format, voteBudget: retros.voteBudget })
		.from(retros)
		.where(eq(retros.id, retroId))
		.limit(1);
	if (!row) return null;
	const [member] = await db
		.select({ userId: teamMembers.userId })
		.from(teamMembers)
		.where(and(eq(teamMembers.teamId, row.teamId), eq(teamMembers.userId, userId)))
		.limit(1);
	if (!member) return null;
	return row;
}
