export const PHASES = ['write', 'group', 'vote', 'discuss', 'actions', 'closed'] as const;
export type Phase = (typeof PHASES)[number];

export const FORMAT_IDS = ['start-stop-continue', 'mad-sad-glad', 'four-ls', 'went-well'] as const;
export type FormatId = (typeof FORMAT_IDS)[number];

export const COMMAND_TYPES = [
	'add-card',
	'edit-card',
	'delete-card',
	'group-cards',
	'move-to-group',
	'rename-group',
	'ungroup-card',
	'add-vote',
	'remove-vote',
	'advance-phase',
	'add-action',
	'set-action-status'
] as const;
export type CommandType = (typeof COMMAND_TYPES)[number];

export type VoteTarget = 'card' | 'group';
export type ActionStatus = 'open' | 'done';

export type ColumnTone = 'sage' | 'coral' | 'sky' | 'gold';

export type CardInput = {
	id: string;
	columnKey: string;
	text: string;
	authorId: string;
	authorName: string;
	groupId: string | null;
	createdAt: string;
};

export type GroupInput = {
	id: string;
	columnKey: string;
	name: string;
	createdAt: string;
};

export type VoteInput = {
	userId: string;
	targetType: VoteTarget;
	targetId: string;
};

export type ActionInput = {
	id: string;
	text: string;
	status: ActionStatus;
	dueDate: string | null;
	ownerId: string | null;
	ownerName: string | null;
	linkLabel: string | null;
	retroId: string;
	retroTitle: string;
	createdAt: string;
};

export type PresentedCard = {
	id: string;
	columnKey: string;
	text: string | null;
	hidden: boolean;
	mine: boolean;
	authorName: string | null;
	groupId: string | null;
	createdAt: string;
};

export type Topic = {
	kind: VoteTarget;
	id: string;
	columnKey: string;
	name: string | null;
	voteCount: number;
	myVotes: number;
	createdAt: string;
	cards: PresentedCard[];
};

export type PresentedAction = {
	id: string;
	text: string;
	status: ActionStatus;
	dueDate: string | null;
	ownerId: string | null;
	ownerName: string | null;
	linkLabel: string | null;
	retroId: string;
	retroTitle: string;
	createdAt: string;
};

export type RetroView = {
	id: string;
	title: string;
	teamId: string;
	teamName: string;
	format: FormatId;
	phase: Phase;
	voteBudget: number;
	votesUsed: number;
	votesRemaining: number;
	anonymous: boolean;
	facilitatorName: string;
	isFacilitator: boolean;
	columns: {
		key: string;
		label: string;
		hint: string;
		tone: ColumnTone;
		topics: Topic[];
	}[];
	discussionOrder: {
		topicId: string;
		kind: VoteTarget;
		columnKey: string;
		columnLabel: string;
		label: string;
		voteCount: number;
	}[];
	actions: PresentedAction[];
	previousActions: PresentedAction[];
	members: { id: string; name: string }[];
};
