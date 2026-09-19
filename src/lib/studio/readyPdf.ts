/**
 * Stickerprint Studio — file PRONTI dei clienti aziendali (etichette e resinati).
 *
 * I clienti mandano un PDF vettoriale con l'etichetta in scala 1:1 e il tracciato di taglio
 * disegnato sopra (di solito un tratto sottile in ciano pieno, a volte in sovrastampa o in una
 * tinta piatta). Qui:
 *   1. si leggono i comandi di disegno della pagina (anche dentro i gruppi/Form XObject);
 *   2. si riconosce il tracciato di taglio;
 *   3. lo si TOGLIE dalla grafica (il tratto non si dipinge piu': operatore di pittura -> "n");
 *   4. lo si restituisce in mm (origine nell'angolo in alto a sinistra del taglio, y verso il basso)
 *      per l'impaginazione, il CutContour e il file di taglio del Graphtec.
 * Le misure sono quelle del file: niente scale, niente ritocchi.
 */
import { PDFDocument, PDFName, PDFArray, PDFDict, PDFRawStream, PDFRef, PDFString, PDFHexString, PDFNumber, PDFBool, decodePDFRawStream, type PDFContext, type PDFObject } from 'pdf-lib';

const MM = 25.4 / 72;
type M6 = [number, number, number, number, number, number];
const mul = (a: M6, b: M6): M6 => [a[0] * b[0] + a[1] * b[2], a[0] * b[1] + a[1] * b[3], a[2] * b[0] + a[3] * b[2], a[2] * b[1] + a[3] * b[3], a[4] * b[0] + a[5] * b[2] + b[4], a[4] * b[1] + a[5] * b[3] + b[5]];
const ap = (m: M6, x: number, y: number): [number, number] => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];

/* ------------------------------------------------------------------ lettura dei comandi */

interface Tok { t: 'num' | 'name' | 'str' | 'op' | 'arr' | 'dict' | 'bool' | 'null'; v: string; s: number; e: number }

const WS = /[\0\t\n\f\r ]/;
const DELIM = /[()<>[\]{}/%]/;

/** divide il contenuto in parole; le immagini in linea (BI ... ID dati EI) si saltano per intero */
function tokenize(src: string): Tok[] {
	const out: Tok[] = [];
	let i = 0;
	const n = src.length;
	while (i < n) {
		const c = src[i];
		if (WS.test(c)) { i++; continue; }
		if (c === '%') { while (i < n && src[i] !== '\n' && src[i] !== '\r') i++; continue; }
		const s = i;
		if (c === '(') {
			let depth = 1; i++;
			while (i < n && depth) { const ch = src[i]; if (ch === '\\') i += 2; else { if (ch === '(') depth++; else if (ch === ')') depth--; i++; } }
			out.push({ t: 'str', v: src.slice(s, i), s, e: i });
		} else if (c === '<' && src[i + 1] === '<') { out.push({ t: 'dict', v: '<<', s, e: i + 2 }); i += 2; }
		else if (c === '>' && src[i + 1] === '>') { out.push({ t: 'dict', v: '>>', s, e: i + 2 }); i += 2; }
		else if (c === '<') { while (i < n && src[i] !== '>') i++; i++; out.push({ t: 'str', v: src.slice(s, i), s, e: i }); }
		else if (c === '[' || c === ']') { out.push({ t: 'arr', v: c, s, e: i + 1 }); i++; }
		else if (c === '/') { i++; while (i < n && !WS.test(src[i]) && !DELIM.test(src[i])) i++; out.push({ t: 'name', v: src.slice(s + 1, i), s, e: i }); }
		else {
			while (i < n && !WS.test(src[i]) && !DELIM.test(src[i])) i++;
			if (i === s) { i++; continue; }
			const w = src.slice(s, i);
			if (/^[+-]?(\d+\.?\d*|\.\d+)$/.test(w)) out.push({ t: 'num', v: w, s, e: i });
			else if (w === 'true' || w === 'false') out.push({ t: 'bool', v: w, s, e: i });
			else if (w === 'null') out.push({ t: 'null', v: w, s, e: i });
			else {
				out.push({ t: 'op', v: w, s, e: i });
				if (w === 'ID') {
					// dati dell'immagine in linea fino a " EI"
					let j = i + 1;
					while (j < n - 2 && !(WS.test(src[j - 1]) && src[j] === 'E' && src[j + 1] === 'I' && (j + 2 >= n || WS.test(src[j + 2])))) j++;
					i = j + 2;
				}
			}
		}
	}
	return out;
}

