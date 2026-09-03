import { PRODUCTS } from '$lib/products';
import { loadEngine } from '$lib/server/pricing';
import { loadReviews } from '$lib/server/reviews';
import { estimatedShipDate, formatItDate } from '$lib/utils/shipping';
import type { PageServerLoad } from './$types';

const SLUG = 'adesivi_rilievo';

export const load: PageServerLoad = async ({ locals: { supabase } }) => {
	const [{ reviews, stats }, { config }] = await Promise.all([loadReviews(supabase, SLUG), loadEngine(supabase, SLUG)]);
	const ship = estimatedShipDate(5);
	return {
		product: PRODUCTS[SLUG],
		engine: config,
		reviews,
		stats,
		shipDate: formatItDate(ship),
		shipShort: new Intl.DateTimeFormat('it-IT', { day: '2-digit', month: '2-digit' }).format(ship)
	};
};
