import { error, fail, redirect } from '@sveltejs/kit';
import { encode } from '@auth/core/jwt';
import { emailSchema } from '$lib/domain/schemas';
import { cleanDisplayName } from '$lib/domain/signin';
import { devLoginAvailable } from '$lib/server/dev-login';
import { secretsMatch } from '$lib/server/tokens';
import { acceptEmailInvites, upsertGoogleUser } from '$lib/server/users';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	if (!devLoginAvailable(event.url.hostname)) error(404, 'Not found');
	return {};
};

export const actions: Actions = {
	default: async (event) => {
		if (!devLoginAvailable(event.url.hostname)) error(404, 'Not found');
		const form = await event.request.formData();
		const provided = String(form.get('secret') ?? '');
		const expected = process.env.DEV_LOGIN_SECRET ?? '';
		if (!secretsMatch(provided, expected)) error(403, 'Forbidden');
		const email = emailSchema.safeParse(form.get('email'));
		if (!email.success) return fail(400, { message: 'Use a real email address.' });
		const name = cleanDisplayName(String(form.get('name') ?? ''), email.data);
		const user = await upsertGoogleUser({ email: email.data, name, image: null });
		await acceptEmailInvites(user.id, user.email);
		const authSecret = process.env.AUTH_SECRET;
		if (!authSecret) error(500, 'AUTH_SECRET is not set');
		const secure = event.url.protocol === 'https:';
		const cookieName = `${secure ? '__Secure-' : ''}authjs.session-token`;
		const token = await encode({
			salt: cookieName,
			secret: authSecret,
			token: {
				sub: user.id,
				userId: user.id,
				email: user.email,
				name: user.name
			}
		});
		event.cookies.set(cookieName, token, {
			path: '/',
			httpOnly: true,
			sameSite: 'lax',
			secure
		});
		redirect(303, '/teams');
	}
};
