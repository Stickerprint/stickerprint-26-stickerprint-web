import { PRODUCTS } from '$lib/products';
import { productFor } from '$lib/prodotti-testi';
import { LOCALES } from '$lib/i18n';
import { dataIn } from '$lib/traduzioni';
import { loadEngine } from '$lib/server/pricing';
import { loadReviews } from '$lib/server/reviews';
import { loadFaqFor } from '$lib/server/faq';
import { estimatedShipDate } from '$lib/utils/shipping';
import type { PageServerLoad } from './$types';

const SLUG = 'adesivi_rilievo';

export const load: PageServerLoad = async ({ locals: { supabase, locale: code } }) => {
	/* testi del prodotto nella lingua della pagina; le FAQ del database sono solo in italiano, nelle altre lingue si usano quelle del prodotto */
	const locale = LOCALES[code] ?? LOCALES.it;
	const lang = locale.lang;
	const [{ reviews, stats }, { config }, faq] = await Promise.all([loadReviews(supabase, SLUG, lang), loadEngine(supabase, SLUG), loadFaqFor(supabase, SLUG, lang, code)]);
	const ship = estimatedShipDate(5);
	return {
		product: productFor(SLUG, lang) ?? PRODUCTS[SLUG],
		engine: config,
		reviews,
		stats,
		faq,
		shipDate: dataIn(locale, ship, true),
		shipShort: new Intl.DateTimeFormat(locale.intl, { day: '2-digit', month: '2-digit' }).format(ship)
	};
};
