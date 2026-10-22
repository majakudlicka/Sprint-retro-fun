import { json, redirect, type Handle } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';
import { handle as authHandle } from './auth';

const PUBLIC_EXACT = new Set(['/', '/login', '/signout', '/health', '/dev/login']);

function isPublic(pathname: string) {
	if (PUBLIC_EXACT.has(pathname)) return true;
	if (pathname === '/auth' || pathname.startsWith('/auth/')) return true;
	if (pathname.startsWith('/_app/')) return true;
	if (pathname === '/favicon.svg' || pathname === '/favicon.ico' || pathname === '/robots.txt') return true;
	return false;
}

const guard: Handle = async ({ event, resolve }) => {
	if (!isPublic(event.url.pathname)) {
		const session = await event.locals.auth();
		if (!session?.user?.id) {
			if (event.url.pathname.startsWith('/api/')) {
				return json({ error: 'Sign in required' }, { status: 401 });
			}
			redirect(303, '/login');
		}
	}
	const response = await resolve(event);
	response.headers.set('X-Content-Type-Options', 'nosniff');
	response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
	response.headers.set('X-Frame-Options', 'DENY');
	response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
	return response;
};

export const handle = sequence(authHandle, guard);
