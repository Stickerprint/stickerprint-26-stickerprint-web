import { loadPromos } from '$lib/server/promos';
import { loadEngine } from '$lib/server/pricing';
import type { EngineConfig } from '$lib/pricing/engine';
import { loadReviews } from '$lib/server/reviews';
import { estimatedShipDate, formatItDate } from '$lib/utils/shipping';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals: { supabase } }) => {
	const [promos, { reviews, stats }] = await Promise.all([loadPromos(supabase), loadReviews(supabase)]);
	// il preventivatore del prodotto in offerta si apre dentro la pagina: serve il suo listino
	const engines: Record<string, EngineConfig> = {};
	for (const slug of [...new Set(promos.map((p) => p.product_slug))]) engines[slug] = (await loadEngine(supabase, slug)).config;
	return { promos, reviews, stats, engines, shipDate: formatItDate(estimatedShipDate(5)) };
};
