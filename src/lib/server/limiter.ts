import { consumeRate } from '../domain/rate-limit';
import { HttpError } from './http';

const KEY = Symbol.for('sprint-retro-fun.rates');

function buckets(): Map<string, number[]> {
	const g = globalThis as unknown as Record<symbol, Map<string, number[]>>;
	if (!g[KEY]) g[KEY] = new Map();
	return g[KEY];
}

export function assertRate(key: string, limit = 120, windowMs = 60_000) {
	if (!consumeRate(buckets(), key, limit, windowMs, Date.now())) {
		throw new HttpError(429, 'Too many changes at once. Take a breath.');
	}
}
