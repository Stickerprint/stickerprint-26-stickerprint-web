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
import { PDFDocument, PDFName, PDFNumber, PDFOperator, PDFOperatorNames as Op, StandardFonts, degrees, type PDFFont, type PDFPage, type PDFRef, type PDFDict } from 'pdf-lib';
import { markRects, barcodeRects } from './graphtec';
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
	/** crocini e codice a barre Graphtec: il codice del lavoro per ogni pagina */
	graphtecIds?: string[];
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

/*
 * Ogni pagina ha due soli oggetti: il GRUPPO della grafica e il GRUPPO del taglio (due Form XObject:
 * Illustrator e gli altri programmi li aprono come due gruppi, da selezionare o separare con un clic).
 */
function drawPage(page: PDFPage, job: PdfJob, strip: Strip, res: Res, pageIndex: number, font: PDFFont) {
	const { art } = job;
	const ctx = page.doc.context;
	const W = strip.w * PT, H = strip.h * PT;
	const tw = art.cutW + 2 * art.bleed, th = art.cutH + 2 * art.bleed, b = art.bleed;
	const segs = parsePath(art.pathD);
	// sistema di riferimento in millimetri con la y verso il basso
	const mm = () => op(Op.ConcatTransformationMatrix, PT, 0, 0, -PT, 0, H);

	// 1. gruppo GRAFICA
	const artOps: PDFOperator[] = [mm()];
	for (const p of strip.pieces) {
		artOps.push(op(Op.PushGraphicsState), op(Op.ConcatTransformationMatrix, ...pieceMatrix(p, art.cutW, art.cutH)));
		artOps.push(op(Op.ConcatTransformationMatrix, tw, 0, 0, -th, -b, -b + th), op(Op.DrawObject, PDFName.of('Im')), op(Op.PopGraphicsState));
	}
	const artForm = ctx.register(ctx.formXObject(artOps, { BBox: [0, 0, W, H], Resources: { XObject: { Im: res.img } } }));

	// 2. gruppo TAGLIO, in sovrastampa
	const cs: Record<string, PDFRef> = {};
	for (const n of Object.keys(res.cs) as CutSpot[]) cs[n] = res.cs[n];
	const cutOps: PDFOperator[] = [mm(), op(Op.SetGraphicsStateParams, PDFName.of('GS')), op(Op.SetLineWidth, CUT_LINE), op(Op.SetLineJoinStyle, 1)];
	cutOps.push(op(Op.StrokingColorspace, PDFName.of(job.pieceCut)), op(Op.StrokingColorN, 1));
	for (const p of strip.pieces) {
		cutOps.push(op(Op.PushGraphicsState), op(Op.ConcatTransformationMatrix, ...pieceMatrix(p, art.cutW, art.cutH)));
		cutOps.push(...pathOps(segs), op(Op.StrokePath), op(Op.PopGraphicsState));
	}
	if (job.sheetCut && strip.sheets?.length) {
		cutOps.push(op(Op.StrokingColorspace, PDFName.of(job.sheetCut)), op(Op.StrokingColorN, 1));
		for (const s of strip.sheets) cutOps.push(op(Op.AppendRectangle, s.x, s.y, s.w, s.h), op(Op.StrokePath));
	}
	const cutForm = ctx.register(ctx.formXObject(cutOps, { BBox: [0, 0, W, H], Resources: { ColorSpace: cs, ExtGState: { GS: res.gs } } }));

	const node = page.node;
	/* 3. gruppo CROCINI e codici a barre Graphtec (nero pieno, si stampa) */
	const gid = job.graphtecIds?.[pageIndex];
	let nMarks: PDFName | null = null;
	if (gid) {
		const bc = barcodeRects(strip.w, strip.h, gid);
		const mOps: PDFOperator[] = [mm(), op(Op.NonStrokingColorGray, 0)];
		for (const r of [...markRects(strip.w, strip.h), ...bc.rects]) mOps.push(op(Op.AppendRectangle, r.x, r.y, r.w, r.h));
		mOps.push(op(Op.FillNonZero));
		const marksForm = ctx.register(ctx.formXObject(mOps, { BBox: [0, 0, W, H], Resources: {} }));
		nMarks = node.newXObject('Crocini', marksForm);
		// codice leggibile accanto ai codici a barre
		for (const l of bc.labels) {
			const size = 6.5, tw = font.widthOfTextAtSize(l.text, size);
			if (!l.rot180) page.drawText(l.text, { x: l.x * PT - tw, y: H - l.y * PT - size * 0.35, size, font });
			else page.drawText(l.text, { x: l.x * PT + tw, y: H - l.y * PT + size * 0.35, size, font, rotate: degrees(180) });
		}
	}
	const nArt = node.newXObject('Grafica', artForm);
	const nCut = node.newXObject('Taglio', cutForm);
	page.pushOperators(op(Op.PushGraphicsState), op(Op.DrawObject, nArt), op(Op.PopGraphicsState));
	if (nMarks) page.pushOperators(op(Op.PushGraphicsState), op(Op.DrawObject, nMarks), op(Op.PopGraphicsState));
	/* striscia con crocini Graphtec: il taglio va al plotter da Data Link Server, nel PDF da stampare
	   restano solo grafica, crocini e codici a barre */
	if (!gid) page.pushOperators(op(Op.PushGraphicsState), op(Op.DrawObject, nCut), op(Op.PopGraphicsState));
}

export async function buildPdf(job: PdfJob): Promise<Uint8Array> {
	const pdf = await PDFDocument.create();
	pdf.setTitle(job.title);
	pdf.setCreator('Stickerprint Studio');
	pdf.setProducer('Stickerprint Studio');
	const img = await pdf.embedPng(job.art.png);
	const res = setupResources(pdf, img.ref);
	const font = await pdf.embedFont(StandardFonts.Helvetica);
	job.pages.forEach((strip, i) => {
		const page = pdf.addPage([strip.w * PT, strip.h * PT]);
		drawPage(page, job, strip, res, i, font);
	});
	return pdf.save({ useObjectStreams: false });
}

/** file singolo: un pezzo, pagina grande quanto il taglio piu' l'abbondanza */
export function singleStrip(art: Artwork): Strip {
	return { w: art.cutW + 2 * art.bleed, h: art.cutH + 2 * art.bleed, pieces: [{ x: art.bleed, y: art.bleed, rot: false }] };
}
