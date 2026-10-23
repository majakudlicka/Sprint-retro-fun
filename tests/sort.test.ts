import { describe, expect, test } from 'vitest';
import { sortByVotes } from '../src/lib/domain/sort';

describe('sortByVotes', () => {
	test('orders by vote count descending, then earlier items, then id', () => {
		const sorted = sortByVotes([
			{ id: 'b', voteCount: 1, createdAt: '2024-01-02T00:00:00.000Z' },
			{ id: 'a', voteCount: 3, createdAt: '2024-01-03T00:00:00.000Z' },
			{ id: 'd', voteCount: 3, createdAt: '2024-01-01T00:00:00.000Z' },
			{ id: 'c', voteCount: 3, createdAt: '2024-01-01T00:00:00.000Z' },
			{ id: 'e', voteCount: 0, createdAt: '2024-01-01T00:00:00.000Z' }
		]);
		expect(sorted.map((item) => item.id)).toEqual(['c', 'd', 'a', 'b', 'e']);
	});

	test('does not mutate the input', () => {
		const input = [
			{ id: 'b', voteCount: 1, createdAt: '2024-01-02T00:00:00.000Z' },
			{ id: 'a', voteCount: 2, createdAt: '2024-01-01T00:00:00.000Z' }
		];
		sortByVotes(input);
		expect(input.map((item) => item.id)).toEqual(['b', 'a']);
	});
});
