import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals: { session, user, locale }, cookies }) => {
	return {
		session,
		user,
		locale,
		cookies: cookies.getAll()
	};
};
