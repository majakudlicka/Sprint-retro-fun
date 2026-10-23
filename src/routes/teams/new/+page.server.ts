import { fail, redirect } from '@sveltejs/kit';
import { teamNameSchema } from '$lib/domain/schemas';
import { HttpError } from '$lib/server/http';
import { requireUser } from '$lib/server/session';
import { createTeam } from '$lib/server/teams';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	await requireUser(event);
	return {};
};

export const actions: Actions = {
	default: async (event) => {
		const user = await requireUser(event);
		const form = await event.request.formData();
		const name = teamNameSchema.safeParse(form.get('name'));
		if (!name.success) return fail(400, { message: 'Give the team a name (80 characters max).' });
		try {
			const team = await createTeam(user.id, name.data);
			redirect(303, `/teams/${team.id}`);
		} catch (error) {
			if (error instanceof HttpError) return fail(error.status, { message: error.message });
			throw error;
		}
	}
};
