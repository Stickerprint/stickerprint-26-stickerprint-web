import { ga4Configured, ga4Missing, getGa4 } from '$lib/server/ga4';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url }) => {
	const days = Math.min(365, Math.max(7, Number(url.searchParams.get('giorni')) || 30));
	if (!ga4Configured()) return { configurato: false as const, mancanti: ga4Missing(), days };
	try { return { configurato: true as const, mancanti: [], days, ga: await getGa4(days), errore: null }; }
	catch (e) { return { configurato: true as const, mancanti: [], days, ga: null, errore: e instanceof Error ? e.message : 'Errore' }; }
};
