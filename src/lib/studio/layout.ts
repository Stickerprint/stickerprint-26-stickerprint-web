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
/** gli stessi versi, per chi impagina fuori di qui (montaggio di piu' soggetti) */
export const versiDi = versi;

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
	/* la bobina "70" e' larga 750 mm: dal 31/10/2026 (Mattia) si stampa su 712 mm, prima 700 */
	{ id: 'm70', label: 'Bobina 70 cm', width: 712, maxHSheets: 360, maxHLoose: 450 },
	{ id: 'm57', label: 'Bobina 57 cm', width: 570, maxHSheets: 360, maxHLoose: 450 }
];

/** regole dei fogli, per prodotto */
export interface SheetRules {
	/** bordo del foglio attorno alle etichette */
	margin: number;
	/** spazio minimo fra un'etichetta e l'altra */
	gap: number;
	/** resinatrice: quanti aghi ha la testa (null = nessun vincolo).
	 *  Le etichette di una riga si dividono gli aghi (2 etichette = 5 aghi ciascuna), quindi le COLONNE devono
	 *  dividere la testa: 1, 2, 5 o 10 per una testa da 10. Le righe sono libere (Mattia, 15/10/2026: il
	 *  "totale multiplo di 10" del 29/9 era un vincolo inventato che faceva fogli da 43 cm per Ø80). */
	testa: number | null;
}

export const SHEET_RULES: Record<'resinati' | 'etichette', SheetRules> = {
	resinati: { margin: 12.5, gap: 2, testa: 10 },
	etichette: { margin: 10, gap: 2, testa: null }
};

/** A4 di riferimento e quanto ci si puo' allontanare ("circa A4") */
export const A4: [number, number] = [210, 297];
export const A4_TOL = 0.15;

/** materiale che se ne va fra una striscia e l'altra (3 cm di codice a barre + stacco) */
export const STRIP_OVERHEAD = 50;
/** fogli, altezza "automatica": se l'operatore non scrive un'altezza, la striscia puo' alzarsi fino a qui
 *  quando cosi' ci stanno piu' fogli affiancati (es. Ø80 resinati: 3 fogli da 2×5 in 473 mm invece di 1 foglio in 227) */
export const SHEET_AUTO_MAX_H = 500;
/** cornice della striscia: margini laterali e verticali dentro i crocini */
export interface Frame { margin: number; marginY: number; label?: string }

export interface Placement {
	/** angolo in alto a sinistra del rettangolo occupato (gia' ruotato) */
	x: number;
	y: number;
	/** ruotato di 90 gradi */
	rot: boolean;
	/** quale soggetto, quando sulla striscia ce n'e' piu' d'uno (manca = il primo) */
	a?: number;
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
	/** fogli, solo nel modo FOGLI. `pathD` = bordo del foglio in tracciato (mm, nel riquadro w×h non ruotato):
	    quando manca il passante e' il rettangolo */
	sheets?: { x: number; y: number; w: number; h: number; rot: boolean; pathD?: string }[];
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
	/** altezza libera: la striscia puo' alzarsi fino a qui (al posto di stripH) se ci stanno piu' fogli */
	autoMaxH?: number;
	/** cornici fra cui scegliere (la prima e' quella di margin/marginY): es. quella a tutta larghezza fra i crocini */
	frames?: Frame[];
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
	/** altezza della striscia piena e cornice scelte */
	stripH?: number;
	frame?: Frame;
}

interface Cand {
	sheet: SheetLayout;
	across: number;
	down: number;
	sheetRot: boolean;
	usedH: number;
	density: number;
	frame: Frame;
	/** la griglia rispetta la testa della resinatrice (colonne che dividono gli aghi: 1, 2, 5, 10) */
	testaOk: boolean;
}

function a4Near(w: number, h: number, tol: number) {
	const s = Math.min(w, h), l = Math.max(w, h);
	return s <= A4[0] * (1 + tol) + EPS && l <= A4[1] * (1 + tol) + EPS && s >= A4[0] * (1 - tol) - EPS && l >= A4[1] * (1 - tol) - EPS;
}

/**
 * Sceglie la griglia del foglio e come mettere i fogli sulla striscia.
 * Priorita': piu' etichette per millimetro di striscia consumata (la larghezza e' fissa, conta l'altezza).
 * Si provano tutte le griglie ammesse, i due versi del foglio, le cornici date e, con l'altezza libera,
 * quante file di fogli mettere una sotto l'altra. Il foglio resta "circa A4" (±15% sui lati) sempre, quando
 * una griglia del genere esiste: prima quelle che rispettano la testa della resinatrice, altrimenti anche le
 * altre (meno etichette per foglio). Senza alcun foglio A4 si prende quello che rende di piu' e lo si segnala.
 * Entro il 5% di resa si preferisce non alzare la striscia.
 */
