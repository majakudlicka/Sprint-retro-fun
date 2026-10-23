import { devLoginAvailable } from '$lib/server/dev-login';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async (event) => {
	const session = await event.locals.auth();
	const user = session?.user?.id
		? {
				id: session.user.id,
				name: session.user.name ?? 'Teammate',
				email: session.user.email ?? '',
				image: session.user.image ?? null
			}
		: null;
	return { user, devLogin: devLoginAvailable(event.url.hostname) };
};
