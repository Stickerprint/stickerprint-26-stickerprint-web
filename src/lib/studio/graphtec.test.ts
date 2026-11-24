import { describe, expect, it } from 'vitest';
import { MARK, MARK_MASK, MARKED_MARGIN, SHEET_FRAMES, barcodeRects, markRects, maskFor, maskRects, markedMargin, markedMarginWide, sheetFrames, whiteRects, WHITE_PAD, WHITE_MARGIN_Y, xpfCommands, type XpfJob } from './graphtec';

const W = 712, H = 300;

describe('crocini su riquadro nero (materiali riflettenti)', () => {
	it('si accende solo su glitterato, argento e oro', () => {
		expect(maskFor('oro')).toBe(MARK_MASK);
		expect(maskFor('argento')).toBe(MARK_MASK);
		expect(maskFor('glitterato')).toBe(MARK_MASK);
		expect(maskFor('bianco')).toBe(0);
		expect(maskFor('olografico')).toBe(0);
		expect(maskFor(['bianco', 'oro'])).toBe(MARK_MASK);
		expect(maskFor(null)).toBe(0);
	});

	it('senza riquadro niente cambia', () => {
		expect(markRects(W, H, 0)).toEqual(markRects(W, H));
		expect(barcodeRects(W, H, 'G12003EF4', 0)).toEqual(barcodeRects(W, H, 'G12003EF4'));
		expect(maskRects(W, H, 0)).toEqual([]);
		expect(markedMargin(0)).toBe(MARKED_MARGIN);
		expect(sheetFrames(0)).toBe(SHEET_FRAMES);
	});

	it('il riquadro e\' quello di Cutting Master 5: il crocino piu\' 6 mm di nero su ogni lato', () => {
		const q = maskRects(W, H, MARK_MASK);
		expect(q).toHaveLength(4);
		for (const { fuori, fori } of q) {
			/* misurato su Cutting Master 5: crocino 20,5, riquadro 32,5 */
			expect(fuori.w).toBeCloseTo(32.5, 6); expect(fuori.h).toBeCloseTo(32.5, 6);
			/* tutto dentro la pagina */
			expect(fuori.x).toBeGreaterThanOrEqual(-1e-9); expect(fuori.x + fuori.w).toBeLessThanOrEqual(W + 1e-9);
			/* i due bracci stanno dentro il riquadro con 6 mm di nero attorno e non si sovrappongono */
			const x0 = Math.min(...fori.map((r) => r.x)), x1 = Math.max(...fori.map((r) => r.x + r.w));
			const y0 = Math.min(...fori.map((r) => r.y)), y1 = Math.max(...fori.map((r) => r.y + r.h));
			expect(x0 - fuori.x).toBeCloseTo(MARK_MASK, 6); expect(fuori.x + fuori.w - x1).toBeCloseTo(MARK_MASK, 6);
			expect(y0 - fuori.y).toBeCloseTo(MARK_MASK, 6); expect(fuori.y + fuori.h - y1).toBeCloseTo(MARK_MASK, 6);
			const area = fori.reduce((a, r) => a + r.w * r.h, 0);
			expect(area).toBeCloseTo(MARK.arm * MARK.thick * 2 - MARK.thick * MARK.thick, 6);
		}
		/* fra la fascia del codice a barre e il riquadro restano 5,5 mm, come in Cutting Master */
		expect(Math.min(...q.map((r) => r.fuori.y)) - MARK.barH).toBeCloseTo(5.5, 6);
	});

	it('crocini e codici rientrano insieme di 6 mm; il codice resta sul bordo alto e basso', () => {
		const m = markRects(W, H, MARK_MASK), base = markRects(W - 2 * MARK_MASK, H - 2 * MARK_MASK);
		m.forEach((r, i) => { expect(r.x).toBeCloseTo(base[i].x + MARK_MASK, 6); expect(r.y).toBeCloseTo(base[i].y + MARK_MASK, 6); });
		const b = barcodeRects(W, H, 'G12003EF4', MARK_MASK).rects, b0 = barcodeRects(W - 2 * MARK_MASK, H, 'G12003EF4').rects;
		b.forEach((r, i) => { expect(r.x).toBeCloseTo(b0[i].x + MARK_MASK, 6); expect(r.y).toBe(b0[i].y); expect(r.w).toBe(b0[i].w); });
	});

	it('il contenuto resta ad almeno 3 mm dal nero', () => {
		const q = maskRects(W, H, MARK_MASK), a = markedMargin(MARK_MASK), b = markedMarginWide(MARK_MASK);
		const destra = Math.max(...q.filter((r) => r.fuori.x < W / 2).map((r) => r.fuori.x + r.fuori.w));
		const sotto = Math.max(...q.filter((r) => r.fuori.y < H / 2).map((r) => r.fuori.y + r.fuori.h));
		expect(a.x - destra).toBeGreaterThanOrEqual(3 - 1e-9);
		expect(b.y - sotto).toBeGreaterThanOrEqual(3 - 1e-9);
		/* e dentro la linea dei crocini */
		expect(a.y).toBeGreaterThan(MARK.edge + MARK_MASK + MARK.thick);
		expect(b.x).toBeGreaterThan(MARK_MASK + MARK.thick);
	});

	it('il file di taglio e\' quello di una pagina piu\' piccola di 12 mm con i pezzi spostati di 6', () => {
		const pathD = 'M0,0 L60,0 L60,30 L0,30 Z';
		const con: XpfJob = { id: 'G12003EF4', W, H, pathD, cutW: 60, cutH: 30, pieces: [{ x: 100, y: 80, rot: false }, { x: 300, y: 120, rot: true }], pieceCond: 1, mask: MARK_MASK };
		const senza: XpfJob = { ...con, W: W - 12, H: H - 12, pieces: con.pieces.map((p) => ({ ...p, x: p.x - 6, y: p.y - 6 })), mask: 0 };
		expect(xpfCommands(con)).toBe(xpfCommands(senza));
		expect(xpfCommands(con)).toContain(`TB24,${(H - 12 - 30) * 10},${(W - 12 - 1) * 10}`);
	});
});

