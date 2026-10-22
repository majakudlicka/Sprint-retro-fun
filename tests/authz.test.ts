import { describe, expect, test } from 'vitest';
import { authorizeCommand, authorizeSubscription } from '../src/lib/domain/authz';
import type { CommandType, Phase } from '../src/lib/domain/types';

const member = { isMember: true, isFacilitator: false, isAuthor: true };
const facilitator = { isMember: true, isFacilitator: true, isAuthor: false };
const outsider = { isMember: false, isFacilitator: false, isAuthor: false };

function allow(phase: Phase, command: CommandType, extra: Partial<typeof member> = {}) {
	return authorizeCommand({ ...member, phase, command, ...extra });
}

describe('authorizeCommand', () => {
	test('hides retros from people who are not on the team', () => {
		const decision = authorizeCommand({ ...outsider, phase: 'write', command: 'add-card' });
		expect(decision).toEqual({ ok: false, status: 404, message: 'Not found' });
	});

	test('lets a member add a note while writing and blocks votes', () => {
		expect(allow('write', 'add-card').ok).toBe(true);
		expect(allow('write', 'add-vote')).toMatchObject({ ok: false, status: 400 });
	});

	test('only the author edits a note, and the facilitator may delete someone else\'s', () => {
		expect(allow('write', 'edit-card', { isAuthor: false })).toMatchObject({ ok: false, status: 403 });
		expect(allow('write', 'edit-card', { isAuthor: true }).ok).toBe(true);
		expect(allow('write', 'delete-card', { isAuthor: false, isFacilitator: false })).toMatchObject({
			ok: false,
			status: 403
		});
		expect(
			authorizeCommand({ ...facilitator, phase: 'write', command: 'delete-card', isAuthor: false }).ok
		).toBe(true);
	});

	test('grouping is only available in the group phase', () => {
		expect(allow('group', 'group-cards').ok).toBe(true);
		expect(allow('vote', 'group-cards')).toMatchObject({ ok: false, status: 400 });
		expect(allow('write', 'rename-group')).toMatchObject({ ok: false, status: 400 });
	});

	test('voting is only available in the vote phase', () => {
		expect(allow('vote', 'add-vote').ok).toBe(true);
		expect(allow('vote', 'remove-vote').ok).toBe(true);
		expect(allow('discuss', 'add-vote')).toMatchObject({ ok: false, status: 400 });
		expect(allow('group', 'add-vote')).toMatchObject({ ok: false, status: 400 });
	});

	test('action items are added in the actions phase and can be closed later', () => {
		expect(allow('actions', 'add-action').ok).toBe(true);
		expect(allow('discuss', 'add-action')).toMatchObject({ ok: false, status: 400 });
		expect(allow('closed', 'add-action')).toMatchObject({ ok: false, status: 400 });
		expect(allow('closed', 'set-action-status').ok).toBe(true);
		expect(allow('write', 'set-action-status').ok).toBe(true);
	});

	test('only the facilitator advances the phase, and closed stays closed', () => {
		expect(authorizeCommand({ ...facilitator, phase: 'vote', command: 'advance-phase' }).ok).toBe(true);
		expect(allow('vote', 'advance-phase', { isFacilitator: false })).toMatchObject({
			ok: false,
			status: 403
		});
		expect(authorizeCommand({ ...facilitator, phase: 'closed', command: 'advance-phase' })).toMatchObject({
			ok: false,
			status: 400
		});
	});

	test('a non-member cannot subscribe to live updates', () => {
		expect(authorizeSubscription(false)).toMatchObject({ ok: false, status: 404 });
		expect(authorizeSubscription(true)).toEqual({ ok: true });
	});
});
