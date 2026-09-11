import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals: { session, user, locale, supabase }, cookies }) => {
	/* foto profilo per l'header (si aggiorna con invalidateAll dopo il caricamento nell'area personale) */
	let avatar: string | null = null;
	if (user) {
		const { data } = await supabase.from('profiles').select('avatar_url').eq('id', user.id).maybeSingle();
		avatar = data?.avatar_url ?? null;
	}
	return {
		session,
		user,
		avatar,
		locale,
		cookies: cookies.getAll()
	};
};
