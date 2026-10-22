import { and, desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import type { FormatId } from '../domain/types';
import { getDb } from './db';
import { actions, emailInvites, invites, retros, teamMembers, teams, users } from './db/schema';
import { HttpError } from './http';
import { assertRate } from './limiter';
import { hashToken, newInviteToken } from './tokens';

const INVITE_TTL_MS = 14 * 24 * 60 * 60 * 1000;

export async function listTeams(userId: string) {
	const rows = await getDb()
		.select({
			id: teams.id,
			name: teams.name,
			role: teamMembers.role,
			createdAt: teams.createdAt
		})
		.from(teamMembers)
		.innerJoin(teams, eq(teams.id, teamMembers.teamId))
		.where(eq(teamMembers.userId, userId))
		.orderBy(desc(teams.createdAt));
	return rows.map((row) => ({
		id: row.id,
		name: row.name,
		role: row.role,
		createdAt: row.createdAt.toISOString()
	}));
}

export async function createTeam(userId: string, name: string) {
	assertRate(`team:${userId}`, 20, 60_000);
	const db = getDb();
	const teamId = crypto.randomUUID();
	await db.transaction(async (tx) => {
		await tx.insert(teams).values({
			id: teamId,
			name,
			createdBy: userId,
			createdAt: new Date()
		});
		await tx.insert(teamMembers).values({
			teamId,
			userId,
			role: 'owner',
			joinedAt: new Date()
		});
	});
	return { id: teamId };
}

export async function getTeamPage(teamId: string, userId: string) {
	if (!z.uuid().safeParse(teamId).success) return null;
	const db = getDb();
	const [team] = await db.select().from(teams).where(eq(teams.id, teamId)).limit(1);
	if (!team) return null;
	const members = await db
		.select({ id: users.id, name: users.name, role: teamMembers.role, joinedAt: teamMembers.joinedAt })
		.from(teamMembers)
		.innerJoin(users, eq(users.id, teamMembers.userId))
		.where(eq(teamMembers.teamId, teamId))
		.orderBy(users.name);
	const me = members.find((member) => member.id === userId);
	if (!me) return null;

	const retroRows = await db
		.select({
			id: retros.id,
			title: retros.title,
			phase: retros.phase,
			format: retros.format,
			anonymous: retros.anonymous,
			createdAt: retros.createdAt,
			facilitatorName: users.name
		})
		.from(retros)
		.innerJoin(users, eq(users.id, retros.facilitatorId))
		.where(eq(retros.teamId, teamId))
		.orderBy(desc(retros.createdAt));

	const openRows = await db
		.select({
			id: actions.id,
			text: actions.text,
			dueDate: actions.dueDate,
			retroId: actions.retroId,
			retroTitle: retros.title,
			ownerName: users.name,
			createdAt: actions.createdAt
		})
		.from(actions)
		.innerJoin(retros, eq(retros.id, actions.retroId))
		.leftJoin(users, eq(users.id, actions.ownerId))
		.where(and(eq(actions.teamId, teamId), eq(actions.status, 'open')))
		.orderBy(desc(actions.createdAt));

	const inviteRows = await db
		.select({ id: invites.id, createdAt: invites.createdAt, expiresAt: invites.expiresAt })
		.from(invites)
		.where(eq(invites.teamId, teamId))
		.orderBy(desc(invites.createdAt));

	return {
		id: team.id,
		name: team.name,
		role: me.role,
		members: members.map((member) => ({
			id: member.id,
			name: member.name,
			role: member.role
		})),
		retros: retroRows.map((retro) => ({
			...retro,
			createdAt: retro.createdAt.toISOString()
		})),
		openActions: openRows.map((action) => ({
			id: action.id,
			text: action.text,
			dueDate: action.dueDate,
			retroId: action.retroId,
			retroTitle: action.retroTitle,
			ownerName: action.ownerName,
			createdAt: action.createdAt.toISOString()
		})),
		invites: inviteRows
			.filter((invite) => invite.expiresAt.getTime() > Date.now())
			.map((invite) => ({
				id: invite.id,
				createdAt: invite.createdAt.toISOString(),
				expiresAt: invite.expiresAt.toISOString()
			}))
	};
}

async function requireMember(teamId: string, userId: string) {
	if (!z.uuid().safeParse(teamId).success) throw new HttpError(404, 'Not found');
	const [member] = await getDb()
		.select({ role: teamMembers.role })
		.from(teamMembers)
		.where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, userId)))
		.limit(1);
	if (!member) throw new HttpError(404, 'Not found');
	return member;
}

