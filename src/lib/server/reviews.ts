import type { SupabaseClient } from '@supabase/supabase-js';
import { shortName } from '$lib/utils/names';

export interface HomeReview {
	author: string;
	title: string;
	comment: string;
	rating: number;
	product: string;
	href: string;
	productType?: string;
	date?: string;
	/** 'ordine' = cliente che ha acquistato sul sito; altrimenti il canale dove l'abbiamo ricevuta (es. Google) */
	source?: string;
	/** true solo per le recensioni vere del database (mai per quelle di esempio): sono le uniche che finiscono nei dati strutturati */
	real?: boolean;
	dateIso?: string;
}

export const PRODUCTS: Record<string, { label: string; href: string }> = {
	adesivi_personalizzati: { label: 'Adesivi personalizzati', href: '/adesivi-personalizzati' },
	adesivi_resinati: { label: 'Adesivi resinati', href: '/adesivi-resinati' },
	adesivi_rilievo: { label: 'Adesivi a rilievo', href: '/adesivi-rilievo' },
	etichette: { label: 'Etichette', href: '/etichette' },
	fogli_adesivi: { label: 'Fogli adesivi', href: '/fogli' },
	vetrofanie: { label: 'Vetrofanie', href: '/vetrofanie' },
	campioni: { label: 'Kit campioni', href: '/campioni' }
};


export interface ReviewsResult {
	reviews: HomeReview[];
	stats: { total: number; average: number; real?: boolean };
}

/**
 * Recensioni pubbliche da Supabase (tabella `reviews`): solo quelle vere, approvate.
 * `productType` limita alle recensioni di un prodotto (es. adesivi_personalizzati).
 */
/* cache in memoria (5 minuti, rinnovo in sottofondo): le recensioni non cambiano ogni secondo
   e la home non deve aspettare il database a ogni visita */
const REV_MS = 60 * 1000;
const revCache = new Map<string, { at: number; value: ReviewsResult }>();
export function invalidateReviews() { revCache.clear(); }
export async function loadReviews(supabase: SupabaseClient, productType?: string): Promise<ReviewsResult> {
	const key = productType ?? '*';
	const hit = revCache.get(key);
	if (hit && Date.now() - hit.at < REV_MS) return hit.value;
	const p = loadReviewsFresh(supabase, productType).then((v) => { revCache.set(key, { at: Date.now(), value: v }); return v; });
	if (hit) { p.catch(() => {}); return hit.value; }
	return p;
}

async function loadReviewsFresh(supabase: SupabaseClient, productType?: string): Promise<ReviewsResult> {
	/* solo recensioni vere dal database: in home tutte, nella pagina prodotto solo quelle di quel prodotto (niente riempitivi) */
	let reviews: HomeReview[] = [];
	let stats: ReviewsResult['stats'] = { total: 0, average: 0 };

	try {
		/* MEDIA E CONTEGGIO: su TUTTE le recensioni pubbliche, di qualunque voto. Per un prodotto solo le sue;
		   per la home tutte, di tutti i prodotti. Le cifre di partenza restano finche' non ci sono almeno 3 recensioni vere. */
		let qs = supabase.from('reviews').select('rating').eq('is_public', true).eq('status', 'approved');
		if (productType) qs = qs.eq('product_slug', productType);
		const { data: all } = await qs;
		if (all && all.length) {
			const avg = all.reduce((s, r) => s + (r.rating ?? 0), 0) / all.length;
			stats = { total: all.length, average: Math.round(avg * 10) / 10, real: true };
		}
		/* ELENCO MOSTRATO: le migliori con un commento vero. Schema del nuovo sito: reviews → orders (prodotto,
		   nome di spedizione) e profiles (nome dell'utente); le recensioni degli ospiti hanno il nome nella colonna author */
		let q = supabase
			.from('reviews')
			.select('title, comment, rating, created_at, author, product_slug, source, source_note, order:orders(product_slug, shipping), profile:profiles(full_name)')
			.eq('is_public', true).eq('status', 'approved')
			.gte('rating', 4)
			.order('created_at', { ascending: false })
			.limit(300);
		if (productType) q = q.eq('product_slug', productType);
		const { data: rows } = await q;

		if (rows && rows.length) {
			const mapped = rows
				.filter((r) => (r.comment ?? '').trim().length > 0)
				.map((r) => {
					const order = (Array.isArray(r.order) ? r.order[0] : r.order) as { product_slug?: string; shipping?: { first_name?: string; last_name?: string } } | null;
					const profile = (Array.isArray(r.profile) ? r.profile[0] : r.profile) as { full_name?: string } | null;
					const type = r.product_slug ?? order?.product_slug ?? productType ?? 'adesivi_personalizzati';
					const p = PRODUCTS[type] ?? PRODUCTS.adesivi_personalizzati;
					const name = r.author || profile?.full_name || [order?.shipping?.first_name, order?.shipping?.last_name].filter(Boolean).join(' ') || 'Cliente';
					return {
						author: shortName(name),
						title: r.title ?? 'Recensione',
						comment: r.comment ?? '',
						rating: r.rating ?? 5,
						product: p.label,
						href: p.href,
						productType: type,
						source: r.source === 'staff' ? (r.source_note ? `Ricevuta ${r.source_note}` : 'Ricevuta su altro canale') : 'ordine',
						date: r.created_at ? new Intl.DateTimeFormat('it-IT', { month: 'long', year: 'numeric' }).format(new Date(r.created_at)) : undefined,
						dateIso: r.created_at ? String(r.created_at).slice(0, 10) : undefined,
						real: true
					};
				});
			reviews = mapped;
		}
	} catch (e) {
		console.warn('[reviews] uso fallback', e);
	}
	return { reviews, stats };
}
