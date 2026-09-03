/**
 * Motore di calcolo prezzi A COSTI — replica del foglio "custom price calculator.xlsx".
 * Tutto ciò che sta in `EngineConfig` è modificabile dalla dashboard, per ogni prodotto.
 *
 * Per un ordine (w × h mm, quantità, materiale, finitura):
 *   m²        = w·h / 1.000.000 × quantità
 *   cm²       = w·h / 100 × quantità
 *   vendita   = costo × (1 + ricarico)
 *   CR        = commercial range: fattore in base ai m² totali (0→1,15 … 100→0,60)
 *   PR        = price range: fattore in base alla quantità (1→1,30 … 20000→0,60)
 *   materiale = vendita materiale €/m² × m² × CR × PR
 *   stampa    = vendita stampa €/m²   × m² × CR × PR
 *   lamina    = vendita plastifica €/m² × m² × CR × PR   (solo se la finitura la prevede)
 *   resina    = vendita resina €/cm² × cm² × PR           (solo prodotti resinati; nel foglio non ha il CR)
 *   extra     = lavorazione €/pezzo × quantità            (voce nostra, default 0)
 *   netto     = materiale + stampa + lamina + resina + extra + avvio produzione
 *   netto     = max(netto, prezzo minimo per pezzo × quantità)  (voce nostra, default 0)
 *   lordo     = netto × IVA
 */

export interface CostItem { costM2: number; markup: number } // markup 0 = nessun ricarico, 0.5 = +50%
export interface MaterialOption extends CostItem { id: string; label: string; description?: string; tag?: string; img?: string; visible: boolean }
export interface FinishOption { id: string; label: string; description?: string; img?: string; laminate: boolean; visible: boolean }
export interface ShapeOption { id: string; label: string; description?: string; img?: string; equal?: boolean; visible: boolean }
export interface RangeStep { from: number; factor: number }

export interface EngineConfig {
	version: 2;
	vat: number;
	creditRate: number;
	setup: number; // avvio produzione, una tantum
	print: CostItem;
	laminate: CostItem;
	resin: { enabled: boolean; costKg: number; gramsPerCm2: number; markup: number };
	extraPerPiece: number; // lavorazione per pezzo (taglio, confezionamento)
	minPerPiece: number; // prezzo minimo netto per pezzo
	commercialRange: RangeStep[]; // per m² totali
	priceRange: RangeStep[]; // per quantità
	quantities: number[]; // fasce mostrate al cliente
	recommendedQty: number;
	size: { minMm: number; maxMm: number; presets: number[] };
	shapes: ShapeOption[];
	materials: MaterialOption[];
	finishes: FinishOption[];
	ui: { showFinish: boolean; showMaterials: boolean; showShapes: boolean };
}

const IMG = '/images/estimator';

const ALL_MATERIALS: MaterialOption[] = [
	{ id: 'bianco', label: 'Bianco', description: 'Vinile bianco standard', tag: 'Più scelto', img: `${IMG}/white.webp`, costM2: 4, markup: 0, visible: true },
	{ id: 'super', label: 'Bianco super adesivo', description: 'Per superfici difficili', img: `${IMG}/white.webp`, costM2: 6.7, markup: 0, visible: false },
	{ id: 'olografico', label: 'Olografico', description: 'Riflessi arcobaleno', img: `${IMG}/olo.webp`, costM2: 13.9, markup: 0, visible: true },
	{ id: 'glitterato', label: 'Glitterato', description: 'Brillantini in superficie', img: `${IMG}/glitter.webp`, costM2: 14.5, markup: 0, visible: true },
	{ id: 'trasparente', label: 'Trasparente', description: 'Effetto senza fondo', img: `${IMG}/transparent.webp`, costM2: 4.3, markup: 0, visible: true },
	{ id: 'argento', label: 'Argento', description: 'Cromo argento', img: `${IMG}/silver.webp`, costM2: 13.9, markup: 0, visible: true },
	{ id: 'oro', label: 'Oro', description: 'Cromo oro', img: `${IMG}/gold.webp`, costM2: 11.3, markup: 0, visible: true }
];

const ALL_SHAPES: ShapeOption[] = [
	{ id: 'sagomato', label: 'Sagomato', description: 'Forma libera', img: `${IMG}/custom_stickers.webp`, visible: true },
	{ id: 'tondo', label: 'Rotondo', description: 'Cerchio', img: `${IMG}/round_stickers.webp`, equal: true, visible: true },
	{ id: 'quadrato', label: 'Quadrato', description: 'Angoli morbidi', img: `${IMG}/square_stickers.webp`, equal: true, visible: true },
	{ id: 'ovale', label: 'Ovale', description: 'Ellisse', img: `${IMG}/oval_stickers.webp`, visible: true },
	{ id: 'rettangolare', label: 'Rettangolo', description: 'Orizzontale', img: `${IMG}/rect_stickers.webp`, visible: true }
];

