/**
 * Motore di calcolo prezzi A COSTI — replica fedele del foglio "custom price calculator.xlsx".
 * Ogni prodotto ha il suo `EngineConfig`, salvato a parte in `pricing_engines` (slug):
 * quello che si modifica su un prodotto resta confinato a quel prodotto.
 *
 * Per un ordine (w × h mm, quantità, materiale, finitura):
 *   m²        = w·h / 1.000.000 × quantità
 *   cm²       = w·h / 100 × quantità
 *   vendita   = acquisto × (1 + ricarico)
 *   CR        = commercial range: fattore in base ai m² totali (0→1,15 … 100→0,60)
 *   PR        = price range: fattore in base alla quantità (1→1,30 … 20000→0,60)
 *   Nel foglio i fattori sono applicati come (1 + CR) e (1 + PR): qui facciamo lo stesso.
 *   materiale = vendita materiale €/m² × m² × (1+CR) × (1+PR)
 *   stampa    = vendita stampa €/m²   × m² × (1+CR) × (1+PR)
 *   lamina    = vendita plastifica €/m² × m² × (1+CR) × (1+PR)   (prodotti con lamina, se la finitura la prevede)
 *   resina    = vendita resina €/cm² × cm² × (1+PR)              (prodotti resinati, sempre; nel foglio non ha il CR)
 *   netto     = materiale + stampa + lamina + resina + avvio produzione
 *   lordo     = netto × IVA
 */

export type EngineKind = 'lamina' | 'resina';
export interface CostItem { costM2: number; markup: number } // markup 0 = nessun ricarico, 0.5 = +50%
export interface MaterialOption extends CostItem { id: string; label: string; description?: string; tag?: string; img?: string; visible: boolean }
export interface FinishOption { id: string; label: string; description?: string; img?: string; laminate: boolean; visible: boolean }
export interface ShapeOption { id: string; label: string; description?: string; img?: string; equal?: boolean; ratio?: number; visible: boolean; presets: number[] } // ratio = proporzione fissa larghezza/altezza (fogli)
export interface RangeStep { from: number; factor: number }
/** Avvio produzione a scaglioni: fino a `upTo` pezzi si paga `setup`; oltre l'ultimo scaglione vale `cfg.setup` */
export interface SetupTier { upTo: number; setup: number }

export interface EngineConfig {
	version: 3;
	kind: EngineKind; // 'lamina' = lamina protettiva opzionale; 'resina' = resina sempre inclusa
	vat: number;
	creditRate: number;
	setup: number; // avvio produzione, una tantum (oltre l'ultimo scaglione)
	setupTiers: SetupTier[]; // avvio produzione ridotto per le quantità piccole
	print: CostItem;
	laminate: CostItem; // solo kind 'lamina'
	resin: { costKg: number; gramsPerCm2: number; markup: number }; // solo kind 'resina'
	commercialRange: RangeStep[]; // per m² totali
	priceRange: RangeStep[]; // per quantità
	quantities: number[]; // fasce mostrate al cliente
	recommendedQty: number;
	size: { minMm: number; maxMm: number };
	shapes: ShapeOption[]; // ogni sagoma ha le sue misure proposte (larghezze in mm)
	materials: MaterialOption[];
	finishes: FinishOption[];
}

const IMG = '/images/estimator';

const ALL_MATERIALS: MaterialOption[] = [
	{ id: 'bianco', label: 'Bianco', description: 'Vinile bianco standard', tag: 'Più scelto', img: `${IMG}/white.webp`, costM2: 4, markup: 0, visible: true },
	{ id: 'super', label: 'Bianco super adesivo', description: 'Per superfici difficili', img: `${IMG}/white_super.webp`, costM2: 6.7, markup: 0, visible: false },
	{ id: 'olografico', label: 'Olografico', description: 'Riflessi arcobaleno', img: `${IMG}/olo.webp`, costM2: 13.9, markup: 0, visible: true },
	{ id: 'glitterato', label: 'Glitterato', description: 'Brillantini in superficie', img: `${IMG}/glitter.webp`, costM2: 14.5, markup: 0, visible: true },
	{ id: 'trasparente', label: 'Trasparente', description: 'Effetto senza fondo', img: `${IMG}/transparent.webp`, costM2: 4.3, markup: 0, visible: true },
	{ id: 'argento', label: 'Argento', description: 'Cromo argento', img: `${IMG}/silver.webp`, costM2: 13.9, markup: 0, visible: true },
	{ id: 'oro', label: 'Oro', description: 'Cromo oro', img: `${IMG}/gold.webp`, costM2: 11.3, markup: 0, visible: true }
];

