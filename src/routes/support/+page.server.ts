import { loadFaq } from '$lib/server/faq';
import { LOCALES } from '$lib/i18n';
import type { PageServerLoad } from './$types';

/** FAQ dal database nella lingua del sito (traduzioni in colonna tr o in src/lib/contenuti-tradotti; statiche come riserva) */
export const load: PageServerLoad = async ({ locals: { supabase, locale } }) => {
	const lang = LOCALES[locale]?.lang ?? 'it';
	return { categories: await loadFaq(supabase, false, lang) };
};
