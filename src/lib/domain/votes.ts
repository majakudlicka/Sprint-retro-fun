export type VoteDecision =
	| { ok: true; remaining: number }
	| { ok: false; reason: 'vote-budget-exhausted' | 'no-vote-to-remove' };

/**
 * Vote budget is per person, per retro. Several votes may land on one item.
 * `existingCount` is the voter's total across every item.
 */
export function evaluateVote(input: {
	budget: number;
	existingCount: number;
	action: 'add' | 'remove';
}): VoteDecision {
	if (input.action === 'remove') {
		if (input.existingCount <= 0) return { ok: false, reason: 'no-vote-to-remove' };
		return { ok: true, remaining: input.budget - (input.existingCount - 1) };
	}
	if (input.existingCount >= input.budget) return { ok: false, reason: 'vote-budget-exhausted' };
	return { ok: true, remaining: input.budget - input.existingCount - 1 };
}
