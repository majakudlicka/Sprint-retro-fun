import { describe, expect, test } from 'vitest';
import { assembleRetroView, type AssembleInput } from '../src/lib/domain/assemble';

const alex = '11111111-1111-4111-8111-111111111111';
const blake = '22222222-2222-4222-8222-222222222222';
const secret = 'SECRET_NOTE_FROM_BLAKE';
const blakeName = 'Blake Hiddenname';

function base(overrides: Partial<AssembleInput['retro']> = {}): AssembleInput {
	return {
		viewerId: alex,
		retro: {
			id: 'retro-1',
			title: 'Sprint 12',
			teamId: 'team-1',
			teamName: 'Platform',
			format: 'start-stop-continue',
			phase: 'write',
			voteBudget: 3,
			anonymous: false,
			facilitatorId: alex,
			facilitatorName: 'Alex',
			...overrides
		},
		members: [
			{ id: alex, name: 'Alex' },
			{ id: blake, name: blakeName }
		],
		cards: [
			{
				id: 'card-alex',
				columnKey: 'start',
				text: 'Ship the migration earlier',
				authorId: alex,
				authorName: 'Alex',
				groupId: null,
				createdAt: '2024-05-01T00:00:00.000Z'
			},
			{
				id: 'card-blake',
				columnKey: 'start',
				text: secret,
				authorId: blake,
				authorName: blakeName,
				groupId: null,
				createdAt: '2024-05-01T00:01:00.000Z'
			}
		],
		groups: [],
		votes: [],
		actions: [],
		previousActions: [
			{
				id: 'action-old',
				text: 'Write the deploy checklist',
				status: 'open',
				dueDate: '2024-05-10',
				ownerId: alex,
				ownerName: 'Alex',
				linkLabel: null,
				retroId: 'retro-0',
				retroTitle: 'Sprint 11',
				createdAt: '2024-04-01T00:00:00.000Z'
			}
		]
	};
}

describe('assembleRetroView', () => {
	test('hides other people\'s notes and names during write, even when the retro is not anonymous', () => {
		const view = assembleRetroView(base());
		const notes = JSON.stringify(view.columns);
		expect(notes).not.toContain(secret);
		expect(notes).not.toContain(blakeName);
		expect(notes).not.toContain('authorId');
		expect(JSON.stringify(view)).not.toContain('authorId');
		expect(notes).toContain('Ship the migration earlier');
		expect(view.members.map((member) => member.name)).toContain(blakeName);

		const hidden = view.columns[0].topics.find((topic) => topic.id === 'card-blake');
		expect(hidden?.cards[0]).toMatchObject({ hidden: true, text: null, authorName: null, mine: false });
		const mine = view.columns[0].topics.find((topic) => topic.id === 'card-alex');
		expect(mine?.cards[0]).toMatchObject({ hidden: false, mine: true, authorName: 'Alex' });
		expect(view.previousActions[0].text).toBe('Write the deploy checklist');
		expect(view.isFacilitator).toBe(true);
	});

	test('anonymous mode keeps authors stored out of other people\'s views after writing', () => {
		const view = assembleRetroView(base({ phase: 'discuss', anonymous: true }));
		const notes = JSON.stringify(view.columns);
		expect(notes).toContain(secret);
		expect(notes).not.toContain(blakeName);
		expect(JSON.stringify(view)).not.toContain('"authorId"');
		const other = view.columns[0].topics.find((topic) => topic.id === 'card-blake');
		expect(other?.cards[0].authorName).toBeNull();
		const mine = view.columns[0].topics.find((topic) => topic.id === 'card-alex');
		expect(mine?.cards[0].authorName).toBe('Alex');
	});

	test('shows author names when the retro is not anonymous and writing is over', () => {
		const view = assembleRetroView(base({ phase: 'group', anonymous: false }));
		const other = view.columns[0].topics.find((topic) => topic.id === 'card-blake');
		expect(other?.cards[0]).toMatchObject({ text: secret, authorName: blakeName, hidden: false });
	});

	test('sorts discussion order by votes and counts a group as one item', () => {
		const input = base({ phase: 'discuss', voteBudget: 5 });
		input.groups = [
			{
				id: 'group-1',
				columnKey: 'start',
				name: 'Planning',
				createdAt: '2024-05-01T00:02:00.000Z'
			}
		];
		input.cards = [
			{ ...input.cards[0], groupId: 'group-1' },
			{ ...input.cards[1], groupId: 'group-1' },
			{
				id: 'card-loose',
				columnKey: 'stop',
				text: 'Skipping reviews',
				authorId: alex,
				authorName: 'Alex',
				groupId: null,
				createdAt: '2024-05-01T00:03:00.000Z'
			}
		];
		input.votes = [
			{ userId: alex, targetType: 'group', targetId: 'group-1' },
			{ userId: blake, targetType: 'group', targetId: 'group-1' },
			{ userId: blake, targetType: 'group', targetId: 'group-1' },
			{ userId: alex, targetType: 'card', targetId: 'card-loose' }
		];

		const view = assembleRetroView(input);
		expect(view.discussionOrder.map((item) => [item.label, item.voteCount])).toEqual([
			['Planning', 3],
			['Skipping reviews', 1]
		]);
		expect(view.columns[0].topics[0]).toMatchObject({
			kind: 'group',
			voteCount: 3,
			myVotes: 1
		});
		expect(view.columns[0].topics[0].cards).toHaveLength(2);
		expect(view.votesUsed).toBe(2);
		expect(view.votesRemaining).toBe(3);
		expect(view.columns[1].topics[0].voteCount).toBe(1);
	});

	test('keeps write-phase columns in chronological order', () => {
		const view = assembleRetroView(base());
		expect(view.columns[0].topics.map((topic) => topic.id)).toEqual(['card-alex', 'card-blake']);
	});

	test('sorts a column by votes once voting starts', () => {
		const input = base({ phase: 'vote', voteBudget: 5 });
		input.cards.push({
			id: 'card-popular',
			columnKey: 'stop',
			text: 'Late reviews',
			authorId: blake,
			authorName: blakeName,
			groupId: null,
			createdAt: '2024-05-02T00:00:00.000Z'
		});
		input.votes = [
			{ userId: alex, targetType: 'card', targetId: 'card-popular' },
			{ userId: blake, targetType: 'card', targetId: 'card-popular' },
			{ userId: alex, targetType: 'card', targetId: 'card-alex' }
		];
		const view = assembleRetroView(input);
		expect(view.columns[1].topics.map((topic) => topic.id)).toEqual(['card-popular']);
		expect(view.columns[0].topics.map((topic) => topic.id)).toEqual(['card-alex', 'card-blake']);
		expect(view.discussionOrder[0]).toMatchObject({ topicId: 'card-popular', voteCount: 2 });
	});
});
