import { json, type RequestHandler } from '@sveltejs/kit';
import { requestOriginAllowed } from '$lib/domain/origin';
import { executeCommand } from '$lib/server/commands';
import { HttpError } from '$lib/server/http';

export const POST: RequestHandler = async (event) => {
	const session = await event.locals.auth();
	if (!session?.user?.id) return json({ error: 'Sign in required' }, { status: 401 });
	if (!requestOriginAllowed(event.request.headers.get('origin'), event.url.host, process.env.ORIGIN)) {
		return json({ error: 'Cross-site request blocked' }, { status: 403 });
	}
	const raw = await event.request.text();
	if (raw.length > 20_000) return json({ error: 'Too large' }, { status: 413 });
	let body: unknown;
	try {
		body = JSON.parse(raw);
	} catch {
		return json({ error: 'That input is not valid' }, { status: 400 });
	}
	try {
		const retroId = event.params.retroId;
		if (!retroId) return json({ error: 'Not found' }, { status: 404 });
		const retro = await executeCommand(session.user.id, retroId, body);
		return json({ retro });
	} catch (error) {
		if (error instanceof HttpError) return json({ error: error.message }, { status: error.status });
		console.error(error instanceof Error ? error.message : 'retro command failed');
		return json({ error: 'Something went wrong' }, { status: 500 });
	}
};
