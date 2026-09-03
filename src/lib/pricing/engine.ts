/**
 * Motore di calcolo prezzi generico, guidato da una configurazione modificabile
 * dalla dashboard (tabella pricing_engines). Ogni prodotto ha il suo config.
 *
 * Formula (per ora la stessa del preventivatore di riferimento):
 *   prezzo lordo = round(base[qty] × fattore)
 *   fattore = max(sizeFloor, (w·h / refArea)^sizeExp) × materiale × finitura × sagoma
 */
export interface EngineOption { id: string; label: string; multiplier: number; description?: string; tag?: string; img?: string; equal?: boolean }
export interface EngineTier { qty: number; base: number; tag?: string }

export interface EngineConfig {
	version: number;
	currency: 'EUR';
	vat: number; // 1.22
	creditRate: number; // 0.05
	size: { refArea: number; exp: number; floor: number; minMm: number; maxMm: number; presets: number[] };
	shapes: EngineOption[];
	materials: EngineOption[];
	finishes: EngineOption[];
	tiers: EngineTier[];
}

export const DEFAULT_ADESIVI_PERSONALIZZATI: EngineConfig = {
	version: 1,
	currency: 'EUR',
	vat: 1.22,
	creditRate: 0.05,
	size: { refArea: 2500, exp: 0.46, floor: 0.68, minMm: 10, maxMm: 500, presets: [30, 50, 70, 100] },
	shapes: [
		{ id: 'sagomato', label: 'Sagomato', description: 'Forma libera', multiplier: 1.08, img: '/images/estimator/custom_stickers.webp' },
		{ id: 'tondo', label: 'Rotondo', description: 'Cerchio', multiplier: 1, img: '/images/estimator/round_stickers.webp', equal: true },
		{ id: 'quadrato', label: 'Quadrato', description: 'Angoli morbidi', multiplier: 1, img: '/images/estimator/square_stickers.webp', equal: true },
		{ id: 'ovale', label: 'Ovale', description: 'Ellisse', multiplier: 1, img: '/images/estimator/oval_stickers.webp' },
		{ id: 'rettangolare', label: 'Rettangolo', description: 'Orizzontale', multiplier: 1, img: '/images/estimator/rect_stickers.webp' }
	],
	materials: [
		{ id: 'bianco', label: 'Vinile bianco', description: 'Colori pieni e brillanti', multiplier: 1, tag: 'Più scelto', img: '/images/estimator/white.webp' },
		{ id: 'olografico', label: 'Olografico', description: 'Riflessi arcobaleno', multiplier: 1.38, img: '/images/estimator/olo.webp' },
		{ id: 'glitterato', label: 'Glitterato', description: 'Brillantini in superficie', multiplier: 1.35, img: '/images/estimator/glitter.webp' },
		{ id: 'trasparente', label: 'Trasparente', description: 'Effetto senza fondo', multiplier: 1.15, img: '/images/estimator/transparent.webp' },
		{ id: 'argento', label: 'Argento', description: 'Finitura metallizzata', multiplier: 1.4, img: '/images/estimator/silver.webp' },
		{ id: 'oro', label: 'Oro', description: 'Finitura metallizzata', multiplier: 1.42, img: '/images/estimator/gold.webp' }
	],
	finishes: [
		{ id: 'nessuna', label: 'Nessuna', description: 'Stampa a vista', multiplier: 1, img: '/images/estimator/lamina_nessuna.webp' },
		{ id: 'lucida', label: 'Lucida', description: 'Brillante, riflette la luce', multiplier: 1, img: '/images/estimator/lamina_lucida.webp' },
		{ id: 'opaca', label: 'Opaca', description: 'Elegante, senza riflessi', multiplier: 1, img: '/images/estimator/lamina_opaca.webp' }
	],
	tiers: [
		{ qty: 50, base: 47 },
		{ qty: 100, base: 53 },
		{ qty: 200, base: 61 },
		{ qty: 300, base: 67 },
		{ qty: 500, base: 79, tag: 'Consigliato' },
		{ qty: 1000, base: 108 },
		{ qty: 2000, base: 169 },
		{ qty: 3000, base: 224 },
		{ qty: 5000, base: 326 }
	]
};

