import { loadReviews } from '$lib/server/reviews';
import { estimatedShipDate, formatItDate } from '$lib/utils/shipping';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals: { supabase } }) => {
	const { reviews, stats } = await loadReviews(supabase, 'adesivi_personalizzati');
	const ship = estimatedShipDate(5);
	return {
		reviews,
		stats,
		shipDate: formatItDate(ship),
		shipShort: new Intl.DateTimeFormat('it-IT', { day: '2-digit', month: '2-digit' }).format(ship)
	};
};
