import { dev } from '$app/environment';

export function devLoginAvailable(hostname: string) {
	return (
		dev &&
		process.env.NODE_ENV !== 'production' &&
		(hostname === 'localhost' || hostname === '127.0.0.1') &&
		Boolean(process.env.DEV_LOGIN_SECRET)
	);
}
