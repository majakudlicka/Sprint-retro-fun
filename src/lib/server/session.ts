import { redirect, type RequestEvent } from '@sveltejs/kit';

export async function requireUser(event: RequestEvent) {
	const session = await event.locals.auth();
	if (!session?.user?.id) redirect(303, '/login');
	return {
		id: session.user.id,
		name: session.user.name ?? 'Teammate',
		email: session.user.email ?? '',
		image: session.user.image ?? null
	};
}
