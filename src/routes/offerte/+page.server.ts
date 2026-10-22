import { loadPromos } from '$lib/server/promos';
import { langOf } from '$lib/i18n';
import { loadEngine } from '$lib/server/pricing';
import type { EngineConfig } from '$lib/pricing/engine';
import { loadReviews } from '$lib/server/reviews';
import { estimatedShipDate } from '$lib/utils/shipping';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals: { supabase, locale } }) => {
	const [promos, { reviews, stats }] = await Promise.all([loadPromos(supabase, false, langOf(locale)), loadReviews(supabase, undefined, langOf(locale))]);
	// il preventivatore del prodotto in offerta si apre dentro la pagina: serve il suo listino
	const engines: Record<string, EngineConfig> = {};
	for (const slug of [...new Set(promos.map((p) => p.product_slug))]) engines[slug] = (await loadEngine(supabase, slug)).config;
	/* le date si formattano nella pagina con data() nella lingua del visitatore */
	return { promos, reviews, stats, engines, shipDate: estimatedShipDate(5).toISOString(), deliveryDate: estimatedShipDate(7).toISOString() };
};