/** Unisce un config salvato (anche parziale) con i valori di default */
export function mergeConfig(base: EngineConfig, saved: unknown): EngineConfig {
	if (!saved || typeof saved !== 'object') return base;
	const s = saved as Partial<EngineConfig>;
	return {
		...base,
		...s,
		size: { ...base.size, ...(s.size ?? {}) },
		shapes: Array.isArray(s.shapes) && s.shapes.length ? s.shapes : base.shapes,
		materials: Array.isArray(s.materials) && s.materials.length ? s.materials : base.materials,
		finishes: Array.isArray(s.finishes) && s.finishes.length ? s.finishes : base.finishes,
		tiers: Array.isArray(s.tiers) && s.tiers.length ? [...s.tiers].sort((a, b) => a.qty - b.qty) : base.tiers
	};
}

export function roundHalf(v: number): number {
	return Math.round(v * 2) / 2;
}

export function factorOf(cfg: EngineConfig, w: number, h: number, forma: string, materiale: string, finitura: string): number {
	const mult = (list: EngineOption[], id: string) => list.find((o) => o.id === id)?.multiplier ?? 1;
	const size = Math.max(cfg.size.floor, Math.pow((w * h) / cfg.size.refArea, cfg.size.exp));
	return size * mult(cfg.shapes, forma) * mult(cfg.materials, materiale) * mult(cfg.finishes, finitura);
}

export function tierPrice(tier: EngineTier, factor: number): number {
	return Math.round(tier.base * factor);
}

export interface Quote {
	gross: number;
	net: number;
	perPiece: number;
	credit: number;
	discountPct: number;
}

export function quoteWith(cfg: EngineConfig, o: { w: number; h: number; forma: string; materiale: string; finitura: string; qty: number; vatIncluded: boolean }): Quote {
	const factor = factorOf(cfg, o.w, o.h, o.forma, o.materiale, o.finitura);
	const tier = cfg.tiers.find((t) => t.qty === o.qty) ?? cfg.tiers[0];
	const gross = tierPrice(tier, factor);
	const net = gross / cfg.vat;
	const shown = o.vatIncluded ? gross : net;
	const basePer = tierPrice(cfg.tiers[0], factor) / cfg.tiers[0].qty;
	return {
		gross,
		net,
		perPiece: shown / o.qty,
		credit: net * cfg.creditRate,
		discountPct: Math.max(0, Math.round((1 - gross / o.qty / basePer) * 100))
	};
}

/** Misura consigliata dalla proporzione del file */
export function suggestedSize(ratio: number): [number, number] {
	const nearSquare = ratio > 0.85 && ratio < 1.18;
	if (nearSquare) return [50, 50];
	return ratio > 1 ? [70, Math.max(10, Math.round(70 / ratio))] : [Math.max(10, Math.round(70 * ratio)), 70];
}

export const eur0 = (v: number) => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v);
export const eur2 = (v: number) => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);

export const PRODUCT_ENGINES: { slug: string; name: string; href: string }[] = [
	{ slug: 'adesivi_personalizzati', name: 'Adesivi personalizzati', href: '/adesivi-personalizzati' },
	{ slug: 'adesivi_resinati', name: 'Adesivi resinati', href: '/adesivi-resinati' },
	{ slug: 'adesivi_rilievo', name: 'Adesivi in rilievo', href: '/adesivi-rilievo' },
	{ slug: 'etichette', name: 'Etichette in fogli', href: '/etichette' },
	{ slug: 'fogli_adesivi', name: 'Fogli di adesivi', href: '/fogli' },
	{ slug: 'vetrofanie', name: 'Vetrofanie', href: '/vetrofanie' }
];
