/**
 * Ordine etichette tonde 11,9 mm — impaginazione a fogli da 320 (16x20, spazio 1,1 mm),
 * 3 fogli per striscia da 70 cm. Per ogni striscia: PDF di stampa (grafica + crocini e
 * codici a barre Graphtec) e file di taglio .xpf per Data Link Server.
 */
import { readFileSync, writeFileSync, readdirSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { PDFDocument, PDFName, PDFNumber, PDFOperator, PDFOperatorNames as Op, type PDFRef } from 'pdf-lib';
import { markRects, barcodeRects, MARK, MARK_BLACK, buildXpf, newJobId, xpfJobId, pageWidthFor, DEFAULT_COND, type XpfJob } from '../src/lib/studio/graphtec';
import type { Placement, Strip } from '../src/lib/studio/layout';

const PT = 72 / 25.4, MM = 25.4 / 72;
const r4 = (v: number) => Math.round(v * 10000) / 10000;
const op = (name: Op, ...args: (number | PDFName)[]) =>
	PDFOperator.of(name, args.map((a) => (typeof a === 'number' ? PDFNumber.of(r4(a)) : a)));

/* ------------------------------------------------------------------ misure */

const LABEL = 11.9;              // diametro etichetta
const PITCH = LABEL + 1.1;       // 13,0 mm da taglio a taglio
const COLS = 16, ROWS = 20, PER_SHEET = COLS * ROWS;   // 320
const BORDER = 10.0;             // bordo bianco fra l'ultima etichetta e il taglio passante
const GAP = 7.0;                 // spazio fra un foglio e l'altro (chiesto 7-10 mm: tengo il minimo,
                                 // ogni mm in piu' toglie mezzo mm di margine per lato)
const ACROSS = 3;                // i fogli vanno tutti in fila, affiancati
const SHEET_W = (COLS - 1) * PITCH + LABEL + 2 * BORDER;   // 226,9
const SHEET_H = (ROWS - 1) * PITCH + LABEL + 2 * BORDER;   // 278,9
const ROLL = 720;                                          // bobina
const PAGE_W = pageWidthFor(ROLL);                         // 708

/*
 * Tre fogli in fila occupano 694,7 mm: non ci starebbero dentro i 26,5 mm di margine
 * laterale dello studio (635 mm utili). Si guadagna spazio tenendo i fogli FUORI dalla
 * fascia dei crocini invece che di fianco: i bracci stanno fra 14,5 e 35 mm dal bordo
 * alto e basso, quindi con 40 mm di margine sopra e sotto restano i 5 mm d'aria di
 * MARKED_MARGIN.y e la larghezza si libera tutta.
 */
const MY = Math.max(MARK.edge + MARK.thick / 2 + MARK.arm - MARK.edge + 5, 40);   // 40
const PAGE_H = Math.round((SHEET_H + 2 * MY) * 10) / 10;                          // 358,9
const X0 = (PAGE_W - (ACROSS * SHEET_W + (ACROSS - 1) * GAP)) / 2;                // 6,65

/** i fogli: tutti su una riga, centrati sulla striscia */
function disponiFogli(n: number): { x: number; y: number }[] {
	if (n > ACROSS) throw new Error(`${n} fogli: su una riga ne stanno ${ACROSS}`);
	const x0 = (PAGE_W - (n * SHEET_W + (n - 1) * GAP)) / 2;
	return Array.from({ length: n }, (_, i) => ({ x: x0 + i * (SHEET_W + GAP), y: MY }));
}

/** controlli di sicurezza: i fogli non devono toccare crocini e codici a barre */
function verificaSpazi() {
	const arm = MARK.edge + MARK.arm;                       // 35: fine del braccio
	if (MY - arm < 5) throw new Error(`solo ${(MY - arm).toFixed(1)} mm fra crocino e foglio`);
	if (PAGE_H - MY - SHEET_H < 5) throw new Error('fogli troppo vicini ai crocini in basso');
	if (MY - MARK.barH < 4) throw new Error('fogli troppo vicini al codice a barre');
	if (X0 < 5) throw new Error(`margine laterale di soli ${X0.toFixed(1)} mm`);
	console.log(`bobina ${ROLL} mm, pagina ${PAGE_W} mm: i fogli restano a ${(X0 + (ROLL - PAGE_W) / 2).toFixed(2)} mm dal bordo del materiale`);
	console.log(`foglio ${SHEET_W}x${SHEET_H} mm (bordo ${BORDER}) — striscia ${PAGE_W}x${PAGE_H} mm`);
	console.log(`  ${ACROSS} in fila, ${GAP} mm di stacco, margine laterale ${X0.toFixed(2)} mm, sopra/sotto ${MY} mm`);
	console.log(`  aria dai crocini: ${(MY - arm).toFixed(1)} mm sopra, ${(PAGE_H - MY - SHEET_H - arm).toFixed(1)} mm sotto`);
}
const FEED = 42;

/** cerchio di taglio, origine nell'angolo del riquadro del taglio (mm, y in giu') */
function circlePath(d: number): string {
	const r = d / 2, k = r * 0.5522847498;
	return `M ${r} 0 C ${r + k} 0 ${d} ${r - k} ${d} ${r} C ${d} ${r + k} ${r + k} ${d} ${r} ${d} ` +
		`C ${r - k} ${d} 0 ${r + k} 0 ${r} C 0 ${r - k} ${r - k} 0 ${r} 0 Z`;
}
const CUT_D = circlePath(LABEL);

/* ------------------------------------------------------------------ loghi */

interface Logo { src: string; cx_pt: number; cy_pt: number; Dref_pt: number; Dref_mm: number; target_mm: number; clip_mm: number }
const LOGHI: Record<string, Logo> = JSON.parse(readFileSync(process.argv[3], 'utf8'));

/* ------------------------------------------------------------------ ordine */

type Fill = { logo: string; n: number };
interface Foglio { nome: string; fill: Fill[] }
interface Striscia { nome: string; fogli: Foglio[] }

const STRISCE: Striscia[] = [
	{ nome: '01', fogli: [
		{ nome: 'fiat', fill: [{ logo: 'fiat', n: 320 }] },
		{ nome: 'fiat', fill: [{ logo: 'fiat', n: 320 }] },
		{ nome: 'fiat', fill: [{ logo: 'fiat', n: 320 }] } ] },
	{ nome: '02', fogli: [
		{ nome: 'fiat', fill: [{ logo: 'fiat', n: 320 }] },
		{ nome: 'fiat', fill: [{ logo: 'fiat', n: 320 }] },
		{ nome: 'aa220-vw100', fill: [{ logo: 'aa', n: 220 }, { logo: 'vw_nero', n: 100 }] } ] },
	{ nome: '03', fogli: [
		{ nome: 'mp', fill: [{ logo: 'mp', n: 320 }] },
		{ nome: 'suzuki160-ingranaggio160', fill: [{ logo: 'suzuki', n: 160 }, { logo: 'ingranaggio', n: 160 }] },
		{ nome: 'zacco160-frimperia160', fill: [{ logo: 'zacco', n: 160 }, { logo: 'fr_imperia', n: 160 }] } ] }
];

/** posizioni delle etichette dentro un foglio, in ordine di lettura */
function slots(sx: number, sy: number): { x: number; y: number }[] {
	const out = [];
	for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++)
		out.push({ x: sx + BORDER + c * PITCH, y: sy + BORDER + r * PITCH });
	return out;
}

