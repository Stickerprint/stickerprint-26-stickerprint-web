/**
 * Kit etichette prezzo Veralab — foglietti trasparenti 22×7 mm, Raleway Medium, nero.
 *
 * Stessa logica del MONTAGGIO dello Studio (`src/lib/studio/montaggio.ts`): ogni prezzo e' un
 * soggetto in modo "fogli" con le regole delle etichette (bordo 10 mm a taglio passante, stacco 2 mm,
 * etichette a mezzo taglio), i blocchi stanno AFFIANCATI sulla striscia con 10 mm di stacco, la
 * striscia e' alta quanto il blocco piu' alto piu' le fasce dei crocini, e si stampa l'8% in piu'
 * per gli scarti. Le griglie dei blocchi sono quelle di `candidati()`; qui in piu' si decide come
 * dividere gli 81 soggetti sulle strisce: si prova ogni altezza di striscia, per ognuna si prende
 * la griglia piu' stretta che ci sta, e vince l'altezza che consuma meno materiale (strisce +
 * avviamenti). Ogni kit ha le sue strisce, mai mischiate con il kit dopo.
 *
 * Crocini, codici a barre, PDF e file di taglio sono quelli dello Studio (`graphtec.ts`, `pdf.ts`):
 * gli .xpf vanno nella cartella `cut_jobs` di Data Link Server.
 *
 *   npx vite-node scripts/veralab/etichette-prezzo.ts -- scripts/veralab/kit-prezzi-2026-07.csv <cartella_uscita> [kit=15] [W=650]
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PDFDocument, cmyk } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { buildPdf, type Artwork, type PdfJob } from '../../src/lib/studio/pdf';
import { buildXpf, newJobId, MARKED_MARGIN, DEFAULT_COND, type XpfJob } from '../../src/lib/studio/graphtec';
import { SHEET_RULES, STRIP_MATERIALS, STRIP_OVERHEAD, type Placement, type Strip } from '../../src/lib/studio/layout';
import { candidati, bloccoA, type Blocco, type Cand, type MontaOptions, type Soggetto } from '../../src/lib/studio/montaggio';

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

/** etichetta (taglio), angoli arrotondati */
const LABEL = { w: 22, h: 7, r: 1 };
/** regole dello Studio: fogli di etichette, 8% di scarto, stacco fra i blocchi, altezza massima */
const RULES = SHEET_RULES.etichette;
const SCARTO = 0.08;
const GAP_BLOCCHI = 10;
const MAX_H = STRIP_MATERIALS[0].maxHLoose;
/** testo: corpo massimo e margine laterale dentro l'etichetta */
const TEXT = { maxPt: 13, side: 1.5 };

const OPT: MontaOptions = { pageW: W, maxH: MAX_H, margin: MARKED_MARGIN.x, marginY: MARKED_MARGIN.y, gapBlocchi: GAP_BLOCCHI };
const MAX_W = W - 2 * OPT.margin;
const EPS = 1e-6;

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

/** i soggetti del montaggio: come nella pagina Montaggio, con l'8% in piu' per gli scarti */
const soggetti: Soggetto[] = items.map((it) => ({
	nome: it.text, cutW: LABEL.w, cutH: LABEL.h, qty: Math.ceil(it.qty * (1 + SCARTO)), modo: 'fogli', rules: RULES
}));
const daFare = soggetti.reduce((s, x) => s + x.qty, 0);

/* ------------------------------------------------------------------ strisce di un kit */

interface StripKit { h: number; blocchi: Blocco[] }

/** larghezza di striscia che un candidato consuma, stacchi compresi */
const ingombro = (c: Cand) => c.w * c.quanti + GAP_BLOCCHI * (c.quanti - 1);

/**
 * Prova ogni altezza di striscia possibile: per ognuna prende, soggetto per soggetto, la griglia piu'
 * stretta che non la supera, mette i blocchi in fila (prima i piu' alti, cosi' le strisce vengono
 * omogenee) e li divide sulle strisce. Vince l'altezza che consuma meno materiale.
 */
