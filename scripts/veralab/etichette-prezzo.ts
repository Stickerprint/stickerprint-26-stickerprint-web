/**
 * Kit etichette prezzo Veralab — foglietti trasparenti 22×7 mm, Raleway Medium, nero.
 *
 * Ogni prezzo del listino diventa un FOGLIETTO (bordo a taglio passante) con dentro le sue
 * etichette (mezzo taglio) a 5 colonne; i foglietti stanno di traverso sulla striscia, in
 * "mensole" alte quanto il foglietto, cosi' le larghezze diverse si incastrano. Ogni kit e' un
 * gruppo di strisce suo (mai mischiato con il kit dopo), per non dover smistare al confezionamento.
 *
 * Crocini, codici a barre e file di taglio sono quelli dello Studio (`src/lib/studio/graphtec.ts`,
 * verificati sui Graphtec FC9000 con Data Link Server): gli .xpf vanno nella cartella `cut_jobs`.
 *
 *   npx vite-node scripts/veralab/etichette-prezzo.ts -- scripts/veralab/kit-prezzi-2026-07.csv <cartella_uscita> [kit=15] [W=650]
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PDFDocument, cmyk } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { buildPdf, type Artwork, type PdfJob } from '../../src/lib/studio/pdf';
import { buildXpf, newJobId, MARKED_MARGIN, DEFAULT_COND, type XpfJob } from '../../src/lib/studio/graphtec';
import type { Placement, Strip } from '../../src/lib/studio/layout';

const PT = 72 / 25.4;
const HERE = dirname(fileURLToPath(import.meta.url));

/* ------------------------------------------------------------------ parametri */

const args = process.argv.slice(2).filter((a) => a !== '--');
if (args.length < 2) {
	console.error('uso: vite-node scripts/veralab/etichette-prezzo.ts -- <listino.csv> <cartella_uscita> [kit=15] [W=650]');
	process.exit(1);
}
const [csvPath, outDir] = args;
const KITS = Number(args[2] ?? 15);
/** larghezza utile di stampa (la pagina con i crocini sui bordi) */
const W = Number(args[3] ?? 650);

/** etichetta (taglio) */
const LABEL = { w: 22, h: 7, r: 1 };
/** foglietto: colonne, spazio fra le etichette, bordo attorno */
const SHEET = { cols: 5, gap: 2, margin: 3 };
/** spazio fra un foglietto e l'altro sulla striscia (regola dello Studio: almeno 10 mm) */
const SHEET_GAP = 10;
/** mensole per striscia: 3 × 124 mm + spazi + crocini = 432 mm, sotto i 450 dello Studio */
const SHELVES_PER_STRIP = 3;
/** testo: corpo massimo e margine laterale dentro l'etichetta */
const TEXT = { maxPt: 13, side: 1.5 };

const MX = MARKED_MARGIN.x, MY = MARKED_MARGIN.y;
const CONTENT_W = W - 2 * MX;

/* ------------------------------------------------------------------ listino */

interface Item { text: string; qty: number; key: string }

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
		return { text: fmtPrezzo(p), qty: Number(q), key: p.trim() };
	});
const perKit = items.reduce((s, i) => s + i.qty, 0);

/* ------------------------------------------------------------------ foglietto (non girato) */

interface Sheet { item: number; w: number; h: number; pieces: Placement[] }

function foglietto(i: number): Sheet {
	const q = items[i].qty;
	const rows = Math.ceil(q / SHEET.cols);
	const w = SHEET.cols * LABEL.w + (SHEET.cols - 1) * SHEET.gap + 2 * SHEET.margin;
	const h = rows * LABEL.h + (rows - 1) * SHEET.gap + 2 * SHEET.margin;
	const pieces: Placement[] = [];
	for (let k = 0; k < q; k++) {
		const c = k % SHEET.cols, r = Math.floor(k / SHEET.cols);
		pieces.push({ x: SHEET.margin + c * (LABEL.w + SHEET.gap), y: SHEET.margin + r * (LABEL.h + SHEET.gap), rot: false, a: i });
	}
	return { item: i, w: Math.round(w * 10) / 10, h: Math.round(h * 10) / 10, pieces };
}

const sheets = items.map((_, i) => foglietto(i));
const SHELF_H = sheets[0].w; // tutti i foglietti hanno la stessa larghezza (5 colonne): girati, la stessa altezza

/* ------------------------------------------------------------------ mensole: foglietti girati di 90 gradi, larghezze diverse incastrate */

/** best-fit decreasing: i foglietti piu' larghi prima, ognuno nella mensola dove avanza meno spazio */
function mensole(): Sheet[][] {
	const ordine = [...sheets].sort((a, b) => b.h - a.h || a.item - b.item);
	const rows: { used: number; list: Sheet[] }[] = [];
	for (const s of ordine) {
		let best = -1, bestLeft = Infinity;
		for (let r = 0; r < rows.length; r++) {
			const need = rows[r].list.length ? SHEET_GAP + s.h : s.h;
			const left = CONTENT_W - rows[r].used - need;
			if (left >= -1e-6 && left < bestLeft) { best = r; bestLeft = left; }
		}
		if (best < 0) { rows.push({ used: s.h, list: [s] }); } else { rows[best].used += SHEET_GAP + s.h; rows[best].list.push(s); }
	}
	// dentro la mensola, dal prezzo piu' basso al piu' alto: si trovano a colpo d'occhio
	return rows.map((r) => r.list.sort((a, b) => a.item - b.item));
}

