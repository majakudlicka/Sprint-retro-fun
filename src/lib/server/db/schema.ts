import {
	boolean,
	date,
	index,
	integer,
	pgEnum,
	pgTable,
	primaryKey,
	text,
	timestamp,
	uniqueIndex,
	uuid
} from 'drizzle-orm/pg-core';

export const memberRole = pgEnum('member_role', ['owner', 'member']);
export const retroFormat = pgEnum('retro_format', [
	'start-stop-continue',
	'mad-sad-glad',
	'four-ls',
	'went-well'
]);
export const retroPhase = pgEnum('retro_phase', [
	'write',
	'group',
	'vote',
	'discuss',
	'actions',
	'closed'
]);
export const voteTarget = pgEnum('vote_target', ['card', 'group']);
export const actionStatus = pgEnum('action_status', ['open', 'done']);

export const users = pgTable('users', {
	id: uuid('id').primaryKey(),
	email: text('email').notNull().unique(),
	name: text('name').notNull(),
	image: text('image'),
	createdAt: timestamp('created_at', { withTimezone: true }).notNull()
});

export const teams = pgTable('teams', {
	id: uuid('id').primaryKey(),
	name: text('name').notNull(),
	createdBy: uuid('created_by')
		.notNull()
		.references(() => users.id),
	createdAt: timestamp('created_at', { withTimezone: true }).notNull()
});

export const teamMembers = pgTable(
	'team_members',
	{
		teamId: uuid('team_id')
			.notNull()
			.references(() => teams.id, { onDelete: 'cascade' }),
		userId: uuid('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		role: memberRole('role').notNull(),
		joinedAt: timestamp('joined_at', { withTimezone: true }).notNull()
	},
	(table) => [
		primaryKey({ columns: [table.teamId, table.userId] }),
		index('team_members_user_idx').on(table.userId)
	]
);

export const invites = pgTable('invites', {
	id: uuid('id').primaryKey(),
	teamId: uuid('team_id')
		.notNull()
		.references(() => teams.id, { onDelete: 'cascade' }),
	tokenHash: text('token_hash').notNull().unique(),
	createdBy: uuid('created_by')
		.notNull()
		.references(() => users.id),
	expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
	createdAt: timestamp('created_at', { withTimezone: true }).notNull()
});

export const emailInvites = pgTable(
	'email_invites',
	{
		id: uuid('id').primaryKey(),
		teamId: uuid('team_id')
			.notNull()
			.references(() => teams.id, { onDelete: 'cascade' }),
		email: text('email').notNull(),
		invitedBy: uuid('invited_by')
			.notNull()
			.references(() => users.id),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull()
	},
	(table) => [uniqueIndex('email_invites_team_email_idx').on(table.teamId, table.email)]
);

export const retros = pgTable(
	'retros',
	{
		id: uuid('id').primaryKey(),
		teamId: uuid('team_id')
			.notNull()
			.references(() => teams.id, { onDelete: 'cascade' }),
		title: text('title').notNull(),
		format: retroFormat('format').notNull(),
		phase: retroPhase('phase').notNull(),
		voteBudget: integer('vote_budget').notNull(),
		anonymous: boolean('anonymous').notNull(),
		facilitatorId: uuid('facilitator_id')
			.notNull()
			.references(() => users.id),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull()
	},
	(table) => [index('retros_team_idx').on(table.teamId)]
);

export const groups = pgTable(
	'groups',
	{
		id: uuid('id').primaryKey(),
		retroId: uuid('retro_id')
			.notNull()
			.references(() => retros.id, { onDelete: 'cascade' }),
		columnKey: text('column_key').notNull(),
		name: text('name').notNull(),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull()
	},
	(table) => [index('groups_retro_idx').on(table.retroId)]
);

export const cards = pgTable(
	'cards',
	{
		id: uuid('id').primaryKey(),
		retroId: uuid('retro_id')
			.notNull()
			.references(() => retros.id, { onDelete: 'cascade' }),
		columnKey: text('column_key').notNull(),
		text: text('text').notNull(),
		authorId: uuid('author_id')
			.notNull()
			.references(() => users.id),
		groupId: uuid('group_id').references(() => groups.id, { onDelete: 'set null' }),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull()
	},
	(table) => [index('cards_retro_idx').on(table.retroId)]
);

export const votes = pgTable(
	'votes',
	{
		id: uuid('id').primaryKey(),
		retroId: uuid('retro_id')
			.notNull()
			.references(() => retros.id, { onDelete: 'cascade' }),
		userId: uuid('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		targetType: voteTarget('target_type').notNull(),
		targetId: uuid('target_id').notNull(),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull()
	},
	(table) => [index('votes_retro_user_idx').on(table.retroId, table.userId)]
);

export const actions = pgTable(
	'actions',
	{
		id: uuid('id').primaryKey(),
		teamId: uuid('team_id')
			.notNull()
			.references(() => teams.id, { onDelete: 'cascade' }),
		retroId: uuid('retro_id')
			.notNull()
			.references(() => retros.id, { onDelete: 'cascade' }),
		text: text('text').notNull(),
		ownerId: uuid('owner_id').references(() => users.id, { onDelete: 'set null' }),
		dueDate: date('due_date'),
		cardId: uuid('card_id').references(() => cards.id, { onDelete: 'set null' }),
		groupId: uuid('group_id').references(() => groups.id, { onDelete: 'set null' }),
		status: actionStatus('status').notNull(),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull()
	},
	(table) => [index('actions_team_status_idx').on(table.teamId, table.status)]
);
