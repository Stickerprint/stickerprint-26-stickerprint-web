import { loadEngine } from '$lib/server/pricing';
import { loadReviews } from '$lib/server/reviews';
import { estimatedShipDate, formatItDate } from '$lib/utils/shipping';
import type { PageServerLoad } from './$types';

/** Il kit ha un listino suo (src/lib/pricing/kit.ts); dal listino degli adesivi personalizzati prende materiali, lamine e IVA */
export const load: PageServerLoad = async ({ locals: { supabase } }) => {
	const [{ config }, { stats }] = await Promise.all([loadEngine(supabase, 'adesivi_personalizzati'), loadReviews(supabase)]);
	const ship = estimatedShipDate(6);
	return { engine: config, stats, shipDate: formatItDate(ship) };
};
