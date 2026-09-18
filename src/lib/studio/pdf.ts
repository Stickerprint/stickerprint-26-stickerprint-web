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

import { parsePath, type Seg } from './path';
export { parsePath };

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
