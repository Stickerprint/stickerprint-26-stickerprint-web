/**
 * Stickerprint Studio — impaginazione dei file di stampa.
 *
 * Tutte le misure sono in millimetri, origine in alto a sinistra, y verso il basso.
 * Un "pezzo" e' il rettangolo del taglio (cutW × cutH); l'abbondanza sta fuori e non
 * entra nei conti: lo spazio fra i pezzi si misura da taglio a taglio.
 *
 * Due modi:
 *  - SCIOLTI (personalizzati, rilievo, vetrofanie, kit): i pezzi riempiono la striscia,
 *    solo taglio passante.
 *  - FOGLI (resinati, etichette): i pezzi (mezzo taglio) stanno su fogli circa A4 col
 *    passante sul bordo; i fogli riempiono la striscia.
 */

/** verso di un pezzo o di un foglio sulla striscia */
export type Verso = 'auto' | 'dritto' | 'girato';
const versi = (v: Verso | undefined) => (v === 'dritto' ? [false] : v === 'girato' ? [true] : [false, true]);

export interface StripMaterial {
	id: string;
	label: string;
	/** larghezza della bobina */
	width: number;
	/** altezza massima della striscia per i fogli (resinati, etichette) */
	maxHSheets: number;
	/** altezza massima della striscia per gli adesivi sciolti */
	maxHLoose: number;
}

export const STRIP_MATERIALS: StripMaterial[] = [
	{ id: 'm70', label: 'Bobina 70 cm', width: 700, maxHSheets: 360, maxHLoose: 450 },
	{ id: 'm57', label: 'Bobina 57 cm', width: 570, maxHSheets: 360, maxHLoose: 450 }
];

/** regole dei fogli, per prodotto */
export interface SheetRules {
	/** bordo del foglio attorno alle etichette */
	margin: number;
	/** spazio minimo fra un'etichetta e l'altra */
	gap: number;
	/** resinatrice a 10 aghi: etichette per foglio multiple di 5 */
	mod5: boolean;
}

export const SHEET_RULES: Record<'resinati' | 'etichette', SheetRules> = {
	resinati: { margin: 12.5, gap: 2, mod5: true },
	etichette: { margin: 10, gap: 2, mod5: false }
};

/** A4 di riferimento e quanto ci si puo' allontanare ("circa A4") */
export const A4: [number, number] = [210, 297];
export const A4_TOL = 0.15;

/** materiale che se ne va fra una striscia e l'altra (3 cm di codice a barre + stacco) */
export const STRIP_OVERHEAD = 50;

export interface Placement {
	/** angolo in alto a sinistra del rettangolo occupato (gia' ruotato) */
	x: number;
	y: number;
	/** ruotato di 90 gradi */
	rot: boolean;
}

export interface Grid {
	cols: number;
	rows: number;
	n: number;
	rot: boolean;
	/** ingombro della griglia (pezzi e spazi, senza margini) */
	w: number;
	h: number;
}

const EPS = 1e-6;
const fit = (avail: number, size: number, gap: number) => (avail + EPS < size ? 0 : Math.floor((avail + gap + EPS) / (size + gap)));

function grid(pw: number, ph: number, cols: number, rows: number, gap: number, rot: boolean): Grid {
	return { cols, rows, n: cols * rows, rot, w: cols * pw + Math.max(0, cols - 1) * gap, h: rows * ph + Math.max(0, rows - 1) * gap };
}

function place(g: Grid, pw: number, ph: number, gap: number, x0: number, y0: number, max = Infinity): Placement[] {
	const out: Placement[] = [];
	for (let r = 0; r < g.rows; r++)
		for (let c = 0; c < g.cols; c++) {
			if (out.length >= max) return out;
			out.push({ x: x0 + c * (pw + gap), y: y0 + r * (ph + gap), rot: g.rot });
		}
	return out;
}

/* ------------------------------------------------------------------ SCIOLTI */

export interface LooseOptions {
	stripW: number;
	/** altezza della striscia chiesta dall'operatore (gia' limitata al massimo del materiale) */
	stripH: number;
	/** margine fra il bordo della striscia e i pezzi (a destra e a sinistra) */
	margin: number;
	/** margine in alto e in basso (se diverso: crocini e codici a barre) */
	marginY?: number;
	/** spazio fra i pezzi, da taglio a taglio */
	gap: number;
	/** 0 = riempi le strisce; altrimenti quanti pezzi servono in tutto */
	qty: number;
	/** verso dei pezzi: auto (sceglie il migliore), dritto o girato di 90 gradi */
	verso?: Verso;
}

export interface Strip {
	/** misure della pagina (la striscia stampata) */
	w: number;
	h: number;
	pieces: Placement[];
	/** fogli, solo nel modo FOGLI */
	sheets?: { x: number; y: number; w: number; h: number; rot: boolean }[];
}

