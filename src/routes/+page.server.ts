import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent }) => {
	const { devLogin } = await parent();
	return { devLogin };
};
