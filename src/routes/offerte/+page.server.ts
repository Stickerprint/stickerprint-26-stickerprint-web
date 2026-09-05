import { loadPromos } from '$lib/server/promos';
import { loadReviews } from '$lib/server/reviews';
import { estimatedShipDate, formatItDate } from '$lib/utils/shipping';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals: { supabase } }) => {
	const [promos, { reviews, stats }] = await Promise.all([loadPromos(supabase), loadReviews(supabase)]);
	return { promos, reviews, stats, shipDate: formatItDate(estimatedShipDate(5)) };
};
