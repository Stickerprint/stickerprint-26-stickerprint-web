/**
 * Kit etichette prezzo Veralab — fogli A4 trasparenti, etichette 22×7 mm, Raleway Medium, nero.
 *
 * Ogni kit sono 6 FOGLI A4 (210×297 mm) tutti uguali, con tutte le etichette del listino nell'ordine
 * del file Excel: ogni prezzo comincia su una riga nuova, cosi' in negozio si trova a colpo d'occhio.
 * Regole dei fogli di etichette dello Studio (`SHEET_RULES.etichette`): bordo 10 mm a taglio passante,
 * stacco 2 mm, etichette a mezzo taglio -> 8 colonne × 31 righe, che riempiono l'A4 esatto.
 * Sulla striscia stanno 3 fogli affiancati con 10 mm di stacco (3 × 210 + 20 = 650 mm di larghezza
 * utile): 2 strisce per kit, ognuna col suo codice a barre e il suo file di taglio.
 *
 * Crocini, codici a barre, PDF e file di taglio sono quelli dello Studio (`graphtec.ts`, `pdf.ts`):
 * gli .xpf vanno nella cartella `cut_jobs` di Data Link Server.
 *
 *   npx vite-node scripts/veralab/etichette-prezzo.ts -- scripts/veralab/kit-prezzi-2026-07.csv <cartella_uscita> [kit=15] [utile=650]
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PDFDocument, cmyk } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { buildPdf, type Artwork, type PdfJob } from '../../src/lib/studio/pdf';
import { buildXpf, newJobId, MARKED_MARGIN, DEFAULT_COND, type XpfJob } from '../../src/lib/studio/graphtec';
import { SHEET_RULES, A4, type Placement, type Strip } from '../../src/lib/studio/layout';

const PT = 72 / 25.4;
const HERE = dirname(fileURLToPath(import.meta.url));

/* ------------------------------------------------------------------ parametri */

const args = process.argv.slice(2).filter((a) => a !== '--');
if (args.length < 2) {
	console.error('uso: vite-node scripts/veralab/etichette-prezzo.ts -- <listino.csv> <cartella_uscita> [kit=15] [utile=650]');
	process.exit(1);
}
const [csvPath, outDir] = args;
const KITS = Number(args[2] ?? 15);
/** larghezza utile di stampa (dentro i crocini): 3 fogli A4 con 10 mm di stacco */
const UTILE = Number(args[3] ?? 650);
/** la pagina: larghezza utile piu' le fasce dei crocini ai lati */
const W = Math.round((UTILE + 2 * MARKED_MARGIN.x) * 10) / 10;

/** etichetta (taglio), angoli arrotondati */
const LABEL = { w: 22, h: 7, r: 1 };
/** regole dello Studio per i fogli di etichette: bordo 10, stacco 2 */
const RULES = SHEET_RULES.etichette;
/** il foglio: A4 esatto */
const SHEET = { w: A4[0], h: A4[1] };
const COLS = Math.floor((SHEET.w - 2 * RULES.margin + RULES.gap + 1e-6) / (LABEL.w + RULES.gap));
const ROWS = Math.floor((SHEET.h - 2 * RULES.margin + RULES.gap + 1e-6) / (LABEL.h + RULES.gap));
/** fogli per striscia e stacco fra i fogli */
const SHEETS_PER_STRIP = 3;
const SHEET_GAP = 10;
/** testo: corpo massimo e margine laterale dentro l'etichetta */
const TEXT = { maxPt: 13, side: 1.5 };

if (SHEETS_PER_STRIP * SHEET.w + (SHEETS_PER_STRIP - 1) * SHEET_GAP > UTILE + 1e-6)
	throw new Error(`${SHEETS_PER_STRIP} fogli A4 con ${SHEET_GAP} mm di stacco non stanno in ${UTILE} mm.`);

/* ------------------------------------------------------------------ listino */

interface Item { text: string; qty: number }

function fmtPrezzo(raw: string): string {
	const s = raw.trim();
	if (!/^\d+(?:[.,]\d+)?$/.test(s)) return s.toUpperCase();
	const n = Number(s.replace(',', '.'));
	return `€ ${n.toFixed(2).replace('.', ',')}`;
}

const items: Item[] = readFileSync(csvPath, 'utf8')
	.split(/\r?\n/)
	.slice(1)
	.filter((l) => l.trim())
	.map((l) => {
		const [p, q] = l.split(/[;,\t]/);
		return { text: fmtPrezzo(p), qty: Number(q) };
	});
const perKit = items.reduce((s, i) => s + i.qty, 0);

/* ------------------------------------------------------------------ fogli di un kit */

/** un foglio: le etichette dentro, rispetto al suo angolo */
interface Sheet { pieces: Placement[]; righe: number; prezzi: number[] }

