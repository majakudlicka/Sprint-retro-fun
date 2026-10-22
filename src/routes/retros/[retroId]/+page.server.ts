import { error } from '@sveltejs/kit';
import { requireUser } from '$lib/server/session';
import { buildRetroView } from '$lib/server/retro-view';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const user = await requireUser(event);
	const retro = await buildRetroView(event.params.retroId, user.id);
	if (!retro) error(404, 'Not found');
	return { retro };
};