const ALL_FINISHES: FinishOption[] = [
	{ id: 'nessuna', label: 'Nessuna', description: 'Stampa a vista', img: `${IMG}/lamina_nessuna.webp`, laminate: false, visible: true },
	{ id: 'lucida', label: 'Lucida', description: 'Brillante, riflette la luce', img: `${IMG}/lamina_lucida.webp`, laminate: true, visible: true },
	{ id: 'opaca', label: 'Opaca', description: 'Elegante, senza riflessi', img: `${IMG}/lamina_opaca.webp`, laminate: true, visible: true }
];

const COMMERCIAL_RANGE: RangeStep[] = [
	{ from: 0, factor: 1.15 }, { from: 3, factor: 1 }, { from: 5, factor: 0.9 }, { from: 10, factor: 0.8 },
	{ from: 20, factor: 0.75 }, { from: 50, factor: 0.7 }, { from: 70, factor: 0.65 }, { from: 100, factor: 0.6 }
];
const PRICE_RANGE: RangeStep[] = [
	{ from: 1, factor: 1.3 }, { from: 50, factor: 1.25 }, { from: 100, factor: 1.2 }, { from: 500, factor: 1.15 },
	{ from: 1000, factor: 1.1 }, { from: 1500, factor: 1 }, { from: 2000, factor: 0.95 }, { from: 5000, factor: 0.85 },
	{ from: 7500, factor: 0.8 }, { from: 10000, factor: 0.75 }, { from: 12500, factor: 0.7 }, { from: 15000, factor: 0.65 }, { from: 20000, factor: 0.6 }
];

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v));

function base(over: Partial<EngineConfig> = {}): EngineConfig {
	return {
		version: 2,
		vat: 1.22,
		creditRate: 0.05,
		setup: 50,
		print: { costM2: 4, markup: 0 },
		laminate: { costM2: 4, markup: 0 },
		resin: { enabled: false, costKg: 10.9, gramsPerCm2: 0.15, markup: 1.5 },
		extraPerPiece: 0,
		minPerPiece: 0,
		commercialRange: clone(COMMERCIAL_RANGE),
		priceRange: clone(PRICE_RANGE),
		quantities: [50, 100, 200, 300, 500, 1000, 2000, 3000, 5000],
		recommendedQty: 500,
		size: { minMm: 10, maxMm: 500, presets: [30, 50, 70, 100] },
		shapes: clone(ALL_SHAPES),
		materials: clone(ALL_MATERIALS),
		finishes: clone(ALL_FINISHES),
		ui: { showFinish: true, showMaterials: true, showShapes: true },
		...over
	};
}

function withMaterials(ids: string[]): MaterialOption[] {
	return clone(ALL_MATERIALS).map((m) => ({ ...m, visible: ids.includes(m.id) }));
}

/** Listini iniziali per prodotto (poi modificabili dalla dashboard) */
export const DEFAULT_ENGINES: Record<string, EngineConfig> = {
	adesivi_personalizzati: base(),
	adesivi_rilievo: base(),
	etichette: base(),
	fogli_adesivi: base(),
	adesivi_resinati: base({
		materials: withMaterials(['bianco', 'super', 'trasparente', 'oro', 'argento']),
		resin: { enabled: true, costKg: 10.9, gramsPerCm2: 0.15, markup: 1.5 },
		ui: { showFinish: false, showMaterials: true, showShapes: true }
	}),
	vetrofanie: base({
		materials: withMaterials(['trasparente']),
		ui: { showFinish: false, showMaterials: false, showShapes: true }
	})
};

export const PRODUCT_ENGINES: { slug: string; name: string; href: string; engineProduct: 'sticker' | 'resinati' }[] = [
	{ slug: 'adesivi_personalizzati', name: 'Adesivi personalizzati', href: '/adesivi-personalizzati', engineProduct: 'sticker' },
	{ slug: 'adesivi_resinati', name: 'Adesivi resinati', href: '/adesivi-resinati', engineProduct: 'resinati' },
	{ slug: 'adesivi_rilievo', name: 'Adesivi in rilievo', href: '/adesivi-rilievo', engineProduct: 'sticker' },
	{ slug: 'etichette', name: 'Etichette in fogli', href: '/etichette', engineProduct: 'sticker' },
	{ slug: 'fogli_adesivi', name: 'Fogli di adesivi', href: '/fogli', engineProduct: 'sticker' },
	{ slug: 'vetrofanie', name: 'Vetrofanie', href: '/vetrofanie', engineProduct: 'sticker' }
];

