import { loadReviews } from '$lib/server/reviews';
import { loadEngine } from '$lib/server/pricing';
import { estimatedShipDate, formatItDate } from '$lib/utils/shipping';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals: { supabase } }) => {
	const [{ reviews, stats }, { config }] = await Promise.all([loadReviews(supabase, 'adesivi_personalizzati'), loadEngine(supabase, 'adesivi_personalizzati')]);
	const ship = estimatedShipDate(5);
	return {
		engine: config,
		reviews,
		stats,
		shipDate: formatItDate(ship),
		shipShort: new Intl.DateTimeFormat('it-IT', { day: '2-digit', month: '2-digit' }).format(ship)
	};
};
