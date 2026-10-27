import { error, fail, redirect } from '@sveltejs/kit';
import { anonymousFromFormValues } from '$lib/domain/anonymous';
import { defaultRetroTitle } from '$lib/domain/dates';
import { createRetroSchema } from '$lib/domain/schemas';
import { HttpError } from '$lib/server/http';
import { requireUser } from '$lib/server/session';
import { createRetroForTeam, getTeamPage } from '$lib/server/teams';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const user = await requireUser(event);
	const team = await getTeamPage(event.params.teamId, user.id);
	if (!team) error(404, 'Not found');
	return { teamId: team.id, teamName: team.name, defaultTitle: defaultRetroTitle() };
};

export const actions: Actions = {
	default: async (event) => {
		const user = await requireUser(event);
		const form = await event.request.formData();
		const anonymous = anonymousFromFormValues(form.getAll('anonymous'));
		const parsed = createRetroSchema.safeParse({
			title: form.get('title'),
			format: form.get('format'),
			voteBudget: form.get('voteBudget'),
			anonymous
		});
		if (!parsed.success) return fail(400, { message: 'Check the title, format, and vote budget (3 to 5).', anonymous });
		try {
			const retro = await createRetroForTeam(user.id, event.params.teamId, parsed.data);
			redirect(303, `/retros/${retro.id}`);
		} catch (err) {
			if (err instanceof HttpError) return fail(err.status, { message: err.message, anonymous });
			throw err;
		}
	}
};
