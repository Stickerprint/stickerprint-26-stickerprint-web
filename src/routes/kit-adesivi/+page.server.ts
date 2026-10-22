import { loadEngine } from '$lib/server/pricing';
import { loadReviews } from '$lib/server/reviews';
import { loadFaqFor } from '$lib/server/faq';
import { estimatedShipDate } from '$lib/utils/shipping';
import { LOCALES } from '$lib/i18n';
import { dataIn } from '$lib/traduzioni';
import type { PageServerLoad } from './$types';

/** Il kit ha un listino suo (src/lib/pricing/kit.ts); dal listino degli adesivi personalizzati prende materiali, lamine e IVA.
 *  La data di spedizione stimata esce gia' nel formato della lingua dell'URL (locals.locale). */
export const load: PageServerLoad = async ({ locals: { supabase, locale } }) => {
	const [{ config }, { reviews, stats }, faq] = await Promise.all([loadEngine(supabase, 'adesivi_personalizzati'), loadReviews(supabase, undefined, LOCALES[locale]?.lang ?? 'it'), loadFaqFor(supabase, 'kit_adesivi', LOCALES[locale]?.lang ?? 'it', locale)]);
	const ship = estimatedShipDate(6);
	return { engine: config, reviews, stats, faq, shipDate: dataIn(LOCALES[locale] ?? LOCALES.it, ship, true) };
};
