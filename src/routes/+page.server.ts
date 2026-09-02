import { getInstagram } from '$lib/server/instagram';
import { shortName } from '$lib/utils/names';
import { estimatedShipDate, formatItDate } from '$lib/utils/shipping';
import type { PageServerLoad } from './$types';

export interface HomeReview {
	author: string;
	title: string;
	comment: string;
	rating: number;
	product: string;
	href: string;
	date?: string;
}

const PRODUCTS: Record<string, { label: string; href: string }> = {
	adesivi_personalizzati: { label: 'Adesivi personalizzati', href: '/adesivi-personalizzati' },
	adesivi_resinati: { label: 'Adesivi resinati', href: '/adesivi-resinati' },
	adesivi_rilievo: { label: 'Adesivi a rilievo', href: '/adesivi-rilievo' },
	etichette: { label: 'Etichette', href: '/etichette' },
	fogli_adesivi: { label: 'Fogli adesivi', href: '/fogli' },
	vetrofanie: { label: 'Vetrofanie', href: '/vetrofanie' },
	campioni: { label: 'Kit campioni', href: '/campioni' }
};

const FALLBACK: HomeReview[] = [
	{ author: 'Mattia B.', title: 'Effetto WOW!!!', comment: 'Devo essere sincero: mi sono servito spesso di servizi di stampa online, ma mai per gli adesivi. Ero un po’ prevenuto e invece… qualità incredibile, colori pieni e taglio perfetto.', rating: 5, product: 'Adesivi personalizzati', href: '/adesivi-personalizzati' },
	{ author: 'Giulia R.', title: 'Impeccabile', comment: 'Tutto impeccabile, ordinare su questo sito è davvero molto semplice, prima della conferma stampa ti inviano anche l’anteprima.', rating: 5, product: 'Etichette', href: '/etichette' },
	{ author: 'Luca F.', title: 'FOTONICI', comment: 'Processo di acquisto semplicissimo, assistenza impeccabile e prodotto FOTONICO! Assolutamente consigliati.', rating: 5, product: 'Adesivi resinati', href: '/adesivi-resinati' },
	{ author: 'Sara M.', title: 'Fantastici!', comment: 'Potessi metterei 1000 stelle! Son stata seguita con pazienza fin dal momento dell’ordine, ho ricevuto il pacco in pochissimi giorni.', rating: 5, product: 'Adesivi personalizzati', href: '/adesivi-personalizzati' },
	{ author: 'Andrea C.', title: 'Esperienza e serietà', comment: 'Seri, puntuali e con esperienza. Ho effettuato il mio ordine, mi hanno mandato velocemente la bozza e ho subito dato l’ok.', rating: 5, product: 'Etichette', href: '/etichette' },
	{ author: 'Elena P.', title: 'Adesivi 🔝', comment: 'Adesivi fatti veramente bene, stupendi, top. Super qualità di stampa e materiale resistente.', rating: 5, product: 'Adesivi personalizzati', href: '/adesivi-personalizzati' }
];

export const load: PageServerLoad = async ({ locals: { supabase } }) => {
	let reviews: HomeReview[] = FALLBACK;
	let stats = { total: 225, average: 4.9 };

	try {
		const [{ data: rows }, { count, data: all }] = await Promise.all([
			supabase
				.from('reviews')
				.select('title, comment, rating, created_at, guest_name, customer_name, order_item:order_items(product_type)')
				.eq('is_public', true)
				.gte('rating', 4)
				.order('created_at', { ascending: false })
				.limit(40),
			supabase.from('reviews').select('rating', { count: 'exact' }).eq('is_public', true)
		]);

		if (rows && rows.length >= 6) {
			const mapped = rows
				.filter((r) => (r.comment ?? '').length >= 30)
				.slice(0, 12)
				.map((r) => {
					const item = Array.isArray(r.order_item) ? r.order_item[0] : r.order_item;
					const p = PRODUCTS[item?.product_type ?? ''] ?? { label: 'Adesivi personalizzati', href: '/adesivi-personalizzati' };
					return {
						author: shortName(r.customer_name ?? r.guest_name),
						title: r.title ?? 'Recensione',
						comment: r.comment ?? '',
						rating: r.rating ?? 5,
						product: p.label,
						href: p.href,
						date: r.created_at ? new Intl.DateTimeFormat('it-IT', { month: 'long', year: 'numeric' }).format(new Date(r.created_at)) : undefined
					};
				});
			if (mapped.length >= 6) reviews = mapped;
		}
		if (count && all) {
			const avg = all.reduce((s, r) => s + (r.rating ?? 0), 0) / all.length;
			stats = { total: count, average: Math.round(avg * 10) / 10 };
		}
	} catch (e) {
		console.warn('[home] recensioni non disponibili, uso fallback', e);
	}

	const instagram = await getInstagram();

	return {
		reviews,
		stats,
		instagram,
		shipDate: formatItDate(estimatedShipDate(5))
	};
};
