/**
 * Stickerprint Studio — PDF per la Roland (VersaWorks).
 *
 * La grafica e' un'immagine (PNG del motore, abbondanza compresa) inserita UNA volta e
 * richiamata per ogni pezzo: il file resta leggero anche con centinaia di copie.
 * I tagli sono tracciati vettoriali in tinta piatta (Separation) con il nome esatto che
 * VersaWorks riconosce, in sovrastampa:
 *   Passante   — taglio passante (fustellato), verde C67 M0 Y88 K0
 *   CutContour — mezzo taglio, fucsia C2 M93 Y0 K0
 * (valori presi dai file di produzione Roland dell'azienda)
 */
import { PDFDocument, PDFName, PDFNumber, PDFOperator, PDFOperatorNames as Op, type PDFPage, type PDFRef, type PDFDict } from 'pdf-lib';
import type { Placement, Strip } from './layout';

import { SPOTS, type CutSpot } from './spots';
export { SPOTS, type CutSpot };

const PT = 72 / 25.4;
/** spessore del tracciato di taglio (mm): lo legge il plotter, non si stampa */
const CUT_LINE = 0.1;

/* ------------------------------------------------------------ tracciato SVG */

type Seg = ['M', number, number] | ['L', number, number] | ['C', number, number, number, number, number, number] | ['Z'];

/** Converte il `d` di un path SVG (quello del motore) in segmenti assoluti M/L/C/Z. */
export function parsePath(d: string): Seg[] {
	const tok = d.match(/[a-zA-Z]|[-+]?(?:\d*\.\d+|\d+\.?)(?:[eE][-+]?\d+)?/g) ?? [];
	const out: Seg[] = [];
	let i = 0, cmd = '', x = 0, y = 0, sx = 0, sy = 0;
	const num = () => parseFloat(tok[i++]);
	const isNum = () => i < tok.length && !/^[a-zA-Z]$/.test(tok[i]);
	while (i < tok.length) {
		if (/^[a-zA-Z]$/.test(tok[i])) cmd = tok[i++];
		const rel = cmd === cmd.toLowerCase();
		const C = cmd.toUpperCase();
		if (C === 'Z') { out.push(['Z']); x = sx; y = sy; continue; }
		if (!isNum()) { i++; continue; }
		if (C === 'M') {
			x = (rel ? x : 0) + num(); y = (rel ? y : 0) + num();
			out.push(['M', x, y]); sx = x; sy = y;
			cmd = rel ? 'l' : 'L'; // coppie successive = linee
		} else if (C === 'L') {
			x = (rel ? x : 0) + num(); y = (rel ? y : 0) + num(); out.push(['L', x, y]);
		} else if (C === 'H') {
			x = (rel ? x : 0) + num(); out.push(['L', x, y]);
		} else if (C === 'V') {
			y = (rel ? y : 0) + num(); out.push(['L', x, y]);
		} else if (C === 'C') {
			const ox = rel ? x : 0, oy = rel ? y : 0;
			const a = [ox + num(), oy + num(), ox + num(), oy + num(), ox + num(), oy + num()];
			out.push(['C', a[0], a[1], a[2], a[3], a[4], a[5]]); x = a[4]; y = a[5];
		} else if (C === 'A') {
			const rx = num(), ry = num(), rotDeg = num(), large = num(), sweep = num();
			const ex = (rel ? x : 0) + num(), ey = (rel ? y : 0) + num();
			for (const c of arcToCubic(x, y, rx, ry, rotDeg, !!large, !!sweep, ex, ey)) out.push(c);
			x = ex; y = ey;
		} else {
			i++; // comando non gestito (il motore non li usa): si salta il numero
		}
	}
	return out;
}

