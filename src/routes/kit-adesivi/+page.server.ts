import { loadEngine } from '$lib/server/pricing';
import { estimatedShipDate, formatItDate } from '$lib/utils/shipping';
import type { PageServerLoad } from './$types';

/** Il kit usa il listino degli adesivi personalizzati (materiali, lamine, prezzo per adesivo) */
export const load: PageServerLoad = async ({ locals: { supabase } }) => {
	const { config } = await loadEngine(supabase, 'adesivi_personalizzati');
	const ship = estimatedShipDate(6);
	return { engine: config, shipDate: formatItDate(ship) };
};
