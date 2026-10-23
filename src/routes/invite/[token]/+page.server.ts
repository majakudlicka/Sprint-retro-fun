import { error, fail, redirect } from '@sveltejs/kit';
import { HttpError } from '$lib/server/http';
import { requireUser } from '$lib/server/session';
import { acceptInvite, previewInvite } from '$lib/server/teams';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	await requireUser(event);
	const invite = await previewInvite(event.params.token);
	if (!invite) error(404, 'This invite is invalid or expired.');
	return { teamName: invite.teamName };
};

export const actions: Actions = {
	default: async (event) => {
		const user = await requireUser(event);
		try {
			const invite = await acceptInvite(event.params.token, user.id);
			redirect(303, `/teams/${invite.teamId}`);
		} catch (err) {
			if (err instanceof HttpError) return fail(err.status, { message: err.message });
			throw err;
		}
	}
};
