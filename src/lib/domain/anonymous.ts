/**
 * Anonymous notes are the default for a new retro.
 * A checked box submits "on" (and a hidden "off" that is always present).
 * An unchecked box submits only "off", which is the opt-out.
 * A completely missing value stays anonymous.
 */
export function anonymousFromFormValues(values: readonly unknown[] | null | undefined): boolean {
	if (values == null || values.length === 0) return true;
	return values.some((value) => value === true || value === 'on' || value === 'true' || value === '1');
}
