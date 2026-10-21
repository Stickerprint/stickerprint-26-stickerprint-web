import type { LayoutServerLoad } from './$types';
import { isProductionHost } from '$lib/seo';
import { PREVIEW_COOKIE } from '$lib/i18n';

export const load: LayoutServerLoad = async ({ locals, cookies, url }) => {
	const { session, user, locale, supabase } = locals;
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
		localeSuggerito: locals.localeSuggerito,
		/* anteprima delle lingue non ancora online (staff) */
		anteprimaLingue: cookies.get(PREVIEW_COOKIE) === '1',
		/* solo il dominio definitivo puo' essere indicizzato: altrove il layout mette noindex */
		indexable: isProductionHost(url.host),
		cookies: cookies.getAll()
	};
};
