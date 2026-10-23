import { eq } from 'drizzle-orm';
import { cleanDisplayName } from '../domain/signin';
import { getDb } from './db';
import { emailInvites, teamMembers, users } from './db/schema';

export async function upsertGoogleUser(input: {
	email: string;
	name: string;
	image: string | null;
}) {
	const db = getDb();
	const email = input.email.toLowerCase();
	const name = cleanDisplayName(input.name, email);
	const [existing] = await db.select().from(users).where(eq(users.email, email)).limit(1);
	if (existing) {
		const [updated] = await db
			.update(users)
			.set({ name, image: input.image })
			.where(eq(users.id, existing.id))
			.returning();
		return updated;
	}
	const [created] = await db
		.insert(users)
		.values({
			id: crypto.randomUUID(),
			email,
			name,
			image: input.image,
			createdAt: new Date()
		})
		.returning();
	return created;
}

export async function acceptEmailInvites(userId: string, email: string) {
	const db = getDb();
	const pending = await db
		.select()
		.from(emailInvites)
		.where(eq(emailInvites.email, email.toLowerCase()));
	if (pending.length === 0) return;
	await db
		.insert(teamMembers)
		.values(
			pending.map((invite) => ({
				teamId: invite.teamId,
				userId,
				role: 'member' as const,
				joinedAt: new Date()
			}))
		)
		.onConflictDoNothing();
	await db.delete(emailInvites).where(eq(emailInvites.email, email.toLowerCase()));
}
