import { nextPhase } from './phases';
import type { CommandType, Phase } from './types';

export type Decision =
	| { ok: true }
	| { ok: false; status: 400 | 403 | 404; message: string };

const MEMBER_COMMANDS: Record<Phase, readonly CommandType[]> = {
	write: ['add-card', 'edit-card', 'delete-card', 'set-action-status'],
	group: ['group-cards', 'move-to-group', 'rename-group', 'ungroup-card', 'set-action-status'],
	vote: ['add-vote', 'remove-vote', 'set-action-status'],
	discuss: ['set-action-status'],
	actions: ['add-action', 'set-action-status'],
	closed: ['set-action-status']
};

export function authorizeSubscription(isMember: boolean): Decision {
	if (!isMember) return { ok: false, status: 404, message: 'Not found' };
	return { ok: true };
}

export function authorizeCommand(input: {
	isMember: boolean;
	isFacilitator: boolean;
	phase: Phase;
	command: CommandType;
	isAuthor: boolean;
}): Decision {
	if (!input.isMember) return { ok: false, status: 404, message: 'Not found' };

	if (input.command === 'advance-phase') {
		if (!input.isFacilitator) {
			return { ok: false, status: 403, message: 'Only the facilitator can move the phase' };
		}
		if (!nextPhase(input.phase)) {
			return { ok: false, status: 400, message: 'This retro is already closed' };
		}
		return { ok: true };
	}

	if (!MEMBER_COMMANDS[input.phase].includes(input.command)) {
		return { ok: false, status: 400, message: "That action isn't available in this phase" };
	}

	if (input.command === 'edit-card' && !input.isAuthor) {
		return { ok: false, status: 403, message: 'You can only edit your own note' };
	}

	if (input.command === 'delete-card' && !input.isAuthor && !input.isFacilitator) {
		return { ok: false, status: 403, message: 'You can only delete your own note' };
	}

	return { ok: true };
}
