import { describe, expect, it } from 'vitest';
import { layoutSheets, SHEET_RULES, SHEET_AUTO_MAX_H } from './layout';
import { SHEET_FRAMES, MARKED_MARGIN, pageWidthFor } from './graphtec';

/* la striscia dello Studio: bobina 70 cm (pagina 688), crocini Graphtec, 10 mm fra i fogli */
const base = { stripW: pageWidthFor(700), margin: MARKED_MARGIN.x, marginY: MARKED_MARGIN.y, sheetGap: 10, sheets: 0 };
const auto = { ...base, stripH: 360, autoMaxH: SHEET_AUTO_MAX_H, frames: SHEET_FRAMES };

describe('fogli resinati (testa da 10 aghi)', () => {
	it('Ø80: con l\'altezza libera mette 3 fogli da 2×5 affiancati (30 etichette) invece di uno solo da 10', () => {
		const r = layoutSheets(80, 80, SHEET_RULES.resinati, auto);
		expect(r.ok).toBe(true);
		expect(r.sheet!.grid.n).toBe(10);
		expect(r.across).toBe(3);
		expect(r.down).toBe(1);
		expect(r.piecesPerStrip).toBe(30);
		expect(r.stripH!).toBeLessThanOrEqual(SHEET_AUTO_MAX_H);
		expect(r.strips[0].h).toBe(r.stripH);
		// resa per millimetro di bobina: almeno una volta e mezza la striscia di prima (10 etichette in 227 mm)
		expect(r.piecesPerStrip / (r.stripH! + 50)).toBeGreaterThan(1.5 * (10 / (227 + 50)));
	});
	it('Ø80 con 54 etichette: 6 fogli in 2 strisce', () => {
		const r = layoutSheets(80, 80, SHEET_RULES.resinati, { ...auto, sheets: 6 });
		expect(r.strips).toHaveLength(2);
		expect(r.strips.map((s) => s.sheets!.length)).toEqual([3, 3]);
		// tutti i fogli dentro la pagina
		for (const s of r.strips) for (const f of s.sheets!) { expect(f.x).toBeGreaterThanOrEqual(0); expect(f.x + f.w).toBeLessThanOrEqual(base.stripW + 1e-6); expect(f.y + f.h).toBeLessThanOrEqual(s.h + 1e-6); }
	});
	it('Ø80 con l\'altezza scritta a mano (360) resta dentro i 360', () => {
		const r = layoutSheets(80, 80, SHEET_RULES.resinati, { ...base, stripH: 360, frames: SHEET_FRAMES });
		expect(r.ok).toBe(true);
		expect(r.stripH!).toBeLessThanOrEqual(360);
	});
	it('50×50: foglio 5×4 circa A4, due per striscia come prima', () => {
		const r = layoutSheets(50, 50, SHEET_RULES.resinati, auto);
		expect(r.ok).toBe(true);
		expect(r.sheet!.nearA4).toBe(true);
		expect(r.sheet!.grid.n % 10).toBe(0);
		expect(r.across).toBeGreaterThanOrEqual(2);
	});
	it('le colonne stanno sempre nella testa e il totale e\' multiplo di 10', () => {
		for (const [w, h] of [[25, 25], [80, 60], [40, 70], [120, 90]]) {
			const r = layoutSheets(w, h, SHEET_RULES.resinati, auto);
			expect(r.ok).toBe(true);
			expect([1, 2, 5, 10]).toContain(r.sheet!.grid.cols);
			expect(r.sheet!.grid.n % 10).toBe(0);
		}
	});
	it('senza le opzioni nuove si comporta come prima (altezza fissa, una cornice)', () => {
		const r = layoutSheets(80, 80, SHEET_RULES.resinati, { ...base, stripH: 360 });
		expect(r.ok).toBe(true);
		expect(r.across).toBe(1);
		expect(r.piecesPerStrip).toBe(10);
	});
});