/* ------------------------------------------------------------------ interpretazione */

interface Stroke {
	/** dove sta l'operatore di pittura (per toglierlo) */
	key: string;
	tok: number;
	op: string;
	/** sottotracciati nello spazio della pagina (pt, y verso l'alto) */
	subs: { pts: [number, number][]; segs: Seg[]; closed: boolean }[];
	overprint: boolean;
	spot: string | null;
	cmyk: number[] | null;
	rgb: number[] | null;
	width: number;
}
type Seg = ['M', number, number] | ['L', number, number] | ['C', number, number, number, number, number, number] | ['Z'];

interface GState { ctm: M6; op: boolean; spot: string | null; cmyk: number[] | null; rgb: number[] | null; w: number; csStroke: string | null }

interface Source { key: string; src: string; toks: Tok[]; res: PDFDict | undefined; ref?: PDFRef; dict?: PDFDict }

const look = (ctx: PDFContext, o: PDFObject | undefined): PDFObject | undefined => (o instanceof PDFRef ? ctx.lookup(o) : o);
const asDict = (ctx: PDFContext, o: PDFObject | undefined) => { const v = look(ctx, o); return v instanceof PDFDict ? v : undefined; };
const nameOf = (ctx: PDFContext, o: PDFObject | undefined): string | null => { const v = look(ctx, o); return v ? v.toString().replace(/^\//, '').replace(/#20/g, ' ') : null; };

function decode(ctx: PDFContext, s: PDFObject | undefined): string {
	const st = look(ctx, s);
	if (!(st instanceof PDFRawStream)) return '';
	const bytes = decodePDFRawStream(st).decode();
	let out = '';
	for (let i = 0; i < bytes.length; i += 8192) out += String.fromCharCode(...bytes.subarray(i, i + 8192));
	return out;
}

/** nome della tinta piatta di una color space (Separation/DeviceN), altrimenti null */
function spotName(ctx: PDFContext, res: PDFDict | undefined, csName: string): string | null {
	const csDict = asDict(ctx, res?.get(PDFName.of('ColorSpace')));
	const cs = look(ctx, csDict?.get(PDFName.of(csName)));
	if (cs instanceof PDFArray) {
		const kind = nameOf(ctx, cs.get(0));
		if (kind === 'Separation') return nameOf(ctx, cs.get(1));
		if (kind === 'DeviceN') { const n = look(ctx, cs.get(1)); if (n instanceof PDFArray && n.size() === 1) return nameOf(ctx, n.get(0)); }
	}
	return null;
}

function interpret(ctx: PDFContext, source: Source, base: M6, sources: Source[], strokes: Stroke[], depth = 0) {
	const { toks, res } = source;
	let gs: GState = { ctm: base, op: false, spot: null, cmyk: [0, 0, 0, 1], rgb: null, w: 1, csStroke: null };
	const stack: GState[] = [];
	let subs: Stroke['subs'] = [];
	let cur: Stroke['subs'][number] | null = null;
	let last: [number, number] = [0, 0], start: [number, number] = [0, 0];
	const args: Tok[] = [];
	const num = (k: number) => parseFloat(args[args.length - k]?.v ?? '0');
	const P = (x: number, y: number) => ap(gs.ctm, x, y);
	const newSub = (x: number, y: number) => { cur = { pts: [], segs: [], closed: false }; subs.push(cur); const p = P(x, y); cur.pts.push(p); cur.segs.push(['M', p[0], p[1]]); last = [x, y]; start = [x, y]; };
	for (let i = 0; i < toks.length; i++) {
		const t = toks[i];
		if (t.t !== 'op') { args.push(t); continue; }
		const op = t.v;
		switch (op) {
			case 'q': stack.push({ ...gs, ctm: [...gs.ctm] as M6 }); break;
			case 'Q': if (stack.length) gs = stack.pop()!; break;
			case 'cm': gs.ctm = mul([num(6), num(5), num(4), num(3), num(2), num(1)], gs.ctm); break;
			case 'w': gs.w = num(1); break;
			case 'gs': {
				const eg = asDict(ctx, asDict(ctx, res?.get(PDFName.of('ExtGState')))?.get(PDFName.of(args[args.length - 1]?.v ?? '')));
				const OP = look(ctx, eg?.get(PDFName.of('OP')));
				if (OP instanceof PDFBool) gs.op = OP.asBoolean();
				const LW = look(ctx, eg?.get(PDFName.of('LW')));
				if (LW instanceof PDFNumber) gs.w = LW.asNumber();
				break;
			}
			case 'K': gs.cmyk = [num(4), num(3), num(2), num(1)]; gs.rgb = null; gs.spot = null; break;
			case 'RG': gs.rgb = [num(3), num(2), num(1)]; gs.cmyk = null; gs.spot = null; break;
			case 'G': gs.cmyk = [0, 0, 0, 1 - num(1)]; gs.rgb = null; gs.spot = null; break;
			case 'CS': {
				const nm = args[args.length - 1]?.v ?? '';
				gs.csStroke = nm;
				gs.spot = spotName(ctx, res, nm);
				gs.cmyk = nm === 'DeviceCMYK' ? [0, 0, 0, 1] : null;
				gs.rgb = nm === 'DeviceRGB' ? [0, 0, 0] : null;
				break;
			}
			case 'SC': case 'SCN': {
				const nums = args.filter((a) => a.t === 'num').map((a) => parseFloat(a.v));
				if (gs.csStroke === 'DeviceCMYK' && nums.length === 4) gs.cmyk = nums;
				else if (gs.csStroke === 'DeviceRGB' && nums.length === 3) gs.rgb = nums;
				break;
			}
			case 'm': newSub(num(2), num(1)); break;
			case 'l': { if (!cur) newSub(0, 0); const p = P(num(2), num(1)); cur!.pts.push(p); cur!.segs.push(['L', p[0], p[1]]); last = [num(2), num(1)]; break; }
			case 'c': case 'v': case 'y': {
				if (!cur) newSub(0, 0);
				let x1: number, y1: number, x2: number, y2: number, x3: number, y3: number;
				if (op === 'c') { x1 = num(6); y1 = num(5); x2 = num(4); y2 = num(3); x3 = num(2); y3 = num(1); }
				else if (op === 'v') { x1 = last[0]; y1 = last[1]; x2 = num(4); y2 = num(3); x3 = num(2); y3 = num(1); }
				else { x1 = num(4); y1 = num(3); x2 = num(2); y2 = num(1); x3 = x2; y3 = y2; }
				const a = P(x1, y1), b = P(x2, y2), c = P(x3, y3);
				cur!.segs.push(['C', a[0], a[1], b[0], b[1], c[0], c[1]]);
				cur!.pts.push(a, b, c);
				last = [x3, y3];
				break;
			}
			case 'h': { const c = cur as Stroke['subs'][number] | null; if (c) { c.closed = true; c.segs.push(['Z']); last = start; } break; }
			case 're': {
				const x = num(4), y = num(3), w = num(2), h = num(1);
				newSub(x, y);
				for (const [px, py] of [[x + w, y], [x + w, y + h], [x, y + h]]) { const p = P(px, py); cur!.pts.push(p); cur!.segs.push(['L', p[0], p[1]]); }
				cur!.closed = true; cur!.segs.push(['Z']);
				break;
			}
			case 'S': case 's':
				if (op === 's') for (const sp of subs) if (!sp.closed) { sp.closed = true; sp.segs.push(['Z']); }
				// spessore reale del tratto sulla pagina (la scala della CTM conta)
				strokes.push({ key: source.key, tok: i, op, subs, overprint: gs.op, spot: gs.spot, cmyk: gs.cmyk, rgb: gs.rgb, width: gs.w * Math.sqrt(Math.abs(gs.ctm[0] * gs.ctm[3] - gs.ctm[1] * gs.ctm[2])) });
				subs = []; cur = null; break;
			case 'f': case 'F': case 'f*': case 'B': case 'B*': case 'b': case 'b*': case 'n':
				subs = []; cur = null; break;
			case 'Do': {
				if (depth > 8) break;
				const nm = args[args.length - 1]?.v ?? '';
				const xo = asDict(ctx, res?.get(PDFName.of('XObject')));
				const ref = xo?.get(PDFName.of(nm));
				const st = look(ctx, ref);
				if (st instanceof PDFRawStream && nameOf(ctx, st.dict.get(PDFName.of('Subtype'))) === 'Form') {
					const mArr = look(ctx, st.dict.get(PDFName.of('Matrix')));
					const fm: M6 = mArr instanceof PDFArray && mArr.size() === 6 ? (mArr.asArray().map((v) => (look(ctx, v) as PDFNumber).asNumber()) as M6) : [1, 0, 0, 1, 0, 0];
					const src = decode(ctx, st);
					const child: Source = { key: `${source.key}>${nm}@${ref instanceof PDFRef ? ref.toString() : i}`, src, toks: tokenize(src), res: asDict(ctx, st.dict.get(PDFName.of('Resources'))) ?? res, ref: ref instanceof PDFRef ? ref : undefined, dict: st.dict };
					sources.push(child);
					interpret(ctx, child, mul(fm, gs.ctm), sources, strokes, depth + 1);
				}
				break;
			}
		}
		args.length = 0;
	}
}

/* ------------------------------------------------------------------ riconoscimento del taglio */

const CUT_SPOT = /cut|contour|taglio|passante|kiss|stanz|fustel|die/i;
const pure = (v: number[] | null) => !!v && v.filter((x) => x > 0.98).length === 1 && v.filter((x) => x > 0.02).length === 1;

const isClosed = (s: Stroke) => s.subs.length > 0 && s.subs.every((sp) => sp.closed || (sp.pts.length > 2 && Math.hypot(sp.pts[0][0] - sp.pts[sp.pts.length - 1][0], sp.pts[0][1] - sp.pts[sp.pts.length - 1][1]) < 0.5));
/** colore del tratto come chiave (per raggruppare i candidati) */
export const colorKey = (s: { spot: string | null; cmyk: number[] | null; rgb: number[] | null }) =>
	s.spot ? `spot:${s.spot}` : s.cmyk ? `cmyk:${s.cmyk.map((v) => v.toFixed(2)).join(',')}` : s.rgb ? `rgb:${s.rgb.map((v) => v.toFixed(2)).join(',')}` : 'altro';
const near = (a: number[] | null, b: number[], tol = 0.08) => !!a && a.length === b.length && a.every((v, i) => Math.abs(v - b[i]) <= tol);

function pickCut(strokes: Stroke[], forced?: string): { cut: Stroke[]; reason: string } {
	if (forced) {
		const cut = strokes.filter((s) => isClosed(s) && colorKey(s) === forced);
		return { cut, reason: 'scelto a mano' };
	}
	const closed = (s: Stroke) => s.subs.length > 0 && s.subs.every((sp) => sp.closed || (sp.pts.length > 2 && Math.hypot(sp.pts[0][0] - sp.pts[sp.pts.length - 1][0], sp.pts[0][1] - sp.pts[sp.pts.length - 1][1]) < 0.5));
	const bySpot = strokes.filter((s) => s.spot && CUT_SPOT.test(s.spot));
	if (bySpot.length) return { cut: bySpot, reason: `tinta piatta «${bySpot[0].spot}»` };
	const byOP = strokes.filter((s) => s.overprint && closed(s));
	if (byOP.length) return { cut: byOP, reason: 'tratto in sovrastampa' };
	// tratto chiuso sottile (<= 1,5 pt) in un solo inchiostro al 100%: ciano o magenta pieno (la linea blu dei clienti)
	const byInk = strokes.filter((s) => closed(s) && s.width <= 1.5 && s.cmyk && pure(s.cmyk) && (s.cmyk[0] > 0.98 || s.cmyk[1] > 0.98));
	if (byInk.length) return { cut: byInk, reason: s0(byInk[0]) };
	// il verde "passante" o il fucsia "CutContour" scritti in quadricromia
	const byTech = strokes.filter((s) => closed(s) && s.width <= 2 && (near(s.cmyk, [0.67, 0, 0.88, 0], 0.1) || near(s.cmyk, [0.02, 0.93, 0, 0], 0.1)));
	if (byTech.length) return { cut: byTech, reason: 'tratto nel colore di taglio (passante/CutContour) in quadricromia' };
	const byRgb = strokes.filter((s) => closed(s) && s.width <= 1.5 && s.rgb && ((s.rgb[0] < 0.05 && s.rgb[1] > 0.95 && s.rgb[2] > 0.95) || (s.rgb[0] > 0.95 && s.rgb[1] < 0.05 && s.rgb[2] > 0.95)));
	if (byRgb.length) return { cut: byRgb, reason: 'tratto ciano o magenta (RGB)' };
	return { cut: [], reason: '' };
}
const s0 = (s: Stroke) => `tratto ${s.cmyk![0] > 0.98 ? 'ciano' : 'magenta'} pieno da ${s.width.toFixed(2)} pt`;

/** elenco dei tratti del PDF (per capire un file che non viene riconosciuto) */
export async function inspectStrokes(bytes: Uint8Array) {
	const doc = await PDFDocument.load(bytes, { ignoreEncryption: true, updateMetadata: false });
	const ctx = doc.context, node = doc.getPage(0).node;
	const contents = look(ctx, node.get(PDFName.of('Contents')));
	const parts: PDFObject[] = contents instanceof PDFArray ? contents.asArray() : contents ? [node.get(PDFName.of('Contents'))!] : [];
	const src = parts.map((p) => decode(ctx, p)).join('\n');
	const pageSrc: Source = { key: 'page', src, toks: tokenize(src), res: node.Resources() };
	const strokes: Stroke[] = [];
	interpret(ctx, pageSrc, [1, 0, 0, 1, 0, 0], [pageSrc], strokes);
	return strokes.map((s) => ({ op: s.overprint, spot: s.spot, cmyk: s.cmyk, rgb: s.rgb, w: +s.width.toFixed(2), subs: s.subs.length, closed: s.subs.map((x) => x.closed), key: s.key }));
}

/** tratti chiusi del file raggruppati per colore: tra questi l'operatore sceglie il taglio */
export interface CutCandidate { key: string; label: string; css: string; count: number; wMm: number; hMm: number; widthPt: number }
function candidates(strokes: Stroke[]): CutCandidate[] {
	const groups = new Map<string, Stroke[]>();
	for (const s of strokes) if (isClosed(s)) groups.set(colorKey(s), [...(groups.get(colorKey(s)) ?? []), s]);
	const out: CutCandidate[] = [];
	for (const [key, list] of groups) {
		const b = tightBox(list);
		if (!b) continue;
		const s = list[0];
		const css = s.cmyk ? `rgb(${s.cmyk.slice(0, 3).map((c) => Math.round(255 * (1 - c) * (1 - s.cmyk![3]))).join(',')})` : s.rgb ? `rgb(${s.rgb.map((c) => Math.round(c * 255)).join(',')})` : '#999';
		const label = s.spot ? s.spot : s.cmyk ? `C${Math.round(s.cmyk[0] * 100)} M${Math.round(s.cmyk[1] * 100)} Y${Math.round(s.cmyk[2] * 100)} K${Math.round(s.cmyk[3] * 100)}` : s.rgb ? `RGB ${s.rgb.map((c) => Math.round(c * 255)).join(' ')}` : 'altro';
		out.push({ key, label, css, count: list.reduce((a, x) => a + x.subs.length, 0), wMm: (b[2] - b[0]) * MM, hMm: (b[3] - b[1]) * MM, widthPt: +s.width.toFixed(2) });
	}
	return out.sort((a, b) => b.wMm * b.hMm - a.wMm * a.hMm);
}

/** errore con i candidati: la pagina li mostra e l'operatore sceglie */
export class NeedChoice extends Error {
	constructor(public candidates: CutCandidate[]) { super(candidates.length ? 'Non sono sicuro di quale sia il tracciato di taglio: sceglilo tu.' : 'Nel PDF non c\'è nessun tratto chiuso da usare come taglio.'); }
}

/* ------------------------------------------------------------------ risultato */

export interface ReadyResult {
	/** PDF del cliente con il tracciato tolto (si stampa questo) */
	cleaned: Uint8Array;
	/** tracciato in mm, origine nell'angolo in alto a sinistra del taglio, y verso il basso */
	pathD: string;
	cutW: number;
	cutH: number;
	/** riquadro del taglio sulla pagina del cliente (pt, y verso l'alto) */
	bboxPt: [number, number, number, number];
	/** quanti tracciati chiusi */
	paths: number;
	/** come e' stato riconosciuto */
	reason: string;
	pageMm: [number, number];
}

export async function analyzeReadyPdf(bytes: Uint8Array, forced?: string): Promise<ReadyResult> {
	const doc = await PDFDocument.load(bytes, { ignoreEncryption: true, updateMetadata: false });
	if (doc.getPageCount() < 1) throw new Error('Il PDF non ha pagine.');
	const ctx = doc.context;
	const page = doc.getPage(0);
	const node = page.node;
	const contents = look(ctx, node.get(PDFName.of('Contents')));
	const parts: PDFObject[] = contents instanceof PDFArray ? contents.asArray() : contents ? [node.get(PDFName.of('Contents'))!] : [];
	const src = parts.map((p) => decode(ctx, p)).join('\n');
	const pageSrc: Source = { key: 'page', src, toks: tokenize(src), res: node.Resources() };
	const sources: Source[] = [pageSrc];
	const strokes: Stroke[] = [];
	interpret(ctx, pageSrc, [1, 0, 0, 1, 0, 0], sources, strokes);

	const { cut, reason } = pickCut(strokes, forced);
	if (!cut.length) throw new NeedChoice(candidates(strokes));

	// riquadro e tracciato in mm
	let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
	for (const s of cut) for (const sp of s.subs) for (const [x, y] of sp.pts) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
	// i punti di controllo delle curve possono stare fuori: il riquadro vero si misura sulla curva
	const tight = tightBox(cut);
	if (tight) [x0, y0, x1, y1] = tight;
	const f = (v: number) => (Math.round(v * 1000) / 1000).toString();
	const X = (x: number) => f((x - x0) * MM), Y = (y: number) => f((y1 - y) * MM);
	let d = '', paths = 0;
	for (const s of cut) for (const sp of s.subs) {
		paths++;
		for (const g of sp.segs) {
			if (g[0] === 'M') d += `M${X(g[1])} ${Y(g[2])} `;
			else if (g[0] === 'L') d += `L${X(g[1])} ${Y(g[2])} `;
			else if (g[0] === 'C') d += `C${X(g[1])} ${Y(g[2])} ${X(g[3])} ${Y(g[4])} ${X(g[5])} ${Y(g[6])} `;
			else d += 'Z ';
		}
		if (!sp.closed) d += 'Z ';
	}

	// il tracciato si toglie dalla grafica: l'operatore di pittura diventa "n" (percorso senza pittura)
	const byKey = new Map<string, number[]>();
	for (const s of cut) byKey.set(s.key, [...(byKey.get(s.key) ?? []), s.tok]);
	for (const [key, idxs] of byKey) {
		const so = sources.find((x) => x.key === key)!;
		let out = '', pos = 0;
		for (const k of idxs.sort((a, b) => a - b)) { const t = so.toks[k]; out += so.src.slice(pos, t.s) + 'n'; pos = t.e; }
		out += so.src.slice(pos);
		const enc = Uint8Array.from(out, (ch) => ch.charCodeAt(0) & 0xff);
		if (key === 'page') {
			node.set(PDFName.of('Contents'), ctx.register(ctx.flateStream(enc)));
		} else if (so.ref && so.dict) {
			const dict: Record<string, PDFObject> = {};
			for (const [k, v] of so.dict.entries()) { const n = k.toString().slice(1); if (!['Length', 'Filter', 'DecodeParms'].includes(n)) dict[n] = v; }
			ctx.assign(so.ref, ctx.flateStream(enc, dict));
		}
	}
	void PDFString; void PDFHexString;
	const { width, height } = page.getSize();
	return {
		cleaned: await doc.save({ useObjectStreams: false }),
		pathD: d.trim(),
		cutW: (x1 - x0) * MM,
		cutH: (y1 - y0) * MM,
		bboxPt: [x0, y0, x1, y1],
		paths,
		reason,
		pageMm: [width * MM, height * MM]
	};
}

/** riquadro stretto della curva (campionando le Bezier) */
function tightBox(cut: Stroke[]): [number, number, number, number] | null {
	let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
	const add = (x: number, y: number) => { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); };
	for (const s of cut) for (const sp of s.subs) {
		let cx = 0, cy = 0;
		for (const g of sp.segs) {
			if (g[0] === 'M' || g[0] === 'L') { cx = g[1]; cy = g[2]; add(cx, cy); }
			else if (g[0] === 'C') {
				for (let k = 1; k <= 16; k++) { const t = k / 16, u = 1 - t; add(u * u * u * cx + 3 * u * u * t * g[1] + 3 * u * t * t * g[3] + t * t * t * g[5], u * u * u * cy + 3 * u * u * t * g[2] + 3 * u * t * t * g[4] + t * t * t * g[6]); }
				cx = g[5]; cy = g[6];
			}
		}
	}
	return isFinite(x0) ? [x0, y0, x1, y1] : null;
}