export interface LooseResult {
	ok: boolean;
	error?: string;
	grid: Grid;
	perStrip: number;
	strips: Strip[];
	/** misure del pezzo come sta sulla striscia */
	pw: number;
	ph: number;
}

/** Adesivi sciolti: si prova il pezzo dritto e girato, vince il verso che ne fa entrare di piu'. */
export function layoutLoose(cutW: number, cutH: number, o: LooseOptions): LooseResult {
	const my = o.marginY ?? o.margin;
	const aw = o.stripW - 2 * o.margin, ah = o.stripH - 2 * my;
	const opts = versi(o.verso).map((rot) => {
		const pw = rot ? cutH : cutW, ph = rot ? cutW : cutH;
		return { pw, ph, g: grid(pw, ph, fit(aw, pw, o.gap), fit(ah, ph, o.gap), o.gap, rot) };
	});
	// piu' pezzi; a parita', la striscia piu' corta (meno materiale)
	opts.sort((a, b) => b.g.n - a.g.n || a.g.h - b.g.h);
	const best = opts[0];
	const empty = { ok: false, grid: best.g, perStrip: 0, strips: [], pw: best.pw, ph: best.ph };
	if (best.g.n < 1) return { ...empty, error: `Il pezzo (${cutW.toFixed(1)}×${cutH.toFixed(1)} mm) non entra nella striscia ${o.stripW}×${o.stripH} mm.` };

	const total = o.qty > 0 ? o.qty : best.g.n;
	const strips: Strip[] = [];
	for (let left = total; left > 0; left -= best.g.n) {
		const k = Math.min(left, best.g.n);
		const rows = Math.ceil(k / best.g.cols);
		const g = { ...best.g, rows };
		const usedH = rows * best.ph + (rows - 1) * o.gap;
		// sempre centrato nella pagina: in larghezza sulla striscia, in altezza col margine uguale sopra e sotto
		const cols = Math.min(k, best.g.cols);
		const x0 = (o.stripW - (cols * best.pw + (cols - 1) * o.gap)) / 2;
		strips.push({ w: o.stripW, h: Math.round((usedH + 2 * my) * 10) / 10, pieces: place(g, best.pw, best.ph, o.gap, x0, my, k) });
	}
	return { ok: true, grid: best.g, perStrip: best.g.n, strips, pw: best.pw, ph: best.ph };
}

/* ------------------------------------------------------------------ FOGLI */

export interface SheetLayout {
	/** misure del foglio (dove passa il passante) */
	w: number;
	h: number;
	grid: Grid;
	/** pezzi dentro il foglio, rispetto al suo angolo */
	pieces: Placement[];
	pw: number;
	ph: number;
	/** vicino all'A4 oppure ripiego */
	nearA4: boolean;
}

export interface SheetStripOptions {
	stripW: number;
	stripH: number;
	/** margine fra il bordo della striscia e i fogli (a destra e a sinistra) */
	margin: number;
	/** margine in alto e in basso (se diverso: crocini e codici a barre) */
	marginY?: number;
	/** spazio fra un foglio e l'altro sulla striscia (almeno 10 mm) */
	sheetGap: number;
	/** 0 = riempi le strisce; altrimenti quanti fogli servono */
	sheets: number;
	/** verso delle etichette dentro il foglio */
	versoPezzi?: Verso;
	/** verso del foglio sulla striscia */
	versoFoglio?: Verso;
}

export interface SheetResult {
	ok: boolean;
	error?: string;
	warning?: string;
	sheet: SheetLayout | null;
	/** fogli sulla striscia */
	across: number;
	down: number;
	sheetsPerStrip: number;
	piecesPerStrip: number;
	/** foglio girato sulla striscia */
	sheetRot: boolean;
	strips: Strip[];
}

interface Cand {
	sheet: SheetLayout;
	across: number;
	down: number;
	sheetRot: boolean;
	usedH: number;
	density: number;
}

function a4Near(w: number, h: number, tol: number) {
	const s = Math.min(w, h), l = Math.max(w, h);
	return s <= A4[0] * (1 + tol) + EPS && l <= A4[1] * (1 + tol) + EPS && s >= A4[0] * (1 - tol) - EPS && l >= A4[1] * (1 - tol) - EPS;
}

/**
 * Sceglie la griglia del foglio e come mettere i fogli sulla striscia.
 * Priorita': piu' etichette per millimetro di striscia consumata. Il foglio resta
 * "circa A4" (±15% sui lati); se nessuna griglia ci sta (etichette molto grandi o
 * molto piccole col vincolo dei 5 aghi) si ripiega sul foglio che rende di piu'
 * sulla striscia, e lo si segnala.
 */