export function layoutSheets(cutW: number, cutH: number, rules: SheetRules, o: SheetStripOptions): SheetResult {
	const frames: Frame[] = o.frames?.length ? o.frames : [{ margin: o.margin, marginY: o.marginY ?? o.margin }];
	const hMax = o.autoMaxH && o.autoMaxH > o.stripH ? o.autoMaxH : o.stripH;
	const cands: Cand[] = [];
	for (const f of frames) {
		const aw = o.stripW - 2 * f.margin, ah = hMax - 2 * f.marginY;
		if (aw <= 0 || ah <= 0) continue;
		for (const rot of versi(o.versoPezzi)) {
			const pw = rot ? cutH : cutW, ph = rot ? cutW : cutH;
			const lato = Math.max(aw, ah) - 2 * rules.margin;
			const maxC = fit(lato, pw, rules.gap), maxR = fit(lato, ph, rules.gap);
			for (let c = 1; c <= maxC; c++)
				for (let r = 1; r <= maxR; r++) {
					const n = c * r;
					const testaOk = !rules.testa || rules.testa % c === 0;
					const g = grid(pw, ph, c, r, rules.gap, rot);
					const sw = Math.round((g.w + 2 * rules.margin) * 10) / 10, sh = Math.round((g.h + 2 * rules.margin) * 10) / 10;
					const sheet: SheetLayout = { w: sw, h: sh, grid: g, pieces: place(g, pw, ph, rules.gap, rules.margin, rules.margin), pw, ph, nearA4: a4Near(sw, sh, A4_TOL) };
					for (const sRot of versi(o.versoFoglio)) {
						const W = sRot ? sh : sw, H = sRot ? sw : sh;
						const across = fit(aw, W, o.sheetGap), maxDown = fit(ah, H, o.sheetGap);
						if (!across || !maxDown) continue;
						for (let down = 1; down <= maxDown; down++) {
							const usedH = down * H + (down - 1) * o.sheetGap + 2 * f.marginY;
							cands.push({ sheet, across, down, sheetRot: sRot, usedH, density: (across * down * n) / (usedH + STRIP_OVERHEAD), frame: f, testaOk });
						}
					}
				}
		}
	}
	const empty: SheetResult = { ok: false, sheet: null, across: 0, down: 0, sheetsPerStrip: 0, piecesPerStrip: 0, sheetRot: false, strips: [] };
	if (!cands.length) {
		return { ...empty, error: `L'etichetta (${cutW.toFixed(1)}×${cutH.toFixed(1)} mm) non entra in un foglio sulla striscia ${o.stripW}×${o.stripH} mm.` };
	}
	const areaA4 = A4[0] * A4[1];
	// Il foglio "circa A4" viene prima di tutto (Mattia, 15/10/2026: "le regole devono essere uguali per tutti i fogli",
	// niente fogli alti 43 cm). Poi la testa della resinatrice (colonne 1, 2, 5, 10: Ø80 = 2×3, 5 aghi a etichetta);
	// se nessun foglio A4 la rispetta si prende un foglio A4 con altre colonne e lo si scrive.
	// Solo senza alcun foglio A4 possibile (etichette oltre l'A4) si guarda il resto.
	const near = cands.filter((c) => c.sheet.nearA4);
	const nearTesta = near.filter((c) => c.testaOk);
	const pool = nearTesta.length ? nearTesta : near.length ? near : cands.filter((c) => c.testaOk).length ? cands.filter((c) => c.testaOk) : cands;
	pool.sort(
		(a, b) =>
			b.density - a.density ||
			Math.abs(a.sheet.w * a.sheet.h - areaA4) - Math.abs(b.sheet.w * b.sheet.h - areaA4) ||
			a.usedH - b.usedH
	);
	// a parita' (quasi, entro il 5%) di resa si resta entro l'altezza consigliata invece di alzare la striscia
	const soglia = pool[0].density * 0.95;
	const best = pool.find((c) => c.density >= soglia && c.usedH <= o.stripH) ?? pool[0];
	const perStrip = best.across * best.down;
	const W = best.sheetRot ? best.sheet.h : best.sheet.w, H = best.sheetRot ? best.sheet.w : best.sheet.h;
	const my = best.frame.marginY;

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
		warning: !best.sheet.nearA4
			? `Nessun foglio "circa A4" possibile con questa misura: uso un foglio ${best.sheet.w}×${best.sheet.h} mm.`
			: !best.testaOk ? `Nessun foglio "circa A4" sta nella testa da ${rules.testa} aghi con questa misura: foglio con ${best.sheet.grid.cols} colonne (gli aghi si dividono in 1, 2, 5 o ${rules.testa}).` : undefined,
		sheet: best.sheet,
		across: best.across,
		down: best.down,
		sheetsPerStrip: perStrip,
		piecesPerStrip: perStrip * best.sheet.grid.n,
		sheetRot: best.sheetRot,
		strips,
		stripH: Math.round(best.usedH * 10) / 10,
		frame: best.frame
	};
}
