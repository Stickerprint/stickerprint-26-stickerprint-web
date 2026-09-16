import { loadEngine } from '$lib/server/pricing';
import { loadReviews } from '$lib/server/reviews';
import { loadFaqFor } from '$lib/server/faq';
import { estimatedShipDate, formatItDate } from '$lib/utils/shipping';
import type { PageServerLoad } from './$types';

/** Il kit ha un listino suo (src/lib/pricing/kit.ts); dal listino degli adesivi personalizzati prende materiali, lamine e IVA */
export const load: PageServerLoad = async ({ locals: { supabase } }) => {
	const [{ config }, { reviews, stats }, faq] = await Promise.all([loadEngine(supabase, 'adesivi_personalizzati'), loadReviews(supabase), loadFaqFor(supabase, 'kit_adesivi')]);
	const ship = estimatedShipDate(6);
	return { engine: config, reviews, stats, faq, shipDate: formatItDate(ship) };
};