/** Sagome standard; le immagini cambiano per prodotto (cartelle res/, vetr/, label/) */
function stdShapes(imgs: [string, string, string, string, string], presets: number[]): ShapeOption[] {
	const [custom, round, square, oval, rect] = imgs;
	return [
		{ id: 'sagomato', label: 'Sagomato', description: 'Forma libera', img: custom, visible: true, presets: [...presets] },
		{ id: 'tondo', label: 'Rotondo', description: 'Cerchio', img: round, equal: true, visible: true, presets: [...presets] },
		{ id: 'quadrato', label: 'Quadrato', description: 'Angoli morbidi', img: square, equal: true, visible: true, presets: [...presets] },
		{ id: 'ovale', label: 'Ovale', description: 'Ellisse', img: oval, visible: true, presets: [...presets] },
		{ id: 'rettangolare', label: 'Rettangolo', description: 'Orizzontale', img: rect, visible: true, presets: [...presets] }
	];
}
const STICKER_IMGS: [string, string, string, string, string] = [`${IMG}/custom_stickers.webp`, `${IMG}/round_stickers.webp`, `${IMG}/square_stickers.webp`, `${IMG}/oval_stickers.webp`, `${IMG}/rect_stickers.webp`];
const RES_IMGS: [string, string, string, string, string] = [`${IMG}/res/custom_res.webp`, `${IMG}/res/round_res.webp`, `${IMG}/res/square_res.webp`, `${IMG}/res/oval_res.webp`, `${IMG}/res/rect_res.webp`];
const VETR_IMGS: [string, string, string, string, string] = [`${IMG}/vetr/vetr_custom.webp`, `${IMG}/vetr/vetr_round.webp`, `${IMG}/vetr/vetr_square.webp`, `${IMG}/vetr/vetr_oval.webp`, `${IMG}/vetr/vetr_rect.webp`];
const LABEL_IMGS: [string, string, string, string, string] = [`${IMG}/label/custom_labels.webp`, `${IMG}/label/round_label.webp`, `${IMG}/label/square_labels.webp`, `${IMG}/label/oval_labels.webp`, `${IMG}/label/rect_label.webp`];
const ALL_SHAPES: ShapeOption[] = stdShapes(STICKER_IMGS, [30, 50, 70, 100]);
/** Fogli di adesivi: formati foglio, proporzione fissa */
const SHEET_SHAPES: ShapeOption[] = [
	{ id: 'verticale', label: 'Verticale', description: '100×150, 148×210, 213×275 mm', img: `${IMG}/sheet/Sticker_sheet_1.webp`, ratio: 100 / 150, visible: true, presets: [100, 148, 213] },
	{ id: 'orizzontale', label: 'Orizzontale', description: '150×100, 210×148, 275×213 mm', img: `${IMG}/sheet/sticker_sheet2.webp`, ratio: 150 / 100, visible: true, presets: [150, 210, 275] },
	{ id: 'sagomato', label: 'Sagomati', description: 'Foglio tagliato a forma', img: `${IMG}/sheet/sticker_sheet3.webp`, visible: true, presets: [100, 148, 213] }
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
		version: 3,
		kind: 'lamina',
		vat: 1.22,
		creditRate: 0.05,
		setup: 50,
		setupTiers: [{ upTo: 20, setup: 20 }, { upTo: 50, setup: 30 }],
		print: { costM2: 4, markup: 0 },
		laminate: { costM2: 4, markup: 0 },
		resin: { costKg: 10.9, gramsPerCm2: 0.15, markup: 1.5 },
		commercialRange: clone(COMMERCIAL_RANGE),
		priceRange: clone(PRICE_RANGE),
		quantities: [50, 100, 200, 300, 500, 1000, 2000, 3000, 5000],
		recommendedQty: 500,
		size: { minMm: 10, maxMm: 500 },
		shapes: clone(ALL_SHAPES),
		materials: clone(ALL_MATERIALS),
		finishes: clone(ALL_FINISHES),
		...over
	};
}

