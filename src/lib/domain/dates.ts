const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

/** Calendar date as `d MMM yyyy`, for example `26 Oct 2026`. */
export function formatDayMonthYear(date: Date): string {
	return `${date.getDate()} ${SHORT_MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

export function defaultRetroTitle(date: Date = new Date()): string {
	return `Retro on ${formatDayMonthYear(date)}`;
}

/**
 * Blank and missing titles become the dated default.
 * Any other value is returned unchanged so the schema can accept or reject it.
 */
export function submittedRetroTitle(value: unknown, now: Date = new Date()): unknown {
	if (value == null) return defaultRetroTitle(now);
	if (typeof value !== 'string') return value;
	const trimmed = value.trim();
	return trimmed.length > 0 ? trimmed : defaultRetroTitle(now);
}

export function isRealDate(value: string): boolean {
	const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
	if (!match) return false;
	const year = Number(match[1]);
	const month = Number(match[2]);
	const day = Number(match[3]);
	const date = new Date(Date.UTC(year, month - 1, day));
	return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}
