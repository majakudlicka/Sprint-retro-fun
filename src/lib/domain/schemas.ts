import { z } from 'zod';
import { isRealDate } from './dates';
import { FORMAT_IDS } from './types';

const id = z.uuid();

export const teamNameSchema = z.string().trim().min(1).max(80);
export const retroTitleSchema = z.string().trim().min(1).max(120);
export const emailSchema = z
	.string()
	.trim()
	.toLowerCase()
	.pipe(z.email())
	;

export const createRetroSchema = z.object({
	title: retroTitleSchema,
	format: z.enum(FORMAT_IDS),
	voteBudget: z.coerce.number().int().min(3).max(5),
	anonymous: z.boolean()
});

const dueDate = z
	.string()
	.regex(/^\d{4}-\d{2}-\d{2}$/)
	.refine(isRealDate, 'Due date is not a real date')
	.nullable()
	.optional();

export const CommandSchema = z.discriminatedUnion('type', [
	z.object({
		type: z.literal('add-card'),
		columnKey: z.string().trim().min(1).max(40),
		text: z.string().trim().min(1).max(2000)
	}),
	z.object({
		type: z.literal('edit-card'),
		cardId: id,
		text: z.string().trim().min(1).max(2000)
	}),
	z.object({ type: z.literal('delete-card'), cardId: id }),
	z.object({
		type: z.literal('group-cards'),
		sourceCardId: id,
		targetCardId: id
	}),
	z.object({ type: z.literal('move-to-group'), cardId: id, groupId: id }),
	z.object({
		type: z.literal('rename-group'),
		groupId: id,
		name: z.string().trim().max(80)
	}),
	z.object({ type: z.literal('ungroup-card'), cardId: id }),
	z.object({
		type: z.literal('add-vote'),
		targetType: z.enum(['card', 'group']),
		targetId: id
	}),
	z.object({
		type: z.literal('remove-vote'),
		targetType: z.enum(['card', 'group']),
		targetId: id
	}),
	z.object({ type: z.literal('advance-phase') }),
	z
		.object({
			type: z.literal('add-action'),
			text: z.string().trim().min(1).max(2000),
			ownerId: id.nullable().optional(),
			dueDate,
			cardId: id.nullable().optional(),
			groupId: id.nullable().optional()
		})
		.refine((value) => !(value.cardId && value.groupId), 'Link a note or a group, not both'),
	z.object({
		type: z.literal('set-action-status'),
		actionId: id,
		status: z.enum(['open', 'done'])
	})
]);

export type Command = z.infer<typeof CommandSchema>;

export const ClientMessageSchema = z.discriminatedUnion('type', [
	z.object({ type: z.literal('subscribe'), retroId: id }),
	z.object({ type: z.literal('ping') })
]);

export function actionLinkError(cardId?: string | null, groupId?: string | null): string | null {
	if (cardId && groupId) return 'Link a note or a group, not both';
	return null;
}
