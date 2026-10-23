import { error, fail } from '@sveltejs/kit';
import { emailSchema } from '$lib/domain/schemas';
import { PHASE_LABELS } from '$lib/domain/phases';
import { HttpError } from '$lib/server/http';
import { requireUser } from '$lib/server/session';
import {
	createInviteLink,
	getTeamPage,
	inviteByEmail,
	removeMember,
	revokeInvite,
	setTeamActionStatus
} from '$lib/server/teams';
import type { Actions, PageServerLoad } from './$types';

function publicOrigin(url: URL) {
	if (process.env.ORIGIN) {
		try {
			return new URL(process.env.ORIGIN).origin;
		} catch {
			/* fall through to the request origin */
		}
	}
	return url.origin;
}

export const load: PageServerLoad = async (event) => {
	const user = await requireUser(event);
	const team = await getTeamPage(event.params.teamId, user.id);
	if (!team) error(404, 'Not found');
	return { team, phaseLabels: PHASE_LABELS };
};

export const actions: Actions = {
	invite: async (event) => {
		const user = await requireUser(event);
		try {
			const token = await createInviteLink(user.id, event.params.teamId);
			return {
				inviteUrl: `${publicOrigin(event.url)}/invite/${token}`,
				message: 'Share this link. It works for 14 days, and anyone with it can join.'
			};
		} catch (err) {
			if (err instanceof HttpError) return fail(err.status, { message: err.message });
			throw err;
		}
	},
	revoke: async (event) => {
		const user = await requireUser(event);
		const form = await event.request.formData();
		try {
			await revokeInvite(user.id, event.params.teamId, String(form.get('inviteId') ?? ''));
			return { message: 'Invite revoked.' };
		} catch (err) {
			if (err instanceof HttpError) return fail(err.status, { message: err.message });
			throw err;
		}
	},
	email: async (event) => {
		const user = await requireUser(event);
		const form = await event.request.formData();
		const email = emailSchema.safeParse(form.get('email'));
		if (!email.success) return fail(400, { message: 'That email does not look right.' });
		try {
			const result = await inviteByEmail(user.id, event.params.teamId, email.data);
			const message =
				result.status === 'added'
					? 'They are on the team.'
					: result.status === 'already'
						? 'They are already on the team.'
						: 'They will join the next time they sign in with that email.';
			return { message };
		} catch (err) {
			if (err instanceof HttpError) return fail(err.status, { message: err.message });
			throw err;
		}
	},
	remove: async (event) => {
		const user = await requireUser(event);
		const form = await event.request.formData();
		try {
			await removeMember(user.id, event.params.teamId, String(form.get('userId') ?? ''));
			return { message: 'Removed from the team.' };
		} catch (err) {
			if (err instanceof HttpError) return fail(err.status, { message: err.message });
			throw err;
		}
	},
	actionStatus: async (event) => {
		const user = await requireUser(event);
		const form = await event.request.formData();
		const status = form.get('status') === 'done' ? 'done' : form.get('status') === 'open' ? 'open' : null;
		if (!status) return fail(400, { message: 'That status is not valid.' });
		try {
			await setTeamActionStatus(user.id, event.params.teamId, String(form.get('actionId') ?? ''), status);
			return { message: status === 'done' ? 'Action checked off.' : 'Action reopened.' };
		} catch (err) {
			if (err instanceof HttpError) return fail(err.status, { message: err.message });
			throw err;
		}
	}
};
