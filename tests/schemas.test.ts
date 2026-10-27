import { describe, expect, test } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { anonymousFromFormValues } from '../src/lib/domain/anonymous';
import { CommandSchema, createRetroSchema } from '../src/lib/domain/schemas';
import { googleSignInAllowed, cleanDisplayName } from '../src/lib/domain/signin';
import { requestOriginAllowed } from '../src/lib/domain/origin';
import { consumeRate } from '../src/lib/domain/rate-limit';
import { nextPhase } from '../src/lib/domain/phases';
import { defaultRetroTitle, isRealDate, submittedRetroTitle } from '../src/lib/domain/dates';
import { PHASES } from '../src/lib/domain/types';

const cardId = '33333333-3333-4333-8333-333333333333';

describe('CommandSchema', () => {
	test('accepts a note and rejects empty or huge text', () => {
		expect(CommandSchema.safeParse({ type: 'add-card', columnKey: 'start', text: '  Hello  ' }).success).toBe(
			true
		);
		expect(CommandSchema.safeParse({ type: 'add-card', columnKey: 'start', text: '   ' }).success).toBe(false);
		expect(
			CommandSchema.safeParse({ type: 'add-card', columnKey: 'start', text: 'x'.repeat(2001) }).success
		).toBe(false);
		expect(CommandSchema.safeParse({ type: 'delete-card', cardId: 'not-a-uuid' }).success).toBe(false);
		expect(CommandSchema.safeParse({ type: 'delete-card', cardId }).success).toBe(true);
	});

	test('rejects an action linked to both a note and a group', () => {
		const result = CommandSchema.safeParse({
			type: 'add-action',
			text: 'Do the thing',
			cardId,
			groupId: '44444444-4444-4444-8444-444444444444'
		});
		expect(result.success).toBe(false);
	});

	test('rejects an impossible due date and a vote budget outside 3 to 5', () => {
		expect(isRealDate('2024-02-29')).toBe(true);
		expect(isRealDate('2023-02-29')).toBe(false);
		expect(
			CommandSchema.safeParse({ type: 'add-action', text: 'Do it', dueDate: '2023-02-29' }).success
		).toBe(false);
		expect(createRetroSchema.safeParse({ title: 'Sprint', format: 'four-ls', voteBudget: 2, anonymous: false }).success).toBe(
			false
		);
		expect(createRetroSchema.safeParse({ title: 'Sprint', format: 'four-ls', voteBudget: 4, anonymous: true }).success).toBe(
			true
		);
		expect(
			createRetroSchema.safeParse({ title: 'Sprint', format: 'nope', voteBudget: 4, anonymous: false }).success
		).toBe(false);
	});

	test('defaults a missing anonymous flag to true and still accepts an explicit opt-out', () => {
		const missing = createRetroSchema.safeParse({
			title: 'Sprint',
			format: 'start-stop-continue',
			voteBudget: 5
		});
		expect(missing.success).toBe(true);
		if (missing.success) expect(missing.data.anonymous).toBe(true);

		const optedOut = createRetroSchema.safeParse({
			title: 'Sprint',
			format: 'four-ls',
			voteBudget: 4,
			anonymous: false
		});
		expect(optedOut.success).toBe(true);
		if (optedOut.success) expect(optedOut.data.anonymous).toBe(false);
	});

	test('treats a missing anonymous checkbox as anonymous without losing the unchecked opt-out', () => {
		expect(anonymousFromFormValues([])).toBe(true);
		expect(anonymousFromFormValues(undefined)).toBe(true);
		expect(anonymousFromFormValues(['off'])).toBe(false);
		expect(anonymousFromFormValues(['off', 'on'])).toBe(true);
		expect(anonymousFromFormValues(['on'])).toBe(true);
		expect(anonymousFromFormValues(['false'])).toBe(false);
	});

	test('fills a blank retro title with a dated default and still rejects an overlong one', () => {
		const today = new Date(2026, 9, 26);
		expect(defaultRetroTitle(today)).toBe('Retro on 26 Oct 2026');
		expect(defaultRetroTitle(new Date(2026, 0, 5))).toBe('Retro on 5 Jan 2026');
		expect(submittedRetroTitle('   ', today)).toBe('Retro on 26 Oct 2026');
		expect(submittedRetroTitle(null, today)).toBe('Retro on 26 Oct 2026');
		expect(submittedRetroTitle('  Sprint 42  ', today)).toBe('Sprint 42');
		expect(submittedRetroTitle(121, today)).toBe(121);

		const blank = createRetroSchema.safeParse({
			title: '',
			format: 'start-stop-continue',
			voteBudget: '5',
			anonymous: false
		});
		expect(blank.success).toBe(true);
		if (blank.success) expect(blank.data.title).toBe(defaultRetroTitle());

		const missing = createRetroSchema.safeParse({
			title: null,
			format: 'start-stop-continue',
			voteBudget: 5,
			anonymous: true
		});
		expect(missing.success).toBe(true);
		if (missing.success) expect(missing.data.title).toBe(defaultRetroTitle());

		const named = createRetroSchema.safeParse({
			title: '  Sprint 42  ',
			format: 'four-ls',
			voteBudget: 3,
			anonymous: false
		});
		expect(named.success).toBe(true);
		if (named.success) expect(named.data.title).toBe('Sprint 42');

		expect(
			createRetroSchema.safeParse({
				title: 'x'.repeat(121),
				format: 'four-ls',
				voteBudget: 5,
				anonymous: false
			}).success
		).toBe(false);
		expect(
			createRetroSchema.safeParse({
				title: 'x'.repeat(120),
				format: 'four-ls',
				voteBudget: 5,
				anonymous: false
			}).success
		).toBe(true);
	});
});