export async function createRetroForTeam(
	userId: string,
	teamId: string,
	input: { title: string; format: FormatId; voteBudget: number; anonymous: boolean }
) {
	await requireMember(teamId, userId);
	assertRate(`retro:${userId}`, 30, 60_000);
	const [retro] = await getDb()
		.insert(retros)
		.values({
			id: crypto.randomUUID(),
			teamId,
			title: input.title,
			format: input.format,
			phase: 'write',
			voteBudget: input.voteBudget,
			anonymous: input.anonymous,
			facilitatorId: userId,
			createdAt: new Date()
		})
		.returning({ id: retros.id });
	return retro;
}

export async function createInviteLink(userId: string, teamId: string) {
	await requireMember(teamId, userId);
	assertRate(`invite:${userId}`, 20, 60_000);
	const token = newInviteToken();
	await getDb().insert(invites).values({
		id: crypto.randomUUID(),
		teamId,
		tokenHash: hashToken(token),
		createdBy: userId,
		expiresAt: new Date(Date.now() + INVITE_TTL_MS),
		createdAt: new Date()
	});
	return token;
}

export async function revokeInvite(userId: string, teamId: string, inviteId: string) {
	await requireMember(teamId, userId);
	if (!z.uuid().safeParse(inviteId).success) throw new HttpError(404, 'Not found');
	await getDb().delete(invites).where(and(eq(invites.id, inviteId), eq(invites.teamId, teamId)));
}

export async function inviteByEmail(userId: string, teamId: string, email: string) {
	await requireMember(teamId, userId);
	assertRate(`invite:${userId}`, 20, 60_000);
	const db = getDb();
	const [existingUser] = await db.select().from(users).where(eq(users.email, email)).limit(1);
	if (existingUser) {
		const [already] = await db
			.select({ userId: teamMembers.userId })
			.from(teamMembers)
			.where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, existingUser.id)))
			.limit(1);
		if (already) return { status: 'already' as const };
		await db.insert(teamMembers).values({
			teamId,
			userId: existingUser.id,
			role: 'member',
			joinedAt: new Date()
		});
		return { status: 'added' as const };
	}
	await db
		.insert(emailInvites)
		.values({
			id: crypto.randomUUID(),
			teamId,
			email,
			invitedBy: userId,
			createdAt: new Date()
		})
		.onConflictDoNothing();
	return { status: 'pending' as const };
}

export async function removeMember(actorId: string, teamId: string, targetUserId: string) {
	const actor = await requireMember(teamId, actorId);
	if (actor.role !== 'owner') throw new HttpError(403, 'Only an owner can remove someone');
	if (actorId === targetUserId) throw new HttpError(400, 'You cannot remove yourself here');
	if (!z.uuid().safeParse(targetUserId).success) throw new HttpError(404, 'Not found');
	const members = await getDb()
		.select({ userId: teamMembers.userId, role: teamMembers.role })
		.from(teamMembers)
		.where(eq(teamMembers.teamId, teamId));
	const target = members.find((member) => member.userId === targetUserId);
	if (!target) throw new HttpError(404, 'Not found');
	if (target.role === 'owner' && members.filter((member) => member.role === 'owner').length <= 1) {
		throw new HttpError(400, 'The team needs to keep an owner');
	}
	await getDb()
		.delete(teamMembers)
		.where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, targetUserId)));
}

export async function setTeamActionStatus(
	userId: string,
	teamId: string,
	actionId: string,
	status: 'open' | 'done'
) {
	await requireMember(teamId, userId);
	if (!z.uuid().safeParse(actionId).success) throw new HttpError(404, 'Not found');
	const [action] = await getDb()
		.select({ id: actions.id })
		.from(actions)
		.where(and(eq(actions.id, actionId), eq(actions.teamId, teamId)))
		.limit(1);
	if (!action) throw new HttpError(404, 'Not found');
	await getDb().update(actions).set({ status }).where(eq(actions.id, action.id));
}

export async function previewInvite(token: string) {
	const [invite] = await getDb()
		.select({ teamId: invites.teamId, expiresAt: invites.expiresAt, teamName: teams.name })
		.from(invites)
		.innerJoin(teams, eq(teams.id, invites.teamId))
		.where(eq(invites.tokenHash, hashToken(token)))
		.limit(1);
	if (!invite || invite.expiresAt.getTime() < Date.now()) return null;
	return { teamId: invite.teamId, teamName: invite.teamName };
}

export async function acceptInvite(token: string, userId: string) {
	const invite = await previewInvite(token);
	if (!invite) throw new HttpError(400, 'This invite is invalid or expired.');
	await getDb()
		.insert(teamMembers)
		.values({
			teamId: invite.teamId,
			userId,
			role: 'member',
			joinedAt: new Date()
		})
		.onConflictDoNothing();
	return invite;
}
