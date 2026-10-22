import { describe, expect, test } from 'vitest';
import { evaluateVote } from '../src/lib/domain/votes';

describe('evaluateVote', () => {
	test('spends one vote from a budget of 5', () => {
		expect(evaluateVote({ budget: 5, existingCount: 0, action: 'add' })).toEqual({
			ok: true,
			remaining: 4
		});
	});

	test('allows another vote on the same item while budget remains', () => {
		// existingCount is the person's total, not a per-item cap.
		expect(evaluateVote({ budget: 5, existingCount: 2, action: 'add' })).toEqual({
			ok: true,
			remaining: 2
		});
	});

	test('rejects a vote once the budget is spent', () => {
		expect(evaluateVote({ budget: 3, existingCount: 3, action: 'add' })).toEqual({
			ok: false,
			reason: 'vote-budget-exhausted'
		});
		expect(evaluateVote({ budget: 5, existingCount: 5, action: 'add' })).toEqual({
			ok: false,
			reason: 'vote-budget-exhausted'
		});
	});

	test('accepts the last vote in the budget', () => {
		expect(evaluateVote({ budget: 3, existingCount: 2, action: 'add' })).toEqual({
			ok: true,
			remaining: 0
		});
	});

	test('returns a vote to the budget and refuses to remove one that is not there', () => {
		expect(evaluateVote({ budget: 5, existingCount: 1, action: 'remove' })).toEqual({
			ok: true,
			remaining: 5
		});
		expect(evaluateVote({ budget: 5, existingCount: 0, action: 'remove' })).toEqual({
			ok: false,
			reason: 'no-vote-to-remove'
		});
	});
});
