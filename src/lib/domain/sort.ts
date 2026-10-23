export type SortableTopic = {
	id: string;
	voteCount: number;
	createdAt: string;
};

/** Highest vote count first. Ties break toward the earlier item, then id. */
export function compareByVotes(a: SortableTopic, b: SortableTopic): number {
	if (a.voteCount !== b.voteCount) return b.voteCount - a.voteCount;
	if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? -1 : 1;
	if (a.id !== b.id) return a.id < b.id ? -1 : 1;
	return 0;
}

export function compareChronological(a: { id: string; createdAt: string }, b: { id: string; createdAt: string }): number {
	if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? -1 : 1;
	if (a.id !== b.id) return a.id < b.id ? -1 : 1;
	return 0;
}

export function sortByVotes<T extends SortableTopic>(items: readonly T[]): T[] {
	return [...items].sort(compareByVotes);
}
