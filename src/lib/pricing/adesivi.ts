/**
 * Listino adesivi personalizzati — replica del preventivatore di riferimento.
 * Prezzo (IVA inclusa) = round(base[qty] × fattore)
 * fattore = max(0.68, (w·h / 2500)^0.46) × moltiplicatore materiale × (1.08 se sagomato)
 * Il prezzo netto è prezzo/1.22; il credito Stickerprint è il 5% del netto.
 */

export interface ShapeOption { id: string; label: string; mini: string; img: string; equal?: boolean }
export interface MaterialOption { id: string; label: string; description: string; multiplier: number; tag?: string; swatch: string; img: string }
export interface FinishOption { id: string; label: string; description: string; multiplier: number; img: string }
export interface QtyTier { qty: number; base: number; tag?: string }

export const SHAPES: ShapeOption[] = [
	{ id: 'sagomato', label: 'Sagomato', mini: 'Forma libera', img: '/images/estimator/custom_stickers.webp' },
	{ id: 'tondo', label: 'Rotondo', mini: 'Cerchio', img: '/images/estimator/round_stickers.webp', equal: true },
	{ id: 'quadrato', label: 'Quadrato', mini: 'Angoli morbidi', img: '/images/estimator/square_stickers.webp', equal: true },
	{ id: 'ovale', label: 'Ovale', mini: 'Ellisse', img: '/images/estimator/oval_stickers.webp' },
	{ id: 'rettangolare', label: 'Rettangolo', mini: 'Orizzontale', img: '/images/estimator/rect_stickers.webp' }
];

export const MATERIALS: MaterialOption[] = [
	{ id: 'bianco', label: 'Vinile bianco', description: 'Colori pieni e brillanti', multiplier: 1, tag: 'Più scelto', swatch: '#fff', img: '/images/estimator/white.webp' },
	{ id: 'trasparente', label: 'Trasparente', description: 'Effetto senza fondo', multiplier: 1.15, swatch: 'repeating-conic-gradient(#cfd6dd 0 25%,#fff 0 50%) 0 0/8px 8px', img: '/images/estimator/transparent.webp' },
	{ id: 'olografico', label: 'Olografico', description: 'Riflessi arcobaleno', multiplier: 1.38, swatch: 'conic-gradient(from 210deg,#ff8ad6,#ffe37a,#8ef7c8,#8ad4ff,#c9a6ff,#ff8ad6)', img: '/images/estimator/olo.webp' },
	{ id: 'glitterato', label: 'Glitterato', description: 'Brillantini in superficie', multiplier: 1.35, swatch: 'radial-gradient(circle at 30% 30%,#fff,#cfd6de)', img: '/images/estimator/glitter.webp' },
	{ id: 'oro', label: 'Oro', description: 'Finitura metallizzata', multiplier: 1.42, swatch: 'linear-gradient(135deg,#f6df8c,#b9862a,#fff0b8,#8a5f16)', img: '/images/estimator/gold.webp' },
	{ id: 'argento', label: 'Argento', description: 'Finitura metallizzata', multiplier: 1.4, swatch: 'linear-gradient(135deg,#eef2f6,#9aa3ad,#fff,#8d949d)', img: '/images/estimator/silver.webp' }
];

export const FINISHES: FinishOption[] = [
	{ id: 'nessuna', label: 'Nessuna', description: 'Stampa a vista', multiplier: 1, img: '/images/estimator/lamina_nessuna.webp' },
	{ id: 'lucida', label: 'Lucida', description: 'Brillante, riflette la luce', multiplier: 1, img: '/images/estimator/lamina_lucida.webp' },
	{ id: 'opaca', label: 'Opaca', description: 'Elegante, senza riflessi', multiplier: 1, img: '/images/estimator/lamina_opaca.webp' }
];

export const QTY_TIERS: QtyTier[] = [
	{ qty: 50, base: 47 },
	{ qty: 100, base: 53 },
	{ qty: 200, base: 61 },
	{ qty: 300, base: 67 },
	{ qty: 500, base: 79, tag: 'Consigliato' },
	{ qty: 1000, base: 108 },
	{ qty: 2000, base: 169 },
	{ qty: 3000, base: 224 },
	{ qty: 5000, base: 326 }
];

export const SIZE_PRESETS: [number, number][] = [[30, 30], [50, 50], [70, 70], [100, 100]];
export const VAT = 1.22;
export const CREDIT_RATE = 0.05;
export const MIN_MM = 10;
export const MAX_MM = 500;

export function sizeFactor(w: number, h: number, materiale: string, forma: string, finitura = 'lucida'): number {
	const m = MATERIALS.find((x) => x.id === materiale)?.multiplier ?? 1;
	const f = FINISHES.find((x) => x.id === finitura)?.multiplier ?? 1;
	return Math.max(0.68, Math.pow((w * h) / 2500, 0.46)) * m * f * (forma === 'sagomato' ? 1.08 : 1);
}

/** Arrotonda al mezzo millimetro (50, 50,5, 51…) */
export function roundHalf(v: number): number {
	return Math.round(v * 2) / 2;
}

/** Prezzo IVA inclusa (intero, in euro) per una fascia di quantità */
export function tierPrice(tier: QtyTier, factor: number): number {
	return Math.round(tier.base * factor);
}

export interface Quote {
	gross: number; // IVA inclusa
	net: number; // IVA esclusa
	perPiece: number; // sul prezzo mostrato
	credit: number; // 5% del netto
	discountPct: number; // rispetto al prezzo/pezzo della fascia minima
}

export function quote(opts: { w: number; h: number; materiale: string; forma: string; finitura?: string; qty: number; vatIncluded: boolean }): Quote {
	const factor = sizeFactor(opts.w, opts.h, opts.materiale, opts.forma, opts.finitura);
	const tier = QTY_TIERS.find((t) => t.qty === opts.qty) ?? QTY_TIERS[0];
	const gross = tierPrice(tier, factor);
	const net = gross / VAT;
	const shown = opts.vatIncluded ? gross : net;
	const perPiece = shown / opts.qty;
	const basePerPiece = tierPrice(QTY_TIERS[0], factor) / QTY_TIERS[0].qty;
	const discountPct = Math.max(0, Math.round((1 - gross / opts.qty / basePerPiece) * 100));
	return { gross, net, perPiece, credit: net * CREDIT_RATE, discountPct };
}

/** Misura consigliata dalla proporzione del file (regola del preventivatore) */
export function suggestedSize(ratio: number): [number, number] {
	const nearSquare = ratio > 0.85 && ratio < 1.18;
	if (nearSquare) return [50, 50];
	return ratio > 1 ? [70, Math.max(10, Math.round(70 / ratio))] : [Math.max(10, Math.round(70 * ratio)), 70];
}

export const eur0 = (v: number) => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v);
export const eur2 = (v: number) => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);
