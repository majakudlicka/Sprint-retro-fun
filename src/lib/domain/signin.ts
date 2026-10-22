export function googleSignInAllowed(input: {
	email: string | null | undefined;
	emailVerified: boolean | string | null | undefined;
	hostedDomain: string | null | undefined;
	allowedDomain: string | undefined;
}): { ok: true } | { ok: false; reason: 'unverified' | 'domain' } {
	const verified = input.emailVerified === true || input.emailVerified === 'true';
	if (!input.email || !verified) return { ok: false, reason: 'unverified' };

	const allowed = input.allowedDomain?.trim().toLowerCase().replace(/^@/, '');
	if (!allowed) return { ok: true };

	const emailDomain = input.email.toLowerCase().split('@')[1];
	if (emailDomain !== allowed) return { ok: false, reason: 'domain' };
	if (input.hostedDomain && input.hostedDomain.toLowerCase() !== allowed) {
		return { ok: false, reason: 'domain' };
	}
	return { ok: true };
}

export function cleanDisplayName(name: string | null | undefined, email: string): string {
	const cleaned = (name ?? '').replace(/[\u0000-\u001F\u007F]/g, '').trim().slice(0, 120);
	if (cleaned) return cleaned;
	return email.split('@')[0]?.slice(0, 120) || 'Teammate';
}
