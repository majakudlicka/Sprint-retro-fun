import { PHASES, type Phase } from './types';

export const PHASE_LABELS: Record<Phase, string> = {
	write: 'Write',
	group: 'Group',
	vote: 'Vote',
	discuss: 'Discuss',
	actions: 'Actions',
	closed: 'Closed'
};

export const PHASE_HINTS: Record<Phase, string> = {
	write: 'Everyone adds notes. Other people cannot read them yet.',
	group: 'Drag notes onto each other to cluster similar thoughts, then name the group.',
	vote: 'Spend your votes. You can stack more than one on the same item.',
	discuss: 'Talk through the highest voted items first.',
	actions: 'Turn the conversation into owners and dates.',
	closed: 'The retro is read-only. Open actions can still be checked off.'
};

export function nextPhase(phase: Phase): Phase | null {
	const index = PHASES.indexOf(phase);
	if (index < 0 || index >= PHASES.length - 1) return null;
	return PHASES[index + 1];
}

export function phaseIndex(phase: Phase): number {
	return PHASES.indexOf(phase);
}