describe('google sign-in policy', () => {
	test('requires a verified email and, when set, the workspace domain', () => {
		expect(
			googleSignInAllowed({
				email: 'a@example.com',
				emailVerified: true,
				hostedDomain: 'example.com',
				allowedDomain: 'example.com'
			}).ok
		).toBe(true);
		expect(
			googleSignInAllowed({
				email: 'a@gmail.com',
				emailVerified: true,
				hostedDomain: null,
				allowedDomain: 'example.com'
			})
		).toEqual({ ok: false, reason: 'domain' });
		expect(
			googleSignInAllowed({
				email: 'a@example.com',
				emailVerified: false,
				hostedDomain: 'example.com',
				allowedDomain: undefined
			})
		).toEqual({ ok: false, reason: 'unverified' });
		expect(
			googleSignInAllowed({
				email: 'a@example.com',
				emailVerified: 'true',
				hostedDomain: 'other.com',
				allowedDomain: '@example.com'
			})
		).toEqual({ ok: false, reason: 'domain' });
	});

	test('strips control characters from display names', () => {
		expect(cleanDisplayName('Ada\u0000 Lovelace', 'ada@example.com')).toBe('Ada Lovelace');
		expect(cleanDisplayName('   ', 'ada@example.com')).toBe('ada');
	});
});

describe('request origins and rate limits', () => {
	test('allows same-host and configured origins, and blocks other sites', () => {
		expect(requestOriginAllowed('http://localhost:5173', 'localhost:5173', undefined)).toBe(true);
		expect(requestOriginAllowed('https://evil.example', 'localhost:5173', undefined)).toBe(false);
		expect(requestOriginAllowed(null, 'localhost:5173', undefined)).toBe(false);
		expect(requestOriginAllowed('https://retro.example', 'internal:3000', 'https://retro.example')).toBe(true);
	});

	test('stops a burst and allows a later window', () => {
		const buckets = new Map<string, number[]>();
		expect(consumeRate(buckets, 'user', 2, 1000, 0)).toBe(true);
		expect(consumeRate(buckets, 'user', 2, 1000, 10)).toBe(true);
		expect(consumeRate(buckets, 'user', 2, 1000, 20)).toBe(false);
		expect(consumeRate(buckets, 'user', 2, 1000, 2000)).toBe(true);
	});
});

describe('phases', () => {
	test('walks write through closed and stops there', () => {
		expect(PHASES).toEqual(['write', 'group', 'vote', 'discuss', 'actions', 'closed']);
		expect(nextPhase('write')).toBe('group');
		expect(nextPhase('actions')).toBe('closed');
		expect(nextPhase('closed')).toBeNull();
	});
});

describe('templates', () => {
	test('do not render raw HTML', () => {
		const offenders: string[] = [];
		const walk = (dir: string) => {
			for (const entry of readdirSync(dir)) {
				const path = join(dir, entry);
				if (statSync(path).isDirectory()) {
					walk(path);
					continue;
				}
				if (!path.endsWith('.svelte') && !path.endsWith('.ts') && !path.endsWith('.js')) continue;
				if (readFileSync(path, 'utf8').includes('{@html')) offenders.push(path);
			}
		};
		walk('src');
		expect(offenders).toEqual([]);
	});
});
