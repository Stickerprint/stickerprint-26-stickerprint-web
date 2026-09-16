import type { LayoutServerLoad } from './$types';
import { isProductionHost } from '$lib/seo';

export const load: LayoutServerLoad = async ({ locals: { session, user, locale, supabase }, cookies, url }) => {
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
		/* solo il dominio definitivo puo' essere indicizzato: altrove il layout mette noindex */
		indexable: isProductionHost(url.host),
		cookies: cookies.getAll()
	};
};