/** Arco ellittico SVG -> curve di Bezier (spezzato in archi da al massimo 90 gradi). */
function arcToCubic(x1: number, y1: number, rx: number, ry: number, rotDeg: number, large: boolean, sweep: boolean, x2: number, y2: number): Seg[] {
	if (rx === 0 || ry === 0) return [['L', x2, y2]];
	rx = Math.abs(rx); ry = Math.abs(ry);
	const phi = (rotDeg * Math.PI) / 180, cos = Math.cos(phi), sin = Math.sin(phi);
	const dx = (x1 - x2) / 2, dy = (y1 - y2) / 2;
	const xp = cos * dx + sin * dy, yp = -sin * dx + cos * dy;
	const lam = (xp * xp) / (rx * rx) + (yp * yp) / (ry * ry);
	if (lam > 1) { const s = Math.sqrt(lam); rx *= s; ry *= s; }
	const num = rx * rx * ry * ry - rx * rx * yp * yp - ry * ry * xp * xp;
	const den = rx * rx * yp * yp + ry * ry * xp * xp;
	let k = Math.sqrt(Math.max(0, num / den));
	if (large === sweep) k = -k;
	const cxp = (k * rx * yp) / ry, cyp = (-k * ry * xp) / rx;
	const cx = cos * cxp - sin * cyp + (x1 + x2) / 2, cy = sin * cxp + cos * cyp + (y1 + y2) / 2;
	const ang = (ux: number, uy: number, vx: number, vy: number) => {
		const a = Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy);
		return a;
	};
	const t1 = ang(1, 0, (xp - cxp) / rx, (yp - cyp) / ry);
	let dt = ang((xp - cxp) / rx, (yp - cyp) / ry, (-xp - cxp) / rx, (-yp - cyp) / ry);
	if (!sweep && dt > 0) dt -= 2 * Math.PI;
	if (sweep && dt < 0) dt += 2 * Math.PI;
	const n = Math.max(1, Math.ceil(Math.abs(dt) / (Math.PI / 2) - 1e-9));
	const step = dt / n, alpha = (4 / 3) * Math.tan(step / 4);
	const pt = (t: number) => [cx + rx * Math.cos(t) * cos - ry * Math.sin(t) * sin, cy + rx * Math.cos(t) * sin + ry * Math.sin(t) * cos];
	const der = (t: number) => [-rx * Math.sin(t) * cos - ry * Math.cos(t) * sin, -rx * Math.sin(t) * sin + ry * Math.cos(t) * cos];
	const out: Seg[] = [];
	for (let j = 0; j < n; j++) {
		const a = t1 + j * step, b = a + step;
		const [ax, ay] = pt(a), [bx, by] = pt(b), [dax, day] = der(a), [dbx, dby] = der(b);
		out.push(['C', ax + alpha * dax, ay + alpha * day, bx - alpha * dbx, by - alpha * dby, bx, by]);
	}
	return out;
}

/* ------------------------------------------------------------ operatori */

const r4 = (v: number) => Math.round(v * 10000) / 10000;
const op = (name: Op, ...args: (number | PDFName)[]) => PDFOperator.of(name, args.map((a) => (typeof a === 'number' ? PDFNumber.of(r4(a)) : a)));

function pathOps(segs: Seg[]): PDFOperator[] {
	const out: PDFOperator[] = [];
	for (const s of segs) {
		if (s[0] === 'M') out.push(op(Op.MoveTo, s[1], s[2]));
		else if (s[0] === 'L') out.push(op(Op.LineTo, s[1], s[2]));
		else if (s[0] === 'C') out.push(op(Op.AppendBezierCurve, s[1], s[2], s[3], s[4], s[5], s[6]));
		else out.push(op(Op.ClosePath));
	}
	return out;
}

/** matrice del pezzo: dal suo sistema (mm, origine nell'angolo del taglio) alla pagina */
function pieceMatrix(p: Placement, cutW: number, cutH: number): [number, number, number, number, number, number] {
	void cutW;
	// girato di 90 gradi in senso orario (y verso il basso): (px, py) -> (x + cutH - py, y + px)
	return p.rot ? [0, 1, -1, 0, p.x + cutH, p.y] : [1, 0, 0, 1, p.x, p.y];
}

/* ------------------------------------------------------------ documento */

export interface Artwork {
	/** PNG della grafica di stampa, abbondanza compresa */
	png: Uint8Array;
	cutW: number;
	cutH: number;
	bleed: number;
	pathD: string;
}

export interface PdfJob {
	title: string;
	art: Artwork;
	/** una pagina per striscia (o una sola pagina per il file singolo) */
	pages: Strip[];
	/** taglio sui pezzi */
	pieceCut: CutSpot;
	/** taglio sul bordo dei fogli (resinati, etichette) */
	sheetCut?: CutSpot;
}

interface Res {
	img: PDFRef;
	cs: Record<CutSpot, PDFRef>;
	gs: PDFRef;
}

