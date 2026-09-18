/**
 * Stickerprint Studio — i prodotti e come si producono.
 * Il listino (sagome, materiali, finiture, misure) e' quello del sito: arriva da
 * `pricing_engines` con `loadEngine(slug)`. Qui c'e' solo quello che serve alla produzione.
 */
import type { CutSpot } from './spots';

export type StudioMode = 'sciolti' | 'fogli';

export interface StudioProduct {
	/** indirizzo nello studio: /studio/<id> */
	id: string;
	/** listino del sito da cui prendere sagome, materiali e finiture */
	engineSlug: string;
	name: string;
	img: string;
	/** una riga per la scheda della home */
	hint: string;
	engineProduct: 'sticker' | 'resinati';
	foglio?: boolean;
	rilievo?: boolean;
	vetro?: boolean;
	kit?: boolean;
	mode: StudioMode;
	/** taglio sui pezzi */
	pieceCut: CutSpot;
	/** taglio sul bordo del foglio (solo modo fogli) */
	sheetCut?: CutSpot;
	/** regole del foglio (solo modo fogli) */
	sheetRules?: 'resinati' | 'etichette';
	/** non ancora pronto nello studio */
	soon?: string;
}

export const STUDIO_PRODUCTS: StudioProduct[] = [
	{ id: 'adesivi-personalizzati', engineSlug: 'adesivi_personalizzati', name: 'Adesivi personalizzati', img: '/images/prodotti/adesivi-personalizzati/1.webp', hint: 'Passante · pezzi sciolti', engineProduct: 'sticker', mode: 'sciolti', pieceCut: 'Passante' },
	{ id: 'adesivi-resinati', engineSlug: 'adesivi_resinati', name: 'Adesivi resinati', img: '/images/prodotti/resinati/1.webp', hint: 'Mezzo taglio · fogli da 10 aghi', engineProduct: 'resinati', mode: 'fogli', pieceCut: 'CutContour', sheetCut: 'Passante', sheetRules: 'resinati' },
	{ id: 'adesivi-rilievo', engineSlug: 'adesivi_rilievo', name: 'Adesivi in rilievo', img: '/images/prodotti/rilievo/1.webp', hint: 'Passante · pezzi sciolti', engineProduct: 'sticker', rilievo: true, mode: 'sciolti', pieceCut: 'Passante' },
	{ id: 'etichette', engineSlug: 'etichette', name: 'Etichette in fogli', img: '/images/prodotti/etichette/1.webp', hint: 'Mezzo taglio · fogli circa A4', engineProduct: 'sticker', foglio: true, mode: 'fogli', pieceCut: 'CutContour', sheetCut: 'Passante', sheetRules: 'etichette' },
	{ id: 'vetrofanie', engineSlug: 'vetrofanie', name: 'Vetrofanie', img: '/images/prodotti/vetrofanie/1.webp', hint: 'Passante · pezzi sciolti', engineProduct: 'sticker', vetro: true, mode: 'sciolti', pieceCut: 'Passante' },
	{ id: 'kit-adesivi', engineSlug: 'adesivi_personalizzati', name: 'Kit di adesivi', img: '/images/prodotti/kit/1.webp', hint: 'Adesivi e cavallotto · passante', engineProduct: 'sticker', kit: true, mode: 'sciolti', pieceCut: 'Passante' },
	{ id: 'fogli-adesivi', engineSlug: 'fogli_adesivi', name: 'Fogli di adesivi', img: '/images/prodotti/fogli/1.webp', hint: 'Mezzo taglio · foglio con passante', engineProduct: 'sticker', mode: 'fogli', pieceCut: 'CutContour', sheetCut: 'Passante', soon: 'Il foglio con più design arriva nel prossimo passaggio.' }
];

export const studioProduct = (id: string) => STUDIO_PRODUCTS.find((p) => p.id === id) ?? null;

/** indirizzo dello studio per un ordine della dashboard (null se il prodotto non si lavora nello studio) */
export function studioOrderHref(productSlug: string | null | undefined, orderId: string): string | null {
	const p = productSlug === 'kit_adesivi' ? studioProduct('kit-adesivi') : STUDIO_PRODUCTS.find((x) => x.engineSlug === productSlug && !x.kit && !x.soon);
	return p ? `/studio/${p.id}?ordine=${encodeURIComponent(orderId)}` : null;
}

/** cavallotto del kit: rettangolo 80×40 a spigoli vivi (come sul sito) */
export const KIT_CAVALLOTTO = { w: 80, h: 40 };
