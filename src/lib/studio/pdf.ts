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
import { markRects, barcodeRects, MARK_BLACK } from './graphtec';
import type { Placement, Strip } from './layout';

import { SPOTS, GLOSS, type CutSpot } from './spots';
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
	/** PNG della grafica di stampa, abbondanza compresa (file del sito) */
	png?: Uint8Array;
	/** oppure la pagina di un PDF pronto del cliente (vettoriale), gia' ripulita dal tracciato:
	    `bboxPt` e' il riquadro del taglio sulla pagina (pt, y verso l'alto) */
	pdfPage?: { bytes: Uint8Array; bboxPt: [number, number, number, number] };
	cutW: number;
	cutH: number;
	bleed: number;
	pathD: string;
	/** adesivi in rilievo: le zone in rilievo, in tracciato, tinta RDG_GLOSS (mm, come pathD) */
	glossD?: string;
	/** tinta di taglio di QUESTO soggetto: serve quando sulla striscia ce n'e' piu' d'uno
	    (un foglio di etichette mezzo-tagliate accanto a sagome passanti). Senza, vale quella del lavoro. */
	pieceCut?: CutSpot;
}

export interface PdfJob {
	title: string;
	/** i soggetti stampati sulla striscia: di solito uno, piu' d'uno quando si monta un ordine intero.
	    Ogni pezzo dice a quale appartiene con `Placement.a` (manca = il primo). */
	arts: Artwork[];
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
	/** una grafica per soggetto, nello stesso ordine di `PdfJob.arts` */
	imgs: PDFRef[];
	/** per ogni soggetto: la grafica e' una pagina PDF vettoriale (non un'immagine) */
	vector: boolean[];
	cs: Record<CutSpot, PDFRef>;
	gloss: PDFRef;
	gs: PDFRef;
}

function setupResources(pdf: PDFDocument, imgs: PDFRef[], vector: boolean[]): Res {
	const ctx = pdf.context;
	const cs = {} as Record<CutSpot, PDFRef>;
	for (const name of Object.keys(SPOTS) as CutSpot[]) {
		const fn = ctx.register(ctx.obj({ FunctionType: 2, Domain: [0, 1], C0: [0, 0, 0, 0], C1: SPOTS[name].cmyk, N: 1 }));
		cs[name] = ctx.register(ctx.obj([PDFName.of('Separation'), PDFName.of(name), PDFName.of('DeviceCMYK'), fn]));
	}
	// rilievo UV: stessa costruzione, tinta piatta RDG_GLOSS
	const fnG = ctx.register(ctx.obj({ FunctionType: 2, Domain: [0, 1], C0: [0, 0, 0, 0], C1: GLOSS.cmyk, N: 1 }));
	const gloss = ctx.register(ctx.obj([PDFName.of('Separation'), PDFName.of(GLOSS.name), PDFName.of('DeviceCMYK'), fnG]));
	// sovrastampa: il tracciato non buca la grafica sotto
	const gs = ctx.register(ctx.obj({ Type: 'ExtGState', OP: true, op: true, OPM: 1 }));
	return { imgs, vector, cs, gloss, gs };
}

/*
 * Ogni pagina ha due soli oggetti: il GRUPPO della grafica e il GRUPPO del taglio (due Form XObject:
 * Illustrator e gli altri programmi li aprono come due gruppi, da selezionare o separare con un clic).
 */
