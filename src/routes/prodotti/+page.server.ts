import { loadEngine } from '$lib/server/pricing';
import { lowestPrice } from '$lib/pricing/engine';
import type { PageServerLoad } from './$types';

/** "A partire da" per ogni prodotto con listino (come in home); i kit hanno il prezzo fisso nella pagina */
export const load: PageServerLoad = async ({ locals: { supabase } }) => {
	const SLUGS = ['adesivi_personalizzati', 'adesivi_resinati', 'adesivi_rilievo', 'etichette', 'fogli_adesivi', 'vetrofanie'];
	const engines = await Promise.all(SLUGS.map((slug) => loadEngine(supabase, slug).then((e) => [slug, lowestPrice(e.config)] as const).catch((e) => { console.warn('[prodotti] prezzo minimo non disponibile', slug, e); return null; })));
	const fromPrices: Record<string, number> = {};
	for (const e of engines) if (e) fromPrices[e[0]] = e[1];
	return { fromPrices };
};
