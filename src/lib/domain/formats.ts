import { FORMAT_IDS, type FormatId } from './types';

export type FormatColumn = { key: string; label: string; hint: string };

export type FormatDefinition = {
	label: string;
	description: string;
	columns: readonly FormatColumn[];
};

export const FORMATS: Record<FormatId, FormatDefinition> = {
	'start-stop-continue': {
		label: 'Start / Stop / Continue',
		description: 'What should the team start, stop, and keep doing?',
		columns: [
			{ key: 'start', label: 'Start', hint: 'What should we start doing?' },
			{ key: 'stop', label: 'Stop', hint: 'What should we stop doing?' },
			{ key: 'continue', label: 'Continue', hint: 'What should we keep doing?' }
		]
	},
	'mad-sad-glad': {
		label: 'Mad / Sad / Glad',
		description: 'A feelings check on the sprint.',
		columns: [
			{ key: 'mad', label: 'Mad', hint: 'What frustrated you?' },
			{ key: 'sad', label: 'Sad', hint: 'What disappointed you?' },
			{ key: 'glad', label: 'Glad', hint: 'What made you glad?' }
		]
	},
	'four-ls': {
		label: '4Ls',
		description: 'Liked, learned, lacked, longed for.',
		columns: [
			{ key: 'liked', label: 'Liked', hint: 'What did you like?' },
			{ key: 'learned', label: 'Learned', hint: 'What did you learn?' },
			{ key: 'lacked', label: 'Lacked', hint: 'What was missing?' },
			{ key: 'longed-for', label: 'Longed for', hint: 'What do you wish had happened?' }
		]
	},
	'went-well': {
		label: 'Went well / To improve / Action ideas',
		description: 'Classic three-column retro with a lane for ideas.',
		columns: [
			{ key: 'went-well', label: 'Went well', hint: 'What went well?' },
			{ key: 'to-improve', label: 'To improve', hint: 'What should improve?' },
			{ key: 'action-ideas', label: 'Action ideas', hint: 'What could we do next?' }
		]
	}
};

export function isFormatId(value: string): value is FormatId {
	return (FORMAT_IDS as readonly string[]).includes(value);
}

export function isColumnKey(format: FormatId, key: string): boolean {
	return FORMATS[format].columns.some((column) => column.key === key);
}
