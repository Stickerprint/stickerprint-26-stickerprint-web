import { PRODUCTS } from '$lib/products';
import { loadEngine } from '$lib/server/pricing';
import { loadReviews } from '$lib/server/reviews';
import { loadFaqFor } from '$lib/server/faq';
import { estimatedShipDate, formatItDate } from '$lib/utils/shipping';
import type { PageServerLoad } from './$types';

const SLUG = 'fogli_adesivi';

export const load: PageServerLoad = async ({ locals: { supabase } }) => {
	const [{ reviews, stats }, { config }, faq] = await Promise.all([loadReviews(supabase, SLUG), loadEngine(supabase, SLUG), loadFaqFor(supabase, SLUG)]);
	const ship = estimatedShipDate(5);
	return {
		product: PRODUCTS[SLUG],
		engine: config,
		reviews,
		stats,
		faq,
		shipDate: formatItDate(ship),
		shipShort: new Intl.DateTimeFormat('it-IT', { day: '2-digit', month: '2-digit' }).format(ship)
	};
};