function withMaterials(ids: string[]): MaterialOption[] {
	return clone(ALL_MATERIALS).map((m) => ({ ...m, visible: ids.includes(m.id) }));
}
function withFinishes(ids: string[]): FinishOption[] {
	return clone(ALL_FINISHES).map((f) => ({ ...f, visible: ids.includes(f.id) }));
}

const QTY_STD = [15, 50, 100, 200, 300, 500, 1000, 2000, 3000, 5000];
const QTY_SMALL = [15, 50, 100, 200, 300, 500, 1000, 2000, 3000];
const MAT_STICKER = ['bianco', 'olografico', 'glitterato', 'trasparente', 'argento', 'oro'];

/** Listini iniziali, uno per prodotto e indipendenti tra loro (poi ognuno si modifica dalla dashboard) */
export const DEFAULT_ENGINES: Record<string, EngineConfig> = {
	adesivi_personalizzati: base({ materials: withMaterials(MAT_STICKER), quantities: QTY_STD }),
	adesivi_rilievo: base({ materials: withMaterials(MAT_STICKER), shapes: stdShapes(STICKER_IMGS, [50, 80, 100, 125]), quantities: QTY_SMALL, size: { minMm: 20, maxMm: 500 } }),
	etichette: base({ materials: withMaterials(MAT_STICKER), shapes: stdShapes(LABEL_IMGS, [50, 80, 100, 125]), quantities: QTY_SMALL, size: { minMm: 15, maxMm: 300 } }),
	fogli_adesivi: base({ materials: withMaterials(MAT_STICKER), shapes: clone(SHEET_SHAPES), quantities: QTY_SMALL, recommendedQty: 100, size: { minMm: 50, maxMm: 300 } }),
	adesivi_resinati: base({
		kind: 'resina',
		materials: withMaterials(['bianco', 'super', 'trasparente', 'argento', 'oro']),
		finishes: withFinishes([]),
		shapes: stdShapes(RES_IMGS, [25, 50, 80, 100]),
		quantities: QTY_STD,
		size: { minMm: 10, maxMm: 200 }
	}),
	vetrofanie: base({
		materials: withMaterials(['trasparente']),
		finishes: withFinishes(['nessuna']),
		shapes: stdShapes(VETR_IMGS, [80, 100, 180, 250]),
		quantities: QTY_STD,
		size: { minMm: 30, maxMm: 500 }
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

/** Unisce un config salvato con i default del prodotto (campi nuovi presi dal default, per id) */
export function mergeConfig(defaults: EngineConfig, saved: unknown): EngineConfig {
	if (!saved || typeof saved !== 'object') return clone(defaults);
	const s = saved as Partial<EngineConfig> & { version?: number };
	if (s.version !== 3) return clone(defaults); // formato precedente: si riparte dal default
	const list = <T extends { id: string }>(def: T[], got: unknown): T[] => {
		if (!Array.isArray(got) || !got.length) return def;
		return (got as T[]).map((it) => ({ ...(def.find((d) => d.id === it.id) ?? {}), ...it }) as T);
	};
	return {
		...clone(defaults),
		...s,
		print: { ...defaults.print, ...(s.print ?? {}) },
		laminate: { ...defaults.laminate, ...(s.laminate ?? {}) },
		resin: { ...defaults.resin, ...(s.resin ?? {}) },
		size: { ...defaults.size, ...(s.size ?? {}) },
		commercialRange: Array.isArray(s.commercialRange) && s.commercialRange.length ? [...s.commercialRange].sort((a, b) => a.from - b.from) : defaults.commercialRange,
		priceRange: Array.isArray(s.priceRange) && s.priceRange.length ? [...s.priceRange].sort((a, b) => a.from - b.from) : defaults.priceRange,
		setupTiers: Array.isArray(s.setupTiers) ? [...s.setupTiers].filter((t) => t && t.upTo > 0 && t.setup >= 0).sort((a, b) => a.upTo - b.upTo) : defaults.setupTiers,
		quantities: Array.isArray(s.quantities) && s.quantities.length ? [...s.quantities].map(Number).filter((n) => n > 0).sort((a, b) => a - b) : defaults.quantities,
		shapes: list(defaults.shapes, s.shapes),
		materials: list(defaults.materials, s.materials),
		finishes: list(defaults.finishes, s.finishes)
	};
}

/** Avvio produzione per una quantità: lo scaglione più basso che la contiene, altrimenti quello pieno */
export function setupFor(cfg: EngineConfig, qty: number): number {
	for (const t of cfg.setupTiers ?? []) if (qty <= t.upTo) return t.setup;
	return cfg.setup;
}

export const sale = (c: CostItem) => c.costM2 * (1 + (c.markup ?? 0));
export const resinSaleCm2 = (r: EngineConfig['resin']) => (r.costKg / 1000) * r.gramsPerCm2 * (1 + r.markup);

/** Il passo "Materiale" si mostra solo se c'è una scelta */
export const showMaterialStep = (cfg: EngineConfig) => cfg.materials.filter((m) => m.visible).length > 1;
/** Il passo "Lamina protettiva" esiste solo nei prodotti con lamina e se c'è una scelta */
export const showFinishStep = (cfg: EngineConfig) => cfg.kind === 'lamina' && cfg.finishes.filter((f) => f.visible).length > 1;

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
	setup: number;
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
	const crF = 1 + cr; // come nel foglio: (1 + E2)
	const prF = 1 + pr; // come nel foglio: (1 + E3)
	const mat = cfg.materials.find((m) => m.id === o.materiale) ?? cfg.materials.find((m) => m.visible) ?? cfg.materials[0];
	const fin = cfg.finishes.find((f) => f.id === o.finitura);
	const material = sale(mat) * m2 * crF * prF;
	const print = sale(cfg.print) * m2 * crF * prF;
	const laminate = cfg.kind === 'lamina' && fin?.laminate ? sale(cfg.laminate) * m2 * crF * prF : 0;
	const resin = cfg.kind === 'resina' ? resinSaleCm2(cfg.resin) * cm2 * prF : 0;
	const setup = setupFor(cfg, qty);
	const net = Math.round((material + print + laminate + resin + setup) * 100) / 100;
	const gross = Math.round(net * cfg.vat * 100) / 100;
	const shown = o.vatIncluded ? gross : net;
	return {
		net,
		gross,
		perPiece: shown / qty,
		perPieceNet: net / qty,
		credit: net * cfg.creditRate,
		breakdown: { m2, cm2, cr, pr, material, print, laminate, resin, setup }
	};
}

/** Prezzo "a partire da" di un prodotto: quantità minima, misura più piccola proposta,
 *  primo materiale visibile, finitura più economica; IVA inclusa, arrotondato per eccesso */
export function lowestPrice(cfg: EngineConfig): number {
	const sh = cfg.shapes.find((s) => s.visible) ?? cfg.shapes[0];
	const mat = cfg.materials.find((m) => m.visible) ?? cfg.materials[0];
	const w = Math.max(cfg.size.minMm, Math.min(...(sh?.presets?.length ? sh.presets : [50])));
	const h = sh?.ratio ? w / sh.ratio : w;
	const fins = cfg.finishes.filter((f) => f.visible);
	const ids = fins.length ? fins.map((f) => f.id) : ['nessuna'];
	const qty = cfg.quantities[0] ?? 1;
	const best = Math.min(...ids.map((finitura) => quoteWith(cfg, { w, h, forma: sh?.id ?? 'sagomato', materiale: mat?.id ?? 'bianco', finitura, qty, vatIncluded: true }).gross));
	return Math.ceil(best);
}

/** Misura consigliata dalla proporzione del file */
export function suggestedSize(ratio: number): [number, number] {
	const nearSquare = ratio > 0.85 && ratio < 1.18;
	if (nearSquare) return [50, 50];
	return ratio > 1 ? [70, Math.max(10, Math.round(70 / ratio))] : [Math.max(10, Math.round(70 * ratio)), 70];
}

export const eur0 = (v: number) => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v);
export const eur2 = (v: number) => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);
