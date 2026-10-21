import { getInstagram } from '$lib/server/instagram';
import { loadReviews, type HomeReview } from '$lib/server/reviews';
export type { HomeReview };
import { estimatedShipDate } from '$lib/utils/shipping';
import { loadEngine } from '$lib/server/pricing';
import { lowestPrice } from '$lib/pricing/engine';
import type { PageServerLoad } from './$types';

const localeNoon = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}T12:00:00`;

export const load: PageServerLoad = async ({ locals: { supabase } }) => {
	// tutto in parallelo: recensioni, feed Instagram (con cache) e listini (con cache)
	const SLUGS = ['adesivi_resinati', 'adesivi_personalizzati', 'adesivi_rilievo', 'etichette'];
	const [{ reviews, stats }, instagram, engines] = await Promise.all([
		loadReviews(supabase),
		getInstagram(),
		Promise.all(SLUGS.map((slug) => loadEngine(supabase, slug).then((e) => [slug, lowestPrice(e.config)] as const).catch((e) => { console.warn('[home] prezzo minimo non disponibile', slug, e); return null; })))
	]);
	// "a partire da" sulle card dei prodotti: dal listino attivo di ogni prodotto
	const fromPrices: Record<string, number> = {};
	for (const e of engines) if (e) fromPrices[e[0]] = e[1];

	return {
		reviews,
		stats,
		instagram,
		fromPrices,
		// data di spedizione stimata come "YYYY-MM-DDT12:00:00" (mezzogiorno locale, senza fuso): la pagina la scrive nella lingua
		// del visitatore con data(); senza fuso il giorno resta lo stesso su server e browser
		shipAt: localeNoon(estimatedShipDate(5))
	};
};
