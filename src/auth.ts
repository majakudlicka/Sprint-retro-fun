import { SvelteKitAuth } from '@auth/sveltekit';
import Google from '@auth/sveltekit/providers/google';
import { googleSignInAllowed } from '$lib/domain/signin';
import '$lib/server/load-env';
import { acceptEmailInvites, upsertGoogleUser } from '$lib/server/users';

type GoogleProfile = {
	email?: string;
	email_verified?: boolean | string;
	name?: string;
	picture?: string;
	hd?: string;
};

function allowedDomain() {
	const raw = process.env.ALLOWED_EMAIL_DOMAIN?.trim().replace(/^@/, '').toLowerCase();
	return raw || undefined;
}

export const { handle, signIn, signOut } = SvelteKitAuth(async () => {
	const secret = process.env.AUTH_SECRET;
	const clientId = process.env.AUTH_GOOGLE_ID;
	const clientSecret = process.env.AUTH_GOOGLE_SECRET;
	if (!secret || !clientId || !clientSecret) {
		throw new Error('AUTH_SECRET, AUTH_GOOGLE_ID, and AUTH_GOOGLE_SECRET must be set');
	}
	const domain = allowedDomain();
	return {
		trustHost: true,
		secret,
		session: { strategy: 'jwt' },
		pages: { signIn: '/login', error: '/login' },
		providers: [
			Google({
				clientId,
				clientSecret,
				authorization: {
					params: {
						prompt: 'select_account',
						...(domain ? { hd: domain } : {})
					}
				}
			})
		],
		callbacks: {
			async redirect({ url, baseUrl }) {
				if (url.startsWith('/') && !url.startsWith('//')) return `${baseUrl}${url}`;
				try {
					if (new URL(url).origin === baseUrl) return url;
				} catch {
					/* ignore malformed callback targets */
				}
				return baseUrl;
			},
			async signIn({ profile }) {
				const google = (profile ?? {}) as GoogleProfile;
				const decision = googleSignInAllowed({
					email: google.email,
					emailVerified: google.email_verified,
					hostedDomain: google.hd,
					allowedDomain: domain
				});
				if (!decision.ok) return `/login?error=${decision.reason}`;
				return true;
			},
			async jwt({ token, profile }) {
				const google = profile as GoogleProfile | undefined;
				const email = google?.email ?? (typeof token.email === 'string' ? token.email : undefined);
				if (email && (google || typeof token.userId !== 'string')) {
					const user = await upsertGoogleUser({
						email,
						name: google?.name ?? (typeof token.name === 'string' ? token.name : email),
						image: google?.picture ?? (typeof token.picture === 'string' ? token.picture : null)
					});
					token.userId = user.id;
					token.email = user.email;
					token.name = user.name;
					token.picture = user.image ?? undefined;
					await acceptEmailInvites(user.id, user.email);
				}
				return token;
			},
			async session({ session, token }) {
				if (session.user && typeof token.userId === 'string') {
					session.user.id = token.userId;
				}
				return session;
			}
		}
	};
});
