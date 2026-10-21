import { loadFaq, type FaqCategory } from '$lib/server/faq';
import { LOCALES } from '$lib/i18n';
import { supportFaqFor } from '$lib/support-faq-lingue';
import type { PageServerLoad } from './$types';

/** le FAQ del database sono solo in italiano: nelle altre lingue si usano quelle statiche tradotte (src/lib/support-faq-lingue) */
export const load: PageServerLoad = async ({ locals: { supabase, locale } }) => {
	const lang = LOCALES[locale]?.lang ?? 'it';
	if (lang === 'it') return { categories: await loadFaq(supabase) };
	const categories: FaqCategory[] = supportFaqFor(lang).map((t, i) => ({ id: `s${i}`, slug: `s${i}`, name: t.title, product_slug: null, sort: i, active: true, items: t.faqs.map((f, j) => ({ id: `s${i}-${j}`, q: f.q, a: f.a, sort: j, active: true, products: [] })) }));
	return { categories };
};