function drawPage(page: PDFPage, job: PdfJob, strip: Strip, res: Res, pageIndex: number, font: PDFFont) {
	const ctx = page.doc.context;
	const W = strip.w * PT, H = strip.h * PT;
	// sistema di riferimento in millimetri con la y verso il basso
	const mm = () => op(Op.ConcatTransformationMatrix, PT, 0, 0, -PT, 0, H);
	/* i pezzi divisi per soggetto: `a` dice quale grafica usa ogni pezzo (manca = la prima) */
	const perSoggetto = job.arts.map((_, i) => strip.pieces.filter((p) => (p.a ?? 0) === i));
	const nome = (i: number) => `Im${i}`;

	// 1. gruppo GRAFICA
	const artOps: PDFOperator[] = [mm()];
	const risorse: Record<string, PDFRef> = {};
	job.arts.forEach((art, i) => {
		if (!perSoggetto[i].length) return;
		risorse[nome(i)] = res.imgs[i];
		const tw = art.cutW + 2 * art.bleed, th = art.cutH + 2 * art.bleed, b = art.bleed;
		for (const p of perSoggetto[i]) {
			artOps.push(op(Op.PushGraphicsState), op(Op.ConcatTransformationMatrix, ...pieceMatrix(p, art.cutW, art.cutH)));
			// immagine: quadrato unitario; pagina PDF del cliente: punti tipografici con la y verso l'alto
			if (res.vector[i]) artOps.push(op(Op.ConcatTransformationMatrix, 1 / PT, 0, 0, -1 / PT, -b, art.cutH + b));
			else artOps.push(op(Op.ConcatTransformationMatrix, tw, 0, 0, -th, -b, -b + th));
			artOps.push(op(Op.DrawObject, PDFName.of(nome(i))), op(Op.PopGraphicsState));
		}
	});
	const artForm = ctx.register(ctx.formXObject(artOps, { BBox: [0, 0, W, H], Resources: { XObject: risorse } }));

	/* 1-bis. gruppo RILIEVO (adesivi in rilievo): le zone in rilievo in tinta piatta RDG_GLOSS.
	   Deve essere vettoriale, altrimenti la Roland non lo legge; sta SOTTO la grafica. */
	let glossForm: PDFRef | null = null;
	if (job.arts.some((a) => a.glossD)) {
		const gOps: PDFOperator[] = [mm(), op(Op.NonStrokingColorspace, PDFName.of(GLOSS.name)), op(Op.NonStrokingColorN, 1)];
		job.arts.forEach((art, i) => {
			if (!art.glossD) return;
			const gsegs = parsePath(art.glossD);
			for (const p of perSoggetto[i]) {
				gOps.push(op(Op.PushGraphicsState), op(Op.ConcatTransformationMatrix, ...pieceMatrix(p, art.cutW, art.cutH)));
				gOps.push(...pathOps(gsegs), op(Op.FillEvenOdd), op(Op.PopGraphicsState));
			}
		});
		glossForm = ctx.register(ctx.formXObject(gOps, { BBox: [0, 0, W, H], Resources: { ColorSpace: { [GLOSS.name]: res.gloss } } }));
	}

	// 2. gruppo TAGLIO, in sovrastampa: una passata per tinta, cosi' il file resta ordinato
	const cs: Record<string, PDFRef> = {};
	for (const n of Object.keys(res.cs) as CutSpot[]) cs[n] = res.cs[n];
	const cutOps: PDFOperator[] = [mm(), op(Op.SetGraphicsStateParams, PDFName.of('GS')), op(Op.SetLineWidth, CUT_LINE), op(Op.SetLineJoinStyle, 1)];
	const tinte = new Map<CutSpot, number[]>();
	job.arts.forEach((art, i) => {
		if (!perSoggetto[i].length) return;
		const t = art.pieceCut ?? job.pieceCut;
		tinte.set(t, [...(tinte.get(t) ?? []), i]);
	});
	for (const [tinta, quali] of tinte) {
		cutOps.push(op(Op.StrokingColorspace, PDFName.of(tinta)), op(Op.StrokingColorN, 1));
		for (const i of quali) {
			const art = job.arts[i], segs = parsePath(art.pathD);
			for (const p of perSoggetto[i]) {
				cutOps.push(op(Op.PushGraphicsState), op(Op.ConcatTransformationMatrix, ...pieceMatrix(p, art.cutW, art.cutH)));
				cutOps.push(...pathOps(segs), op(Op.StrokePath), op(Op.PopGraphicsState));
			}
		}
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
		/* stesso nero ricco dei file di Cutting Master (C91 M79 Y62 K97): col grigio 0 VersaWorks
		   stampava un nero che il sensore del Graphtec non leggeva */
		const mOps: PDFOperator[] = [mm(), op(Op.NonStrokingColorCmyk, ...MARK_BLACK)];
		for (const r of [...markRects(strip.w, strip.h), ...bc.rects]) mOps.push(op(Op.AppendRectangle, r.x, r.y, r.w, r.h));
		mOps.push(op(Op.FillNonZero));
		const marksForm = ctx.register(ctx.formXObject(mOps, { BBox: [0, 0, W, H], Resources: {} }));
		nMarks = node.newXObject('Crocini', marksForm);
		/* niente scritte accanto ai codici: il Code 39 vuole almeno 10 moduli (4 mm) di bianco ai lati,
		   una scritta a 3 mm ne impediva la lettura. Cutting Master non ne mette. */
	}
	void font;
	const nGloss = glossForm ? node.newXObject('Rilievo', glossForm) : null;
	const nArt = node.newXObject('Grafica', artForm);
	const nCut = node.newXObject('Taglio', cutForm);
	if (nGloss) page.pushOperators(op(Op.PushGraphicsState), op(Op.DrawObject, nGloss), op(Op.PopGraphicsState));
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
	const imgs: PDFRef[] = [], vector: boolean[] = [];
	for (const art of job.arts) {
		if (art.pdfPage) {
			// pagina del cliente ritagliata attorno al taglio, con l'abbondanza: resta vettoriale
			const src = await PDFDocument.load(art.pdfPage.bytes, { ignoreEncryption: true });
			const [x0, y0, x1, y1] = art.pdfPage.bboxPt, bp = art.bleed * PT;
			const emb = await pdf.embedPage(src.getPage(0), { left: x0 - bp, bottom: y0 - bp, right: x1 + bp, top: y1 + bp });
			imgs.push(emb.ref); vector.push(true);
		} else {
			if (!art.png) throw new Error('Manca la grafica da stampare.');
			const img = await pdf.embedPng(art.png);
			imgs.push(img.ref); vector.push(false);
		}
	}
	const res = setupResources(pdf, imgs, vector);
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