export function layoutSheets(cutW: number, cutH: number, rules: SheetRules, o: SheetStripOptions): SheetResult {
	const my = o.marginY ?? o.margin;
	const aw = o.stripW - 2 * o.margin, ah = o.stripH - 2 * my;
	const cands: Cand[] = [];
	for (const rot of versi(o.versoPezzi)) {
		const pw = rot ? cutH : cutW, ph = rot ? cutW : cutH;
		const maxC = fit(aw - 2 * rules.margin, pw, rules.gap), maxR = fit(Math.max(aw, ah) - 2 * rules.margin, ph, rules.gap);
		for (let c = 1; c <= maxC; c++)
			for (let r = 1; r <= maxR; r++) {
				const n = c * r;
				if (rules.mod5 && n % 5) continue;
				const g = grid(pw, ph, c, r, rules.gap, rot);
				const sw = Math.round((g.w + 2 * rules.margin) * 10) / 10, sh = Math.round((g.h + 2 * rules.margin) * 10) / 10;
				const sheet: SheetLayout = { w: sw, h: sh, grid: g, pieces: place(g, pw, ph, rules.gap, rules.margin, rules.margin), pw, ph, nearA4: a4Near(sw, sh, A4_TOL) };
				for (const sRot of versi(o.versoFoglio)) {
					const W = sRot ? sh : sw, H = sRot ? sw : sh;
					const across = fit(aw, W, o.sheetGap), down = fit(ah, H, o.sheetGap);
					if (!across || !down) continue;
					const usedH = down * H + (down - 1) * o.sheetGap + 2 * my;
					cands.push({ sheet, across, down, sheetRot: sRot, usedH, density: (across * down * n) / (usedH + STRIP_OVERHEAD) });
				}
			}
	}
	const empty: SheetResult = { ok: false, sheet: null, across: 0, down: 0, sheetsPerStrip: 0, piecesPerStrip: 0, sheetRot: false, strips: [] };
	if (!cands.length) {
		return { ...empty, error: rules.mod5 ? `Con ${cutW.toFixed(1)}×${cutH.toFixed(1)} mm non entra un foglio con un multiplo di 5 etichette nella striscia ${o.stripW}×${o.stripH} mm.` : `L'etichetta (${cutW.toFixed(1)}×${cutH.toFixed(1)} mm) non entra in un foglio sulla striscia ${o.stripW}×${o.stripH} mm.` };
	}
	const areaA4 = A4[0] * A4[1];
	const near = cands.filter((c) => c.sheet.nearA4);
	const pool = near.length ? near : cands;
	pool.sort(
		(a, b) =>
			b.density - a.density ||
			Math.abs(a.sheet.w * a.sheet.h - areaA4) - Math.abs(b.sheet.w * b.sheet.h - areaA4) ||
			a.usedH - b.usedH
	);
	const best = pool[0];
	const perStrip = best.across * best.down;
	const W = best.sheetRot ? best.sheet.h : best.sheet.w, H = best.sheetRot ? best.sheet.w : best.sheet.h;

	const total = o.sheets > 0 ? o.sheets : perStrip;
	const strips: Strip[] = [];
	for (let left = total; left > 0; left -= perStrip) {
		const k = Math.min(left, perStrip);
		const down = Math.ceil(k / best.across);
		const sheets: Strip['sheets'] = [];
		const pieces: Placement[] = [];
		// fogli sempre centrati nella larghezza della striscia
		const cols = Math.min(k, best.across);
		const x0 = (o.stripW - (cols * W + (cols - 1) * o.sheetGap)) / 2;
		for (let i = 0; i < k; i++) {
			const c = i % best.across, r = Math.floor(i / best.across);
			const sx = x0 + c * (W + o.sheetGap), sy = my + r * (H + o.sheetGap);
			sheets.push({ x: sx, y: sy, w: W, h: H, rot: best.sheetRot });
			for (const p of best.sheet.pieces) {
				if (!best.sheetRot) pieces.push({ x: sx + p.x, y: sy + p.y, rot: p.rot });
				// foglio girato di 90 gradi in senso orario: (x, y) -> (H_foglio - y - ph, x)
				else pieces.push({ x: sx + (best.sheet.h - p.y - best.sheet.ph), y: sy + p.x, rot: !p.rot });
			}
		}
		const usedH = down * H + (down - 1) * o.sheetGap + 2 * my;
		strips.push({ w: o.stripW, h: Math.round(usedH * 10) / 10, pieces, sheets });
	}
	return {
		ok: true,
		warning: near.length ? undefined : `Nessun foglio "circa A4" possibile con questa misura: uso un foglio ${best.sheet.w}×${best.sheet.h} mm.`,
		sheet: best.sheet,
		across: best.across,
		down: best.down,
		sheetsPerStrip: perStrip,
		piecesPerStrip: perStrip * best.sheet.grid.n,
		sheetRot: best.sheetRot,
		strips
	};
}