/**
 * I prezzi nell'ordine del listino, ognuno da una riga nuova; un prezzo che non sta nelle righe
 * che restano passa al foglio dopo (si spezza solo se da solo e' piu' lungo di un foglio).
 */
function fogli(): Sheet[] {
	const out: Sheet[] = [];
	let cur: Sheet = { pieces: [], righe: 0, prezzi: [] };
	const chiudi = () => { if (cur.pieces.length) out.push(cur); cur = { pieces: [], righe: 0, prezzi: [] }; };
	items.forEach((it, i) => {
		let restano = it.qty;
		const righeServono = Math.ceil(it.qty / COLS);
		if (cur.righe + righeServono > ROWS && righeServono <= ROWS) chiudi();
		while (restano > 0) {
			if (cur.righe >= ROWS) chiudi();
			const n = Math.min(restano, COLS);
			for (let c = 0; c < n; c++)
				cur.pieces.push({ x: RULES.margin + c * (LABEL.w + RULES.gap), y: RULES.margin + cur.righe * (LABEL.h + RULES.gap), rot: false, a: i });
			if (!cur.prezzi.includes(i)) cur.prezzi.push(i);
			cur.righe++;
			restano -= n;
		}
	});
	chiudi();
	return out;
}

/** le strisce di un kit: 3 fogli affiancati, centrati nella pagina */
function strisceKit(sheets: Sheet[]): Strip[] {
	const out: Strip[] = [];
	const h = Math.round((SHEET.h + 2 * MARKED_MARGIN.y) * 10) / 10;
	for (let s0 = 0; s0 < sheets.length; s0 += SHEETS_PER_STRIP) {
		const group = sheets.slice(s0, s0 + SHEETS_PER_STRIP);
		const totW = group.length * SHEET.w + (group.length - 1) * SHEET_GAP;
		const x0 = MARKED_MARGIN.x + (UTILE - totW) / 2, y0 = MARKED_MARGIN.y;
		const strip: Strip = { w: W, h, pieces: [], sheets: [] };
		group.forEach((sh, k) => {
			const sx = x0 + k * (SHEET.w + SHEET_GAP);
			strip.sheets!.push({ x: sx, y: y0, w: SHEET.w, h: SHEET.h, rot: false });
			for (const p of sh.pieces) strip.pieces.push({ x: sx + p.x, y: y0 + p.y, rot: false, a: p.a });
		});
		out.push(strip);
	}
	return out;
}

/* ------------------------------------------------------------------ grafica delle etichette (PDF vettoriale, un soggetto per prezzo) */

async function grafiche(): Promise<Artwork[]> {
	const fontBytes = readFileSync(join(HERE, 'Raleway-Medium.ttf'));
	// corpo unico per tutte: quello che fa stare il testo piu' largo
	const probe = await PDFDocument.create();
	probe.registerFontkit(fontkit);
	const pf = await probe.embedFont(fontBytes);
	const maxW = (LABEL.w - 2 * TEXT.side) * PT;
	let size = TEXT.maxPt;
	for (const it of items) {
		const w = pf.widthOfTextAtSize(it.text, size);
		if (w > maxW) size = Math.floor((size * maxW) / w * 10) / 10;
	}
	const fk = (pf as unknown as { embedder: { font: { capHeight?: number; unitsPerEm?: number } } }).embedder.font;
	const capRatio = (fk.capHeight ?? 700) / (fk.unitsPerEm ?? 1000);
	console.log(`corpo del testo: ${size} pt (altezza maiuscole ${(size * capRatio / PT).toFixed(2)} mm)`);

	const pathD = `M${LABEL.r} 0 H${LABEL.w - LABEL.r} A${LABEL.r} ${LABEL.r} 0 0 1 ${LABEL.w} ${LABEL.r} V${LABEL.h - LABEL.r} A${LABEL.r} ${LABEL.r} 0 0 1 ${LABEL.w - LABEL.r} ${LABEL.h} H${LABEL.r} A${LABEL.r} ${LABEL.r} 0 0 1 0 ${LABEL.h - LABEL.r} V${LABEL.r} A${LABEL.r} ${LABEL.r} 0 0 1 ${LABEL.r} 0 Z`;
	const arts: Artwork[] = [];
	for (const it of items) {
		const doc = await PDFDocument.create();
		doc.registerFontkit(fontkit);
		const font = await doc.embedFont(fontBytes, { subset: true });
		const page = doc.addPage([LABEL.w * PT, LABEL.h * PT]);
		const tw = font.widthOfTextAtSize(it.text, size);
		const cap = size * capRatio;
		page.drawText(it.text, { x: (LABEL.w * PT - tw) / 2, y: (LABEL.h * PT - cap) / 2, size, font, color: cmyk(0, 0, 0, 1) });
		arts.push({ pdfPage: { bytes: await doc.save(), bboxPt: [0, 0, LABEL.w * PT, LABEL.h * PT] }, cutW: LABEL.w, cutH: LABEL.h, bleed: 0, pathD });
	}
	return arts;
}