describe('maschera di bianco sotto crocini e codici a barre', () => {
	const W = 712, H = 400, id = 'G12003EF4', P = WHITE_PAD;
	const dentro = (a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }) =>
		a.x >= b.x - 1e-9 && a.y >= b.y - 1e-9 && a.x + a.w <= b.x + b.w + 1e-9 && a.y + a.h <= b.y + b.h + 1e-9;

	it('senza riquadro non c\'e\' bianco', () => {
		expect(whiteRects(W, H, id, 0)).toEqual({ crocini: [], codici: [] });
	});

	it('crocini e codici scendono insieme di 15 mm: fra loro tutto resta com\'era', () => {
		expect(P).toBe(15);
		const m = markRects(W, H, MARK_MASK, P), m0 = markRects(W, H - 2 * P, MARK_MASK);
		m.forEach((r, i) => { expect(r.x).toBe(m0[i].x); expect(r.y).toBeCloseTo(m0[i].y + P, 6); expect(r.w).toBe(m0[i].w); expect(r.h).toBe(m0[i].h); });
		const b = barcodeRects(W, H, id, MARK_MASK, P).rects, b0 = barcodeRects(W, H - 2 * P, id, MARK_MASK).rects;
		b.forEach((r, i) => { expect(r.x).toBe(b0[i].x); expect(r.y).toBeCloseTo(b0[i].y + P, 6); expect(r.w).toBe(b0[i].w); expect(r.h).toBe(b0[i].h); });
	});

	it('i riquadri dei crocini sono quelli del riquadro nero, con il crocino nero tutto dentro', () => {
		const w = whiteRects(W, H, id, MARK_MASK), neri = markRects(W, H, MARK_MASK, P);
		expect(w.crocini).toEqual(maskRects(W, H, MARK_MASK, P).map((q) => q.fuori));
		expect(w.crocini).toHaveLength(4);
		w.crocini.forEach((q, i) => { for (const r of [neri[2 * i], neri[2 * i + 1]]) expect(dentro(r, q)).toBe(true); });
	});

	it('il bianco sporge di 1,5 cm dal codice a barre anche verso il bordo della pagina, senza uscirne', () => {
		const w = whiteRects(W, H, id, MARK_MASK), b = barcodeRects(W, H, id, MARK_MASK, P).rects;
		expect(w.codici).toHaveLength(2);
		const [sotto, sopra] = w.codici;
		const basso = b.filter((r) => r.y > H / 2), alto = b.filter((r) => r.y < H / 2);
		expect(basso.length).toBeGreaterThan(10); expect(alto.length).toBeGreaterThan(10);
		for (const r of basso) expect(dentro(r, sotto)).toBe(true);
		for (const r of alto) expect(dentro(r, sopra)).toBe(true);
		/* sopra e sotto il codice: 15 mm pieni da tutte e due le parti, e la fascia finisce sul bordo della pagina */
		for (const [q, barre] of [[sotto, basso], [sopra, alto]] as const) {
			expect(Math.min(...barre.map((r) => r.y)) - q.y).toBeCloseTo(P, 6);
			expect(q.y + q.h - Math.max(...barre.map((r) => r.y + r.h))).toBeCloseTo(P, 6);
			expect(q.h).toBeCloseTo(MARK.barH + 2 * P, 6);
		}
		expect(sopra.y).toBe(0); expect(sotto.y + sotto.h).toBeCloseTo(H, 6);
		/* di lato: 15 mm dalla parte del codice; dalla parte della barra nera (a 6 mm dal bordo) arriva al bordo */
		expect(Math.min(...basso.map((r) => r.x)) - sotto.x).toBeCloseTo(P, 6);
		expect(sotto.x + sotto.w).toBe(W);
		expect(sopra.x).toBe(0);
		expect(sopra.x + sopra.w - Math.max(...alto.map((r) => r.x + r.w))).toBeCloseTo(P, 6);
	});

	it('il contenuto resta fuori dal bianco: 5 mm sotto la fascia del codice, 3 mm accanto al riquadro', () => {
		const w = whiteRects(W, H, id, MARK_MASK), m = markedMargin(MARK_MASK, true);
		expect(m.y).toBe(WHITE_MARGIN_Y);
		for (const r of w.codici) expect(m.y - Math.min(r.y + r.h, H - r.y)).toBeCloseTo(5, 6);
		for (const q of w.crocini) expect(m.x - (q.x < W / 2 ? q.x + q.w : W - q.x)).toBeCloseTo(3, 6);
		/* le cornici dei fogli scendono anche loro: quella a tutta larghezza resta 3 mm sotto i riquadri */
		const f = sheetFrames(MARK_MASK, true), f0 = sheetFrames(MARK_MASK);
		expect(f[0].marginY).toBe(WHITE_MARGIN_Y);
		expect(f[1].marginY).toBeCloseTo(f0[1].marginY + P, 6);
		for (const q of w.crocini) expect(f[1].marginY - Math.min(q.y + q.h, H - q.y)).toBeCloseTo(3, 6);
		/* senza maschera di bianco i margini sono quelli di prima */
		expect(markedMargin(MARK_MASK).y).toBe(26);
		expect(f0[0].marginY).toBe(26);
	});

	it('il file di taglio non cambia: parte dai crocini, che sono scesi insieme ai pezzi', () => {
		const pathD = 'M0 0H60V30H0Z';
		const con: XpfJob = { id, W, H, pathD, cutW: 60, cutH: 30, pieces: [{ x: 100, y: 80, rot: false }, { x: 300, y: 120, rot: true }], pieceCond: 1, mask: MARK_MASK, padY: P };
		const senza: XpfJob = { ...con, H: H - 2 * P, pieces: con.pieces.map((p) => ({ ...p, y: p.y - P })), padY: 0 };
		expect(xpfCommands(con)).toBe(xpfCommands(senza));
	});
});
