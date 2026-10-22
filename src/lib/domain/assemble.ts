import { FORMATS } from './formats';
import { compareByVotes, compareChronological } from './sort';
import type {
	ActionInput,
	CardInput,
	ColumnTone,
	FormatId,
	GroupInput,
	Phase,
	PresentedAction,
	PresentedCard,
	RetroView,
	Topic,
	VoteInput
} from './types';

const TONES: ColumnTone[] = ['sage', 'coral', 'sky', 'gold'];

export type AssembleInput = {
	viewerId: string;
	retro: {
		id: string;
		title: string;
		teamId: string;
		teamName: string;
		format: FormatId;
		phase: Phase;
		voteBudget: number;
		anonymous: boolean;
		facilitatorId: string;
		facilitatorName: string;
	};
	members: { id: string; name: string }[];
	cards: CardInput[];
	groups: GroupInput[];
	votes: VoteInput[];
	actions: ActionInput[];
	previousActions: ActionInput[];
};

export function presentCard(
	card: CardInput,
	viewerId: string,
	options: { phase: Phase; anonymous: boolean }
): PresentedCard {
	const mine = card.authorId === viewerId;
	if (options.phase === 'write' && !mine) {
		return {
			id: card.id,
			columnKey: card.columnKey,
			text: null,
			hidden: true,
			mine: false,
			authorName: null,
			groupId: null,
			createdAt: card.createdAt
		};
	}
	return {
		id: card.id,
		columnKey: card.columnKey,
		text: card.text,
		hidden: false,
		mine,
		authorName: options.anonymous && !mine ? null : card.authorName,
		groupId: card.groupId,
		createdAt: card.createdAt
	};
}

function presentAction(action: ActionInput): PresentedAction {
	return {
		id: action.id,
		text: action.text,
		status: action.status,
		dueDate: action.dueDate,
		ownerId: action.ownerId,
		ownerName: action.ownerName,
		linkLabel: action.linkLabel,
		retroId: action.retroId,
		retroTitle: action.retroTitle,
		createdAt: action.createdAt
	};
}

function topicLabel(topic: Topic): string {
	if (topic.kind === 'group') return topic.name?.trim() || 'Untitled group';
	const card = topic.cards[0];
	if (!card || card.hidden || card.text == null) return 'Hidden note';
	return card.text;
}

function voteKey(type: string, id: string) {
	return `${type}:${id}`;
}

export function assembleRetroView(input: AssembleInput): RetroView {
	const format = FORMATS[input.retro.format];
	const phase = input.retro.phase;
	const presented = input.cards.map((card) =>
		presentCard(card, input.viewerId, { phase, anonymous: input.retro.anonymous })
	);

	const tallies = new Map<string, { total: number; mine: number }>();
	for (const vote of input.votes) {
		const key = voteKey(vote.targetType, vote.targetId);
		const current = tallies.get(key) ?? { total: 0, mine: 0 };
		current.total += 1;
		if (vote.userId === input.viewerId) current.mine += 1;
		tallies.set(key, current);
	}

	const topics = buildTopics(presented, input.groups, tallies, phase);
	const chronological = phase === 'write' || phase === 'group';
	const compare = chronological ? compareChronological : compareByVotes;

	const columns = format.columns.map((column, index) => ({
		key: column.key,
		label: column.label,
		hint: column.hint,
		tone: TONES[index % TONES.length],
		topics: topics.filter((topic) => topic.columnKey === column.key).sort(compare)
	}));

	const columnLabel = new Map(format.columns.map((column) => [column.key, column.label]));
	const discussionOrder = [...topics].sort(compareByVotes).map((topic) => ({
		topicId: topic.id,
		kind: topic.kind,
		columnKey: topic.columnKey,
		columnLabel: columnLabel.get(topic.columnKey) ?? topic.columnKey,
		label: topicLabel(topic),
		voteCount: topic.voteCount
	}));

	const votesUsed = input.votes.filter((vote) => vote.userId === input.viewerId).length;

	return {
		id: input.retro.id,
		title: input.retro.title,
		teamId: input.retro.teamId,
		teamName: input.retro.teamName,
		format: input.retro.format,
		phase,
		voteBudget: input.retro.voteBudget,
		votesUsed,
		votesRemaining: Math.max(0, input.retro.voteBudget - votesUsed),
		anonymous: input.retro.anonymous,
		facilitatorName: input.retro.facilitatorName,
		isFacilitator: input.retro.facilitatorId === input.viewerId,
		columns,
		discussionOrder,
		actions: input.actions.map(presentAction),
		previousActions: input.previousActions.map(presentAction),
		members: input.members.map((member) => ({ id: member.id, name: member.name }))
	};
}

function buildTopics(
	cards: PresentedCard[],
	groups: GroupInput[],
	tallies: Map<string, { total: number; mine: number }>,
	phase: Phase
): Topic[] {
	if (phase === 'write') {
		return cards.map((card) => ({
			kind: 'card' as const,
			id: card.id,
			columnKey: card.columnKey,
			name: null,
			voteCount: 0,
			myVotes: 0,
			createdAt: card.createdAt,
			cards: [card]
		}));
	}

	const byGroup = new Map<string, PresentedCard[]>();
	const loose: PresentedCard[] = [];
	for (const card of cards) {
		if (card.groupId) {
			const list = byGroup.get(card.groupId) ?? [];
			list.push(card);
			byGroup.set(card.groupId, list);
		} else {
			loose.push(card);
		}
	}

	const topics: Topic[] = [];
	for (const group of groups) {
		const grouped = (byGroup.get(group.id) ?? []).sort(compareChronological);
		if (grouped.length === 0) continue;
		const tally = tallies.get(voteKey('group', group.id)) ?? { total: 0, mine: 0 };
		topics.push({
			kind: 'group',
			id: group.id,
			columnKey: group.columnKey,
			name: group.name,
			voteCount: tally.total,
			myVotes: tally.mine,
			createdAt: group.createdAt,
			cards: grouped
		});
	}

	for (const card of loose) {
		const tally = tallies.get(voteKey('card', card.id)) ?? { total: 0, mine: 0 };
		topics.push({
			kind: 'card',
			id: card.id,
			columnKey: card.columnKey,
			name: null,
			voteCount: tally.total,
			myVotes: tally.mine,
			createdAt: card.createdAt,
			cards: [card]
		});
	}

	return topics;
}
