import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

export function newInviteToken(): string {
	return randomBytes(32).toString('base64url');
}

export function hashToken(token: string): string {
	return createHash('sha256').update(token).digest('hex');
}

export function secretsMatch(input: string, expected: string): boolean {
	const left = Buffer.from(input);
	const right = Buffer.from(expected);
	if (left.length !== right.length) return false;
	return timingSafeEqual(left, right);
}
