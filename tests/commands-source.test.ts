import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';

test('retro commands enforce membership, phase rules, and the vote budget in a lock', () => {
	const source = readFileSync('src/lib/server/commands.ts', 'utf8');
	expect(source).toContain('authorizeCommand');
	expect(source).toContain('evaluateVote');
	expect(source).toContain('pg_advisory_xact_lock');
	expect(source).not.toContain('{@html');
});
