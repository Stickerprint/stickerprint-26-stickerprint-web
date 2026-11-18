import { describe, it, expect } from 'vitest';
import { MARK, BARCODE_LENGTHS, BARCODE_REFLECTIVE, code39Bars, barcodeRects, barcodeSpan, barcodeFitting, barcodeLengthFor } from './graphtec';
/* crocini con codice a barre disegnati da Cutting Master 5 in Illustrator il 18/11/2026 (pagina 712 x 300,
   margini stampante 6,35): posizione e larghezza di ogni barra dei due codici, misurate dal bordo dei margini */
import cm5 from './graphtec.cm5.json';

type Caso = { id: string; narrow: number; W: number; H: number; F: number[]; Fw: number[]; R: number[]; Rw: number[]; yF: number; yR: number };
const casi = cm5 as Record<string, Caso>;

describe('codice a barre Graphtec', () => {
	it('il codice normale non cambia: barre da 0,4 e 1,0, lungo 75 mm', () => {
		const c = code39Bars('G12003EF4F');
		expect(c.length).toBeCloseTo(75, 6);
		expect(new Set(c.bars.map((b) => b.w))).toEqual(new Set([0.4, 1.0]));
		expect(code39Bars('G12003EF4F', MARK.narrow)).toEqual(c);
	});

	it('il codice lungo e\' lo stesso codice allargato: larga = stretta x 2,5', () => {
		const base = code39Bars('G12003EF4F');
		for (const n of BARCODE_LENGTHS) {
			const c = code39Bars('G12003EF4F', n);
			expect(c.bars.length).toBe(base.bars.length);
			expect(c.length).toBeCloseTo(187.5 * n, 6);
			c.bars.forEach((b, i) => {
				expect(b.x).toBeCloseTo((base.bars[i].x * n) / 0.4, 6);
				expect(b.w).toBeCloseTo((base.bars[i].w * n) / 0.4, 6);
			});
		}
	});

	for (const [nome, k] of Object.entries(casi)) {
		it(`coincide con Cutting Master 5 sul codice da ${nome} mm (${k.id})`, () => {
			const { rects } = barcodeRects(k.W, k.H, k.id, k.narrow);
			const barre = rects.filter((r) => r.w < MARK.blockW);
			const F = barre.filter((r) => r.y > 1).sort((a, b) => a.x - b.x);
			const R = barre.filter((r) => r.y < 1).sort((a, b) => a.x - b.x);
			expect(F.length).toBe(k.F.length);
			expect(R.length).toBe(k.R.length);
			F.forEach((r, i) => { expect(r.x).toBeCloseTo(k.F[i], 2); expect(r.w).toBeCloseTo(k.Fw[i], 2); expect(r.y).toBeCloseTo(k.yF, 2); expect(r.h).toBe(9); });
			R.forEach((r, i) => { expect(r.x).toBeCloseTo(k.R[i], 2); expect(r.w).toBeCloseTo(k.Rw[i], 2); expect(r.y).toBeCloseTo(k.yR, 2); });
			/* le due barre nere piene restano da 50 mm sul bordo */
			const piene = rects.filter((r) => r.w === MARK.blockW);
			expect(piene.map((r) => r.x).sort((a, b) => a - b)).toEqual([0, k.W - MARK.blockW]);
		});
	}

	it('sui materiali riflettenti sceglie il codice lungo, sugli altri il normale', () => {
		expect(barcodeLengthFor('bianco', 712)).toBe(0.4);
		expect(barcodeLengthFor('olografico', 712)).toBe(0.4);
		expect(barcodeLengthFor(undefined, 712)).toBe(0.4);
		for (const m of ['glitterato', 'argento', 'oro']) {
			expect(barcodeLengthFor(m, 712)).toBe(BARCODE_REFLECTIVE);
			expect(barcodeLengthFor(m, 570)).toBe(BARCODE_REFLECTIVE);
		}
		expect(barcodeLengthFor(['bianco', 'oro'], 712)).toBe(BARCODE_REFLECTIVE);
	});

	it('su una pagina stretta accorcia il codice finche\' sta, e rifiuta quello che non sta', () => {
		expect(barcodeSpan(2.0)).toBeCloseTo(439, 6);
		expect(barcodeSpan()).toBeCloseTo(139, 6);
		expect(barcodeFitting(712)).toBe(2.0);
		expect(barcodeFitting(400)).toBe(1.5);
		expect(barcodeFitting(300)).toBe(1.2);
		expect(barcodeFitting(200)).toBe(0.6);
		expect(barcodeFitting(712, 1.0)).toBe(1.0);
		expect(() => barcodeRects(300, 200, 'G12003EF4', 2.0)).toThrow(/non sta/);
		expect(() => barcodeRects(300, 200, 'G12003EF4', 1.2)).not.toThrow();
	});
});
