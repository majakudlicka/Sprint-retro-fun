import { redirect } from '@sveltejs/kit';
import { signIn } from '../../auth';
import type { Actions, PageServerLoad } from './$types';

const messages: Record<string, string> = {
	domain: 'This space only accepts Google accounts from the allowed workspace domain.',
	unverified: 'Google did not confirm that email address.',
	AccessDenied: 'Google sign-in was denied.',
	Configuration: 'Sign-in is not configured yet. Check the server environment.'
};

export const load: PageServerLoad = async (event) => {
	const session = await event.locals.auth();
	if (session?.user?.id) redirect(303, '/teams');
	const code = event.url.searchParams.get('error');
	return {
		error: code ? (messages[code] ?? 'Sign-in did not complete.') : null
	};
};

export const actions: Actions = {
	default: signIn
};
