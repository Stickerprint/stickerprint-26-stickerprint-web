import { estimatedShipDate, formatItDate } from '$lib/utils/shipping';
import type { PageServerLoad } from './$types';

export interface HomeReview {
	title: string;
	comment: string;
	rating: number;
	product: string;
}

const PRODUCT_LABEL: Record<string, string> = {
	adesivi_personalizzati: 'Adesivi personalizzati',
	adesivi_resinati: 'Adesivi resinati',
	adesivi_rilievo: 'Adesivi a rilievo',
	etichette: 'Etichette',
	fogli_adesivi: 'Fogli adesivi',
	vetrofanie: 'Vetrofanie',
	campioni: 'Kit campioni'
};

const FALLBACK: HomeReview[] = [
	{ title: 'Effetto WOW!!!', comment: 'Mi sono servito spesso di servizi di stampa online, ma mai per gli adesivi. Ero un po’ prevenuto e invece… qualità incredibile.', rating: 5, product: 'Adesivi personalizzati' },
	{ title: 'Impeccabile', comment: 'Ordinare è davvero semplice, prima della conferma stampa ti inviano anche l’anteprima.', rating: 5, product: 'Etichette' },
	{ title: 'FOTONICI', comment: 'Processo di acquisto semplicissimo, assistenza impeccabile e prodotto FOTONICO! Assolutamente consigliati.', rating: 5, product: 'Adesivi resinati' },
	{ title: 'Fantastici!', comment: 'Seguita con pazienza fin dal momento dell’ordine, pacco ricevuto in pochissimi giorni.', rating: 5, product: 'Adesivi personalizzati' }
];

export const load: PageServerLoad = async ({ locals: { supabase } }) => {
	let reviews: HomeReview[] = FALLBACK;
	let stats = { total: 225, average: 4.9 };

	try {
		const [{ data: rows }, { count, data: all }] = await Promise.all([
			supabase
				.from('reviews')
				.select('title, comment, rating, order_item:order_items(product_type)')
				.eq('is_public', true)
				.gte('rating', 4)
				.order('created_at', { ascending: false })
				.limit(24),
			supabase.from('reviews').select('rating', { count: 'exact' }).eq('is_public', true)
		]);

		if (rows && rows.length >= 4) {
			reviews = rows
				.filter((r) => (r.comment ?? '').length >= 40)
				.slice(0, 4)
				.map((r) => {
					const item = Array.isArray(r.order_item) ? r.order_item[0] : r.order_item;
					return {
						title: r.title ?? 'Recensione',
						comment: r.comment ?? '',
						rating: r.rating ?? 5,
						product: PRODUCT_LABEL[item?.product_type ?? ''] ?? 'Ordine verificato'
					};
				});
			if (reviews.length < 4) reviews = FALLBACK;
		}
		if (count && all) {
			const avg = all.reduce((s, r) => s + (r.rating ?? 0), 0) / all.length;
			stats = { total: count, average: Math.round(avg * 10) / 10 };
		}
	} catch (e) {
		console.warn('[home] recensioni non disponibili, uso fallback', e);
	}

	return {
		reviews,
		stats,
		shipDate: formatItDate(estimatedShipDate(5))
	};
};