/* ------------------------------------------------------------------ PDF */

async function build() {
	const outDir = process.argv[2];
	verificaSpazi();
	mkdirSync(outDir, { recursive: true });

	// codici lavoro gia' usati da Data Link Server
	const dls = '/Users/stickerprint/Library/Application Support/Graphtec Corporation/dls/cut_jobs';
	const taken = new Set<string>();
	try {
		for (const f of readdirSync(dls)) {
			if (!f.toLowerCase().endsWith('.xpf')) continue;
			const id = xpfJobId(new Uint8Array(readFileSync(join(dls, f)).subarray(0, 80)));
			if (id) taken.add(id);
		}
	} catch { /* cartella non raggiungibile */ }
	console.log(`codici gia' in uso a Data Link Server: ${taken.size}`);

	const riepilogo: string[] = [];

	for (const striscia of STRISCE) {
		const pdf = await PDFDocument.create();
		pdf.setTitle(`Etichette 11,9 mm — striscia ${striscia.nome}`);
		pdf.setCreator('Stickerprint Studio'); pdf.setProducer('Stickerprint Studio');
		const ctx = pdf.context;

		// un Form XObject per logo, in mm y-in-su, riquadro 11,9 x 11,9
		const forms: Record<string, PDFRef> = {};
		const usati = new Set<string>();
		for (const f of striscia.fogli) if (f) for (const p of f.fill) usati.add(p.logo);

		for (const key of usati) {
			const ops: PDFOperator[] = [];
			const res: Record<string, unknown> = {};
			{

				const L = LOGHI[key];
				const src = await PDFDocument.load(readFileSync(L.src), { ignoreEncryption: true });
				const h = L.Dref_pt / 2;
				const emb = await pdf.embedPage(src.getPage(0), {
					left: L.cx_pt - h, bottom: L.cy_pt - h, right: L.cx_pt + h, top: L.cy_pt + h
				});
				res.XObject = { Lg: emb.ref };
				const s = L.target_mm / L.Dref_mm;
				// ritaglio tondo: toglie il cerchietto-guida del cliente
				const cd = L.clip_mm * s, cr = cd / 2, k = cr * 0.5522847498, C = LABEL / 2;
				ops.push(op(Op.MoveTo, C + cr, C),
					op(Op.AppendBezierCurve, C + cr, C + k, C + k, C + cr, C, C + cr),
					op(Op.AppendBezierCurve, C - k, C + cr, C - cr, C + k, C - cr, C),
					op(Op.AppendBezierCurve, C - cr, C - k, C - k, C - cr, C, C - cr),
					op(Op.AppendBezierCurve, C + k, C - cr, C + cr, C - k, C + cr, C),
					op(Op.ClosePath), op(Op.ClipNonZero), op(Op.EndPath));
				const kk = MM * s;   // da punti del PDF incorporato a mm di pagina
				ops.push(op(Op.ConcatTransformationMatrix, kk, 0, 0, kk, C - L.target_mm / 2, C - L.target_mm / 2),
					op(Op.DrawObject, PDFName.of('Lg')));
			}
			forms[key] = ctx.register(ctx.formXObject(ops, { BBox: [0, 0, LABEL, LABEL], Resources: res }));
		}

		const posFogli = disponiFogli(striscia.fogli.length);
		const page = pdf.addPage([PAGE_W * PT, PAGE_H * PT]);
		const node = page.node;

		// gruppo GRAFICA (mm, y in giu')
		const mm = () => op(Op.ConcatTransformationMatrix, PT, 0, 0, -PT, 0, PAGE_H * PT);
		const art: PDFOperator[] = [mm()];
		const pieces: Placement[] = [];
		const sheets: NonNullable<Strip['sheets']> = [];

		striscia.fogli.forEach((f, i) => {
			const sx = posFogli[i].x, sy = posFogli[i].y;
			sheets.push({ x: sx, y: sy, w: SHEET_W, h: SHEET_H, rot: false });
			const pos = slots(sx, sy);
			let k = 0;
			for (const { logo, n } of f.fill) {
				for (let j = 0; j < n; j++, k++) {
					const { x, y } = pos[k];
					art.push(op(Op.PushGraphicsState),
						// il form e' in mm y-in-su: ribalto dentro il riquadro dell'etichetta
						op(Op.ConcatTransformationMatrix, 1, 0, 0, -1, x, y + LABEL),
						op(Op.DrawObject, PDFName.of('Lg_' + logo)), op(Op.PopGraphicsState));
					pieces.push({ x, y, rot: false });
				}
			}
		});
		const artForm = ctx.register(ctx.formXObject(art, {
			BBox: [0, 0, PAGE_W * PT, PAGE_H * PT],
			Resources: { XObject: Object.fromEntries(Object.entries(forms).map(([k, v]) => ['Lg_' + k, v])) }
		}));

		// gruppo CROCINI + codici a barre
		const id = newJobId(taken); taken.add(id);
		const bc = barcodeRects(PAGE_W, PAGE_H, id);
		const mOps: PDFOperator[] = [mm(), op(Op.NonStrokingColorCmyk, ...MARK_BLACK)];
		for (const rc of [...markRects(PAGE_W, PAGE_H), ...bc.rects]) mOps.push(op(Op.AppendRectangle, rc.x, rc.y, rc.w, rc.h));
		mOps.push(op(Op.FillNonZero));
		const marksForm = ctx.register(ctx.formXObject(mOps, { BBox: [0, 0, PAGE_W * PT, PAGE_H * PT], Resources: {} }));

		const nArt = node.newXObject('Grafica', artForm);
		const nMk = node.newXObject('Crocini', marksForm);
		page.pushOperators(op(Op.PushGraphicsState), op(Op.DrawObject, nArt), op(Op.PopGraphicsState));
		page.pushOperators(op(Op.PushGraphicsState), op(Op.DrawObject, nMk), op(Op.PopGraphicsState));

		const etichette = pieces.length;
		const base = `etichette-11,9_striscia-${striscia.nome}_${id}`;
		writeFileSync(join(outDir, base + '_STAMPA.pdf'), await pdf.save({ useObjectStreams: false }));

		// file di taglio per il Graphtec
		const job: XpfJob = {
			id, W: PAGE_W, H: PAGE_H, pathD: CUT_D, cutW: LABEL, cutH: LABEL,
			pieces, sheets, pieceCond: DEFAULT_COND.half, sheetCond: DEFAULT_COND.through, feed: FEED
		};
		writeFileSync(join(outDir, `SP_${id}.xpf`), buildXpf(job));

		const det = striscia.fogli.map((f) => f.fill.map((p) => `${p.n} ${p.logo}`).join(' + ')).join('  |  ');
		riepilogo.push(`striscia ${striscia.nome}  ${id}  ${PAGE_W}x${PAGE_H} mm  ${sheets.length} fogli (${ACROSS} per riga)  ${etichette} etichette\n    ${det}`);
		console.log(riepilogo.at(-1));
	}
	writeFileSync(join(outDir, 'riepilogo.txt'), riepilogo.join('\n') + '\n');
}

/** "M x y C ... Z" -> operatori pdf-lib (il tracciato VW e' gia' in mm, y in giu') */
function parseD(d: string): PDFOperator[] {
	const tok = d.match(/[a-zA-Z]|[-+]?(?:\d*\.\d+|\d+\.?)/g) ?? [];
	const out: PDFOperator[] = [];
	let i = 0;
	while (i < tok.length) {
		const c = tok[i++];
		if (c === 'M') out.push(op(Op.MoveTo, +tok[i++], +tok[i++]));
		else if (c === 'L') out.push(op(Op.LineTo, +tok[i++], +tok[i++]));
		else if (c === 'C') out.push(op(Op.AppendBezierCurve, +tok[i++], +tok[i++], +tok[i++], +tok[i++], +tok[i++], +tok[i++]));
		else if (c === 'Z') out.push(op(Op.ClosePath));
	}
	return out;
}

build().catch((e) => { console.error(e); process.exit(1); });