function strisceKit(): { strips: StripKit[]; altezzaScelta: number } {
	const liste = soggetti.map((s) => candidati(s, OPT));
	for (const [i, l] of liste.entries()) if (!l.length) throw new Error(`"${soggetti[i].nome}" non ci sta nella striscia.`);
	const altezze = [...new Set(liste.flat().map((c) => c.h))].sort((a, b) => a - b);

	let best: { strips: StripKit[]; materiale: number; H: number } | null = null;
	for (const H of altezze) {
		const scelte: (Cand | null)[] = liste.map((l) => {
			const ok = l.filter((c) => c.h <= H + EPS);
			if (!ok.length) return null;
			ok.sort((a, b) => ingombro(a) - ingombro(b) || a.h - b.h);
			return ok[0];
		});
		if (scelte.some((c) => !c)) continue;
		// i blocchi da piazzare: quanti ne servono per ogni soggetto, con i pezzi che restano
		const blocchi: { s: number; c: Cand; quanti: number }[] = [];
		scelte.forEach((c, i) => {
			let restano = soggetti[i].qty;
			for (let k = 0; k < c!.quanti; k++) { const q = Math.min(restano, c!.grid.n); blocchi.push({ s: i, c: c!, quanti: q }); restano -= q; }
		});
		// prima i blocchi piu' alti, poi i piu' larghi: ogni blocco va nella prima striscia dove entra
		blocchi.sort((a, b) => b.c.h - a.c.h || b.c.w - a.c.w || a.s - b.s);
		const righe: { usata: number; list: typeof blocchi }[] = [];
		for (const b of blocchi) {
			const r = righe.find((r) => r.usata + GAP_BLOCCHI + b.c.w <= MAX_W + EPS);
			if (r) { r.usata += GAP_BLOCCHI + b.c.w; r.list.push(b); } else righe.push({ usata: b.c.w, list: [b] });
		}
		const strips: StripKit[] = righe.map((r) => {
			// nella striscia dal prezzo piu' basso al piu' alto, blocchi centrati come nel montaggio
			r.list.sort((a, b) => a.s - b.s);
			const usata = r.list.reduce((s, b) => s + b.c.w, 0) + GAP_BLOCCHI * (r.list.length - 1);
			const h = Math.round((Math.max(...r.list.map((b) => b.c.h)) + 2 * OPT.marginY) * 10) / 10;
			let x = OPT.margin + (MAX_W - usata) / 2;
			const out: Blocco[] = [];
			for (const b of r.list) { out.push(bloccoA(b.s, b.c, x, OPT.marginY, b.quanti)); x += b.c.w + GAP_BLOCCHI; }
			return { h, blocchi: out };
		});
		const materiale = strips.reduce((s, x) => s + x.h + STRIP_OVERHEAD, 0);
		if (!best || materiale < best.materiale - EPS) best = { strips, materiale, H };
	}
	if (!best) throw new Error('Nessuna altezza di striscia va bene.');
	return { strips: best.strips, altezzaScelta: best.H };
}

const toStrip = (s: StripKit): Strip => ({
	w: W, h: s.h,
	pieces: s.blocchi.flatMap((b) => b.pieces.map((p): Placement => ({ ...p, a: b.soggetto }))),
	sheets: s.blocchi.filter((b) => b.foglio).map((b) => b.foglio!)
});

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
	const kit = strisceKit();
	const kitStrips = kit.strips.map(toStrip);
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

	// PDF da stampare: grafica + crocini + codici (il taglio arriva dal Data Link Server), come il montaggio
	const job: PdfJob = { title: 'Veralab — kit etichette prezzo', arts, pages, pieceCut: 'CutContour', sheetCut: 'Passante', graphtecIds: ids };
	const printed = await PDFDocument.load(await buildPdf(job));
	printed.registerFontkit(fontkit);
	const helv = await printed.embedFont(readFileSync(join(HERE, 'Raleway-Medium.ttf')), { subset: true });
	printed.getPages().forEach((pg, i) => {
		// scritta di servizio (kit e striscia) in alto al centro, lontana da crocini e codici che stanno agli angoli
		const txt = `${names[i].replace(/-/g, ' · ').replace('di', ' di ')}  ·  ${ids[i]}`;
		const tw = helv.widthOfTextAtSize(txt, 8);
		pg.drawText(txt, { x: (W * PT - tw) / 2, y: pg.getHeight() - 19 * PT, size: 8, font: helv, color: cmyk(0, 0, 0, 1) });
	});
	const pdfPath = join(outDir, 'VERALAB_etichette-prezzo_STAMPA.pdf');
	writeFileSync(pdfPath, await printed.save({ useObjectStreams: false }));

	// PDF di controllo: stessa impaginazione con i tracciati di taglio in tinta piatta, senza crocini
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
	const totH = kitStrips.reduce((s, p) => s + p.h + STRIP_OVERHEAD, 0);
	const righe = [
		`Kit: ${KITS} × ${perKit} etichette (${items.length} prezzi); con l'8% di scarto ${daFare} per kit, ${KITS * daFare} in tutto`,
		`Etichetta ${LABEL.w}×${LABEL.h} mm; fogli con bordo ${RULES.margin} mm e stacco ${RULES.gap} mm; blocchi affiancati con ${GAP_BLOCCHI} mm`,
		`Pagina ${W} mm; strisce per kit: ${kitStrips.length} (${kitStrips.map((p) => `${p.h} mm`).join(', ')}); ${(totH / 1000).toFixed(2)} m per kit stacchi compresi, ${(totH * KITS / 1000).toFixed(1)} m in tutto`,
		'',
		'Strisce e codici:',
		...names.map((n, i) => `  ${n}  ${ids[i]}  ${pages[i].w}×${pages[i].h} mm  ${pages[i].sheets!.length} fogli, ${pages[i].pieces.length} etichette`),
		'',
		'Fogli del kit (prezzo: griglia):',
		...kit.strips.flatMap((s, i) => s.blocchi.map((b) => `  striscia ${i + 1}  ${items[b.soggetto].text.padEnd(8)} ${b.pieces.length} etichette, ${b.grid.cols}×${b.grid.rows}${b.grid.rot ? ' girate' : ''}, foglio ${b.w}×${b.h} mm`))
	];
	writeFileSync(join(outDir, 'RIEPILOGO.txt'), righe.join('\n') + '\n');
	console.log(righe.slice(0, 3).join('\n'));
	console.log(`scritti: ${pdfPath} (${pages.length} pagine), ${pages.length} file .xpf in ${xpfDir}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
