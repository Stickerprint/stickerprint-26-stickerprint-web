import { describe, expect, it } from 'vitest';
import { layoutSheets, SHEET_RULES, SHEET_AUTO_MAX_H, STRIP_MATERIALS } from './layout';

it('la pagina e\' larga quanto la bobina: 700 sulla 70, 570 sulla 57', () => { expect(pageWidthFor(700)).toBe(700); expect(pageWidthFor(570)).toBe(570); });
import { SHEET_FRAMES, MARKED_MARGIN, pageWidthFor } from './graphtec';

/* la striscia dello Studio: bobina 70 cm (pagina 700, tutta l'area di stampa), crocini Graphtec, 10 mm fra i fogli */
const base = { stripW: pageWidthFor(700), margin: MARKED_MARGIN.x, marginY: MARKED_MARGIN.y, sheetGap: 10, sheets: 0 };
const auto = { ...base, stripH: 360, autoMaxH: SHEET_AUTO_MAX_H, frames: SHEET_FRAMES };

describe('fogli resinati (testa da 10 aghi)', () => {
	it('Ø80: foglio circa A4 da 2×3 = 6 (2 colonne = 5 aghi a etichetta), 3 fogli affiancati entro i 360', () => {
		const r = layoutSheets(80, 80, SHEET_RULES.resinati, auto);
		expect(r.ok).toBe(true);
		expect(r.sheet!.nearA4).toBe(true);
		expect(r.sheet!.grid.cols).toBe(2);
		expect(r.sheet!.grid.n).toBe(6);
		expect(Math.max(r.sheet!.w, r.sheet!.h)).toBeLessThan(300);
		expect(r.across).toBe(3);
		expect(r.piecesPerStrip).toBe(18);
		expect(r.stripH!).toBeLessThanOrEqual(360);
		expect(r.strips[0].h).toBe(r.stripH);
		expect(r.warning).toBeUndefined();
	});
	it('Ø80 con 54 etichette: 9 fogli da 6 in 3 strisce', () => {
		const r = layoutSheets(80, 80, SHEET_RULES.resinati, { ...auto, sheets: 9 });
		expect(r.strips).toHaveLength(3);
		expect(r.strips.map((s) => s.sheets!.length)).toEqual([3, 3, 3]);
		// tutti i fogli dentro la pagina
		for (const s of r.strips) for (const f of s.sheets!) { expect(f.x).toBeGreaterThanOrEqual(0); expect(f.x + f.w).toBeLessThanOrEqual(base.stripW + 1e-6); expect(f.y + f.h).toBeLessThanOrEqual(s.h + 1e-6); }
	});
	it('il foglio A4 vince anche con l\'altezza libera: mai fogli alti 43 cm', () => {
		for (const [w, h] of [[80, 80], [70, 70], [90, 60], [60, 90]]) {
			const r = layoutSheets(w, h, SHEET_RULES.resinati, auto);
			expect(r.ok).toBe(true);
			expect(r.sheet!.nearA4).toBe(true);
			expect(Math.max(r.sheet!.w, r.sheet!.h)).toBeLessThanOrEqual(297 * 1.15 + 0.1);
		}
	});
	it('50×50: foglio 5×4 circa A4, due per striscia come prima', () => {
		const r = layoutSheets(50, 50, SHEET_RULES.resinati, auto);
		expect(r.ok).toBe(true);
		expect(r.sheet!.nearA4).toBe(true);
		expect(r.sheet!.grid.cols).toBe(5);
		expect(r.across).toBeGreaterThanOrEqual(2);
	});
	it('le colonne dividono sempre i 10 aghi (1, 2, 5 o 10); le righe sono libere', () => {
		for (const [w, h] of [[25, 25], [80, 60], [40, 70], [50, 50], [60, 60], [100, 100], [120, 90]]) {
			const r = layoutSheets(w, h, SHEET_RULES.resinati, auto);
			expect(r.ok).toBe(true);
			expect([1, 2, 5, 10]).toContain(r.sheet!.grid.cols);
			expect(r.warning).toBeUndefined();
		}
	});
	it('senza alcun foglio A4 possibile (etichetta piu\' grande dell\'A4) si ripiega e lo si dice', () => {
		const r = layoutSheets(250, 250, SHEET_RULES.resinati, auto);
		expect(r.ok).toBe(true);
		expect(r.sheet!.nearA4).toBe(false);
		expect(r.warning).toMatch(/Nessun foglio "circa A4" possibile/);
	});
});

describe('larghezza di stampa e spazio fra le etichette (31/10/2026)', () => {
	it('la bobina da 70 stampa su 712 mm (e\' larga 750)', () => { expect(STRIP_MATERIALS[0].width).toBe(712); expect(pageWidthFor(STRIP_MATERIALS[0].width)).toBe(712); });
	it('con spazio 0 le etichette 50×50 stanno attaccate: piu\' etichette per foglio che con 2 mm', () => {
		const con2 = layoutSheets(50, 50, SHEET_RULES.etichette, { ...auto, stripW: 712 });
		const con0 = layoutSheets(50, 50, { ...SHEET_RULES.etichette, gap: 0 }, { ...auto, stripW: 712 });
		expect(con2.ok && con0.ok).toBe(true);
		expect(con0.sheet!.grid.n).toBeGreaterThanOrEqual(con2.sheet!.grid.n);
		/* fra due etichette adiacenti non c'e' spazio */
		const p = con0.sheet!.pieces;
		expect(Math.round((p[1].x - p[0].x) * 10) / 10).toBe(50);
	});
});