/** Unisce un config salvato (anche parziale o di versione vecchia) con i default del prodotto */
export function mergeConfig(defaults: EngineConfig, saved: unknown): EngineConfig {
	if (!saved || typeof saved !== 'object') return clone(defaults);
	const s = saved as Partial<EngineConfig> & { version?: number };
	if (s.version !== 2) return clone(defaults); // formato precedente: si riparte dal default
	const list = <T extends { id: string }>(def: T[], got: unknown): T[] => (Array.isArray(got) && got.length ? (got as T[]) : def);
	return {
		...clone(defaults),
		...s,
		print: { ...defaults.print, ...(s.print ?? {}) },
		laminate: { ...defaults.laminate, ...(s.laminate ?? {}) },
		resin: { ...defaults.resin, ...(s.resin ?? {}) },
		size: { ...defaults.size, ...(s.size ?? {}) },
		ui: { ...defaults.ui, ...(s.ui ?? {}) },
		commercialRange: Array.isArray(s.commercialRange) && s.commercialRange.length ? [...s.commercialRange].sort((a, b) => a.from - b.from) : defaults.commercialRange,
		priceRange: Array.isArray(s.priceRange) && s.priceRange.length ? [...s.priceRange].sort((a, b) => a.from - b.from) : defaults.priceRange,
		quantities: Array.isArray(s.quantities) && s.quantities.length ? [...s.quantities].map(Number).filter((n) => n > 0).sort((a, b) => a - b) : defaults.quantities,
		shapes: list(defaults.shapes, s.shapes),
		materials: list(defaults.materials, s.materials),
		finishes: list(defaults.finishes, s.finishes)
	};
}

export const sale = (c: CostItem) => c.costM2 * (1 + (c.markup ?? 0));
export const resinSaleCm2 = (r: EngineConfig['resin']) => (r.costKg / 1000) * r.gramsPerCm2 * (1 + r.markup);

export function rangeFactor(steps: RangeStep[], value: number): number {
	let f = steps[0]?.factor ?? 1;
	for (const s of steps) if (value >= s.from) f = s.factor;
	return f;
}

export function roundHalf(v: number): number {
	return Math.round(v * 2) / 2;
}

export interface Breakdown {
	m2: number;
	cm2: number;
	cr: number;
	pr: number;
	material: number;
	print: number;
	laminate: number;
	resin: number;
	extra: number;
	setup: number;
	minApplied: boolean;
}
export interface Quote {
	net: number;
	gross: number;
	perPiece: number; // sul prezzo mostrato (netto o lordo)
	perPieceNet: number;
	credit: number;
	breakdown: Breakdown;
}

export function quoteWith(cfg: EngineConfig, o: { w: number; h: number; forma: string; materiale: string; finitura: string; qty: number; vatIncluded: boolean }): Quote {
	const qty = Math.max(1, Math.round(o.qty));
	const m2 = ((o.w * o.h) / 1_000_000) * qty;
	const cm2 = ((o.w * o.h) / 100) * qty;
	const cr = rangeFactor(cfg.commercialRange, m2);
	const pr = rangeFactor(cfg.priceRange, qty);
	const mat = cfg.materials.find((m) => m.id === o.materiale) ?? cfg.materials.find((m) => m.visible) ?? cfg.materials[0];
	const fin = cfg.finishes.find((f) => f.id === o.finitura);
	const material = sale(mat) * m2 * cr * pr;
	const print = sale(cfg.print) * m2 * cr * pr;
	const laminate = cfg.ui.showFinish && fin?.laminate ? sale(cfg.laminate) * m2 * cr * pr : 0;
	const resin = cfg.resin.enabled ? resinSaleCm2(cfg.resin) * cm2 * pr : 0;
	const extra = cfg.extraPerPiece * qty;
	let net = material + print + laminate + resin + extra + cfg.setup;
	let minApplied = false;
	if (cfg.minPerPiece > 0 && net < cfg.minPerPiece * qty) {
		net = cfg.minPerPiece * qty;
		minApplied = true;
	}
	net = Math.round(net * 100) / 100;
	const gross = Math.round(net * cfg.vat * 100) / 100;
	const shown = o.vatIncluded ? gross : net;
	return {
		net,
		gross,
		perPiece: shown / qty,
		perPieceNet: net / qty,
		credit: net * cfg.creditRate,
		breakdown: { m2, cm2, cr, pr, material, print, laminate, resin, extra, setup: cfg.setup, minApplied }
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