function setupResources(pdf: PDFDocument, imgRef: PDFRef): Res {
	const ctx = pdf.context;
	const cs = {} as Record<CutSpot, PDFRef>;
	for (const name of Object.keys(SPOTS) as CutSpot[]) {
		const fn = ctx.register(ctx.obj({ FunctionType: 2, Domain: [0, 1], C0: [0, 0, 0, 0], C1: SPOTS[name].cmyk, N: 1 }));
		cs[name] = ctx.register(ctx.obj([PDFName.of('Separation'), PDFName.of(name), PDFName.of('DeviceCMYK'), fn]));
	}
	// sovrastampa: il tracciato non buca la grafica sotto
	const gs = ctx.register(ctx.obj({ Type: 'ExtGState', OP: true, op: true, OPM: 1 }));
	return { img: imgRef, cs, gs };
}

function drawPage(page: PDFPage, job: PdfJob, strip: Strip, res: Res) {
	const { art } = job;
	const node = page.node;
	const imName = node.newXObject('Im', res.img);
	const gsName = node.newExtGState('GS', res.gs);
	const { Resources } = node.normalizedEntries();
	const csDict = page.doc.context.obj({}) as PDFDict;
	for (const n of Object.keys(res.cs) as CutSpot[]) csDict.set(PDFName.of(n), res.cs[n]);
	Resources.set(PDFName.of('ColorSpace'), csDict);

	const tw = art.cutW + 2 * art.bleed, th = art.cutH + 2 * art.bleed, b = art.bleed;
	const segs = parsePath(art.pathD);
	const ops: PDFOperator[] = [];
	// sistema di riferimento in millimetri con la y verso il basso
	ops.push(op(Op.PushGraphicsState), op(Op.ConcatTransformationMatrix, PT, 0, 0, -PT, 0, strip.h * PT));

	// 1. grafica
	for (const p of strip.pieces) {
		ops.push(op(Op.PushGraphicsState), op(Op.ConcatTransformationMatrix, ...pieceMatrix(p, art.cutW, art.cutH)));
		ops.push(op(Op.ConcatTransformationMatrix, tw, 0, 0, -th, -b, -b + th), op(Op.DrawObject, imName), op(Op.PopGraphicsState));
	}

	// 2. tagli, in sovrastampa
	ops.push(op(Op.PushGraphicsState), op(Op.SetGraphicsStateParams, gsName), op(Op.SetLineWidth, CUT_LINE), op(Op.SetLineJoinStyle, 1));
	ops.push(op(Op.StrokingColorspace, PDFName.of(job.pieceCut)), op(Op.StrokingColorN, 1));
	for (const p of strip.pieces) {
		ops.push(op(Op.PushGraphicsState), op(Op.ConcatTransformationMatrix, ...pieceMatrix(p, art.cutW, art.cutH)));
		ops.push(...pathOps(segs), op(Op.StrokePath), op(Op.PopGraphicsState));
	}
	if (job.sheetCut && strip.sheets?.length) {
		ops.push(op(Op.StrokingColorspace, PDFName.of(job.sheetCut)), op(Op.StrokingColorN, 1));
		for (const s of strip.sheets) ops.push(op(Op.AppendRectangle, s.x, s.y, s.w, s.h), op(Op.StrokePath));
	}
	ops.push(op(Op.PopGraphicsState), op(Op.PopGraphicsState));
	page.pushOperators(...ops);
}

export async function buildPdf(job: PdfJob): Promise<Uint8Array> {
	const pdf = await PDFDocument.create();
	pdf.setTitle(job.title);
	pdf.setCreator('Stickerprint Studio');
	pdf.setProducer('Stickerprint Studio');
	const img = await pdf.embedPng(job.art.png);
	const res = setupResources(pdf, img.ref);
	for (const strip of job.pages) {
		const page = pdf.addPage([strip.w * PT, strip.h * PT]);
		drawPage(page, job, strip, res);
	}
	return pdf.save({ useObjectStreams: false });
}

/** file singolo: un pezzo, pagina grande quanto il taglio piu' l'abbondanza */
export function singleStrip(art: Artwork): Strip {
	return { w: art.cutW + 2 * art.bleed, h: art.cutH + 2 * art.bleed, pieces: [{ x: art.bleed, y: art.bleed, rot: false }] };
}
