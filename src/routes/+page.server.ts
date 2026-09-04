import { getInstagram } from '$lib/server/instagram';
import { loadReviews, type HomeReview } from '$lib/server/reviews';
export type { HomeReview };
import { estimatedShipDate, formatItDate } from '$lib/utils/shipping';
import { loadEngine } from '$lib/server/pricing';
import { lowestPrice } from '$lib/pricing/engine';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals: { supabase } }) => {
	const { reviews, stats } = await loadReviews(supabase);

	const instagram = await getInstagram();

	// "a partire da" sulle card dei prodotti: dal listino attivo di ogni prodotto
	const fromPrices: Record<string, number> = {};
	for (const slug of ['adesivi_resinati', 'adesivi_personalizzati', 'adesivi_rilievo', 'etichette']) {
		try { fromPrices[slug] = lowestPrice((await loadEngine(supabase, slug)).config); } catch (e) { console.warn('[home] prezzo minimo non disponibile', slug, e); }
	}

	return {
		reviews,
		stats,
		instagram,
		fromPrices,
		shipDate: formatItDate(estimatedShipDate(5))
	};
};
