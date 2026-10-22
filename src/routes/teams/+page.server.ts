import { requireUser } from '$lib/server/session';
import { listTeams } from '$lib/server/teams';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const user = await requireUser(event);
	return { teams: await listTeams(user.id) };
};