/* ------------------------------------------------------------------ uscita */

async function main() {
	mkdirSync(outDir, { recursive: true });
	const arts = await grafiche();
	const sheets = fogli();
	const kitStrips = strisceKit(sheets);
	const pages: Strip[] = [];
	const ids: string[] = [];
	const names: string[] = [];
	const taken = new Set<string>();
	for (let k = 1; k <= KITS; k++)
		kitStrips.forEach((s, i) => {
			const id = newJobId(taken);
			taken.add(id);
			pages.push(s);
			ids.push(id);
			names.push(`VERALAB-K${String(k).padStart(2, '0')}-${i + 1}di${kitStrips.length}`);
		});

	// PDF da stampare: grafica + crocini + codici (il taglio arriva dal Data Link Server), come lo Studio
	const job: PdfJob = { title: 'Veralab — kit etichette prezzo', arts, pages, pieceCut: 'CutContour', sheetCut: 'Passante', graphtecIds: ids };
	const printed = await PDFDocument.load(await buildPdf(job));
	printed.registerFontkit(fontkit);
	const font = await printed.embedFont(readFileSync(join(HERE, 'Raleway-Medium.ttf')), { subset: true });
	printed.getPages().forEach((pg, i) => {
		// scritta di servizio (kit e striscia) in alto al centro, lontana da crocini e codici che stanno agli angoli
		const txt = `${names[i].replace(/-/g, ' · ').replace('di', ' di ')}  ·  ${ids[i]}`;
		const tw = font.widthOfTextAtSize(txt, 8);
		pg.drawText(txt, { x: (W * PT - tw) / 2, y: pg.getHeight() - 19 * PT, size: 8, font, color: cmyk(0, 0, 0, 1) });
	});
	const pdfPath = join(outDir, 'VERALAB_etichette-prezzo_STAMPA.pdf');
	writeFileSync(pdfPath, await printed.save({ useObjectStreams: false }));

	// PDF di controllo: stessa impaginazione di un kit con i tracciati di taglio in tinta piatta, senza crocini
	const ctrl = await buildPdf({ ...job, title: 'Veralab — controllo (tagli visibili)', graphtecIds: undefined, pages: kitStrips });
	writeFileSync(join(outDir, 'VERALAB_etichette-prezzo_CONTROLLO-1-kit.pdf'), ctrl);

	// file di taglio per Data Link Server, uno per striscia: etichette a mezzo taglio, bordo dei fogli passante
	const xpfDir = join(outDir, 'cut_jobs');
	mkdirSync(xpfDir, { recursive: true });
	pages.forEach((s, i) => {
		const j: XpfJob = { id: ids[i], W: s.w, H: s.h, pathD: arts[0].pathD, cutW: LABEL.w, cutH: LABEL.h, pieces: s.pieces, sheets: s.sheets, pieceCond: DEFAULT_COND.half, sheetCond: DEFAULT_COND.through };
		writeFileSync(join(xpfDir, `${names[i]}_${ids[i]}.xpf`), buildXpf(j));
	});

	// riepilogo
	const righe = [
		`Kit: ${KITS} × ${perKit} etichette (${items.length} prezzi) = ${KITS * perKit} etichette`,
		`Etichetta ${LABEL.w}×${LABEL.h} mm; foglio A4 ${SHEET.w}×${SHEET.h} mm, bordo ${RULES.margin} mm, stacco ${RULES.gap} mm, ${COLS} colonne × ${ROWS} righe (${COLS * ROWS} posti)`,
		`Fogli per kit: ${sheets.length}; pagina ${W} mm (utile ${UTILE}); strisce per kit: ${kitStrips.length} da ${kitStrips[0].h} mm con ${SHEETS_PER_STRIP} fogli`,
		'',
		'Fogli del kit:',
		...sheets.map((s, i) => `  foglio ${i + 1} (striscia ${Math.floor(i / SHEETS_PER_STRIP) + 1}): ${s.pieces.length} etichette, ${s.righe}/${ROWS} righe, da ${items[s.prezzi[0]].text} a ${items[s.prezzi[s.prezzi.length - 1]].text}`),
		'',
		'Strisce e codici:',
		...names.map((n, i) => `  ${n}  ${ids[i]}  ${pages[i].w}×${pages[i].h} mm  ${pages[i].sheets!.length} fogli, ${pages[i].pieces.length} etichette`)
	];
	writeFileSync(join(outDir, 'RIEPILOGO.txt'), righe.join('\n') + '\n');
	console.log(righe.slice(0, 3 + 2 + sheets.length).join('\n'));
	console.log(`scritti: ${pdfPath} (${pages.length} pagine), ${pages.length} file .xpf in ${xpfDir}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
