import { getInstagram } from '$lib/server/instagram';
import { loadReviews, type HomeReview } from '$lib/server/reviews';
export type { HomeReview };
import { estimatedShipDate, formatItDate } from '$lib/utils/shipping';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals: { supabase } }) => {
	const { reviews, stats } = await loadReviews(supabase);

	const instagram = await getInstagram();

	return {
		reviews,
		stats,
		instagram,
		shipDate: formatItDate(estimatedShipDate(5))
	};
};