const shelves = mensole();
const stripsPerKit = Math.ceil(shelves.length / SHELVES_PER_STRIP);

/** le strisce di UN kit: ogni mensola centrata nella larghezza, foglietti girati di 90 gradi in senso orario */
function strisceKit(): Strip[] {
	const out: Strip[] = [];
	for (let s0 = 0; s0 < shelves.length; s0 += SHELVES_PER_STRIP) {
		const group = shelves.slice(s0, s0 + SHELVES_PER_STRIP);
		const h = Math.round((2 * MY + group.length * SHELF_H + (group.length - 1) * SHEET_GAP) * 10) / 10;
		const strip: Strip = { w: W, h, pieces: [], sheets: [] };
		group.forEach((row, r) => {
			const totW = row.reduce((s, sh) => s + sh.h, 0) + (row.length - 1) * SHEET_GAP;
			let x = MX + (CONTENT_W - totW) / 2;
			const y = MY + r * (SHELF_H + SHEET_GAP);
			for (const sh of row) {
				// foglietto girato di 90 gradi in senso orario: ingombro h × w; (px, py) -> (x + h - py - ph, y + px)
				strip.sheets!.push({ x, y, w: sh.h, h: sh.w, rot: true });
				for (const p of sh.pieces) strip.pieces.push({ x: x + (sh.h - p.y - LABEL.h), y: y + p.x, rot: true, a: p.a });
				x += sh.h + SHEET_GAP;
			}
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
	const capRatio = ((pf as unknown as { embedder: { font: { capHeight: number; unitsPerEm: number } } }).embedder.font.capHeight ?? 700) / ((pf as unknown as { embedder: { font: { unitsPerEm: number } } }).embedder.font.unitsPerEm ?? 1000);
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
	const kitStrips = strisceKit();
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

	// PDF da stampare: grafica + crocini + codici (il taglio arriva dal Data Link Server)
	const job: PdfJob = { title: 'Veralab — kit etichette prezzo', arts, pages, pieceCut: 'CutContour', sheetCut: 'Passante', graphtecIds: ids };
	const printed = await PDFDocument.load(await buildPdf(job));
	printed.registerFontkit(fontkit);
	const helv = await printed.embedFont(readFileSync(join(HERE, 'Raleway-Medium.ttf')), { subset: true });
	printed.getPages().forEach((pg, i) => {
		// scritta di servizio in alto al centro, lontana da crocini e codici (che stanno agli angoli)
		const txt = `${names[i].replace(/-/g, ' · ').replace('di', ' di ')}  ·  ${ids[i]}`;
		const tw = helv.widthOfTextAtSize(txt, 8);
		pg.drawText(txt, { x: (W * PT - tw) / 2, y: pg.getHeight() - 19 * PT, size: 8, font: helv, color: cmyk(0, 0, 0, 1) });
	});
	const pdfPath = join(outDir, 'VERALAB_etichette-prezzo_STAMPA.pdf');
	writeFileSync(pdfPath, await printed.save({ useObjectStreams: false }));

	// PDF di controllo: stessa impaginazione con i tracciati di taglio in tinta piatta, senza crocini
	const ctrl = await buildPdf({ ...job, title: 'Veralab — controllo (tagli visibili)', graphtecIds: undefined, pages: kitStrips });
	writeFileSync(join(outDir, 'VERALAB_etichette-prezzo_CONTROLLO-1-kit.pdf'), ctrl);

	// file di taglio per Data Link Server, uno per striscia
	const xpfDir = join(outDir, 'cut_jobs');
	mkdirSync(xpfDir, { recursive: true });
	pages.forEach((s, i) => {
		const j: XpfJob = { id: ids[i], W: s.w, H: s.h, pathD: arts[0].pathD, cutW: LABEL.w, cutH: LABEL.h, pieces: s.pieces, sheets: s.sheets, pieceCond: DEFAULT_COND.half, sheetCond: DEFAULT_COND.through };
		writeFileSync(join(xpfDir, `${names[i]}_${ids[i]}.xpf`), buildXpf(j));
	});

	// riepilogo
	const totH = kitStrips.reduce((s, p) => s + p.h, 0);
	const righe = [
		`Kit: ${KITS} × ${perKit} etichette (${items.length} foglietti) = ${KITS * perKit} etichette`,
		`Etichetta ${LABEL.w}×${LABEL.h} mm, foglietti a ${SHEET.cols} colonne larghi ${SHELF_H} mm, girati sulla striscia`,
		`Pagina ${W} mm; strisce per kit: ${kitStrips.length} (${kitStrips.map((p) => `${p.h} mm`).join(', ')}), ${totH} mm di striscia per kit, ${(totH * KITS / 1000).toFixed(2)} m in tutto`,
		`Mensole: ${shelves.map((r) => `${r.length} foglietti / ${Math.round(r.reduce((s, x) => s + x.h, 0) + (r.length - 1) * SHEET_GAP)} mm`).join(' | ')}`,
		'',
		'Strisce e codici:',
		...names.map((n, i) => `  ${n}  ${ids[i]}  ${pages[i].w}×${pages[i].h} mm  ${pages[i].sheets!.length} foglietti, ${pages[i].pieces.length} etichette`)
	];
	writeFileSync(join(outDir, 'RIEPILOGO.txt'), righe.join('\n') + '\n');
	console.log(righe.slice(0, 4).join('\n'));
	console.log(`scritti: ${pdfPath} (${pages.length} pagine), ${pages.length} file .xpf in ${xpfDir}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
