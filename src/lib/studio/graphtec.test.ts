import { describe, expect, it } from 'vitest';
import { MARK, MARK_MASK, MARKED_MARGIN, SHEET_FRAMES, barcodeRects, markRects, maskFor, maskRects, markedMargin, markedMarginWide, sheetFrames, xpfCommands, type XpfJob } from './graphtec';

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
