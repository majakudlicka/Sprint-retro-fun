export function consumeRate(
	buckets: Map<string, number[]>,
	key: string,
	limit: number,
	windowMs: number,
	now: number
): boolean {
	const recent = (buckets.get(key) ?? []).filter((stamp) => now - stamp < windowMs);
	if (recent.length >= limit) {
		buckets.set(key, recent);
		return false;
	}
	recent.push(now);
	buckets.set(key, recent);
	return true;
}
