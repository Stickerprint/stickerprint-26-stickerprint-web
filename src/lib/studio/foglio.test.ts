import { describe, expect, it } from 'vitest';
import { contornoAlpha } from './contorno';
import { bordoFoglio, misureFoglio, soggettiDelFoglio, tracciatoAdesivo, type FoglioLayout } from './foglio';
import { matriceAdesivo, parsePath, rettangoloArrotondato, trasformaPath } from './path';
import { samplePath } from './fit';

const bbox = (d: string) => {
	const pts = samplePath(parsePath(d), 0.2).flat();
	const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
	return { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) };
};

describe('tracciati del foglio composto', () => {
	it('un adesivo ruotato di 90 gradi finisce nel riquadro giusto', () => {
		/* riquadro 40×20 con il centro in (100, 50), girato: occupa 20×40 attorno al centro */
		const d = trasformaPath(rettangoloArrotondato(40, 20, 0), matriceAdesivo(100, 50, 40, 20, 90));
		const b = bbox(d);
		expect(b.x0).toBeCloseTo(90, 3); expect(b.x1).toBeCloseTo(110, 3);
		expect(b.y0).toBeCloseTo(30, 3); expect(b.y1).toBeCloseTo(70, 3);
	});
	it('senza rotazione il riquadro resta centrato', () => {
		const d = trasformaPath(rettangoloArrotondato(30, 10, 2), matriceAdesivo(50, 50, 30, 10, 0));
		const b = bbox(d);
		expect(b.x0).toBeCloseTo(35, 1); expect(b.x1).toBeCloseTo(65, 1);
		expect(b.y0).toBeCloseTo(45, 1); expect(b.y1).toBeCloseTo(55, 1);
	});
	it('il tracciato salvato dal sito vince sulla forma geometrica', () => {
		const t = tracciatoAdesivo({ n: 1, forma: 'sagomato', w: 30, h: 20, x: 0, y: 0, rot: 0, cut: { pathD: 'M0 0 L30 0 L30 20 L0 20 Z', w: 30, h: 20 } });
		expect(t.stimato).toBe(false);
		const senza = tracciatoAdesivo({ n: 1, forma: 'tondo', w: 30, h: 30, x: 0, y: 0, rot: 0 });
		expect(senza.stimato).toBe(true);
		const b = bbox(senza.d);
		expect(b.x1 - b.x0).toBeCloseTo(30, 1); expect(b.y1 - b.y0).toBeCloseTo(30, 1);
	});
	it('nel foglio sagomato gli adesivi si spostano dell’aria attorno', () => {
		const lay: FoglioLayout = {
			sheet: { w: 100, h: 150, orientamento: 'verticale', formato: 'S', sagomato: true, bgColor: '#ffffff', bgImage: false, materiale: 'bianco', finitura: 'lucida', pad: 22 },
			stickers: [{ n: 1, forma: 'quadrato', w: 20, h: 20, x: 10, y: 10, rot: 0 }]
		};
		expect(misureFoglio(lay)).toEqual({ w: 144, h: 194 });
		const [s] = soggettiDelFoglio(lay);
		const b = bbox(s.pathD);
		expect(b.x0).toBeCloseTo(22, 3); expect(b.y0).toBeCloseTo(22, 3);
		expect(b.x1).toBeCloseTo(42, 3);
	});
	it('il bordo del foglio normale e’ un rettangolo con gli angoli tondi grande come il foglio', () => {
		const lay: FoglioLayout = { sheet: { w: 148, h: 210, orientamento: 'verticale', formato: 'M', sagomato: false, bgColor: '#fff', bgImage: false, materiale: 'bianco', finitura: 'lucida' }, stickers: [] };
		const b = bbox(bordoFoglio(lay));
		expect(b.x0).toBeCloseTo(0, 2); expect(b.y0).toBeCloseTo(0, 2);
		expect(b.x1).toBeCloseTo(148, 2); expect(b.y1).toBeCloseTo(210, 2);
	});
});

describe('contorno dal canale alfa', () => {
	/* immagine 4 px/mm: un foglio 60×40 mm opaco con un cerchio Ø20 che sporge a destra */
	const ppm = 4, W = 100 * ppm, H = 60 * ppm;
	const data = new Uint8ClampedArray(W * H * 4);
	const pieno = (x: number, y: number) => { const i = (y * W + x) * 4; data[i] = 255; data[i + 1] = 255; data[i + 2] = 255; data[i + 3] = 255; };
	for (let y = 10 * ppm; y < 50 * ppm; y++) for (let x = 10 * ppm; x < 70 * ppm; x++) pieno(x, y);
	for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (Math.hypot(x / ppm - 75, y / ppm - 30) <= 10) pieno(x, y);
	/* un pezzetto staccato: non deve entrare nel contorno */
	for (let y = 2; y < 6; y++) for (let x = 2; x < 6; x++) pieno(x, y);
	it('segue il profilo opaco e scarta i pezzetti staccati', () => {
		const c = contornoAlpha({ width: W, height: H, data }, ppm);
		expect(c).not.toBeNull();
		const b = c!.bbox;
		expect(b.x).toBeCloseTo(10, 0); expect(b.y).toBeCloseTo(10, 0);
		expect(b.x + b.w).toBeCloseTo(85, 0); expect(b.y + b.h).toBeCloseTo(50, 0);
		expect(c!.nodes).toBeGreaterThan(3);
		expect(c!.nodes).toBeLessThan(60);
		const pb = bbox(c!.pathD);
		expect(pb.x0).toBeGreaterThan(9); expect(pb.x1).toBeLessThan(86.5);
	});
	it('immagine trasparente: nessun contorno', () => {
		expect(contornoAlpha({ width: 8, height: 8, data: new Uint8ClampedArray(8 * 8 * 4) }, 4)).toBeNull();
	});
});

describe('passante del foglio in tracciato', () => {
	it('finisce nel file Graphtec come curve (BZ1) e nel PDF senza errori', async () => {
		const { xpfCommands } = await import('./graphtec');
		const { buildPdf } = await import('./pdf');
		const bordo = rettangoloArrotondato(100, 150, 4);
		const pieces = [{ x: 30, y: 30, rot: false }, { x: 140, y: 30, rot: true }];
		const sheets = [{ x: 30, y: 30, w: 100, h: 150, rot: false, pathD: bordo }, { x: 140, y: 30, w: 150, h: 100, rot: true, pathD: bordo }];
		const cmd = xpfCommands({ id: 'G1200TEST', W: 700, H: 360, pathD: 'M0 0 L20 0 L20 20 L0 20 Z', cutW: 100, cutH: 150, pieces, sheets, pieceCond: 1, sheetCond: 3 });
		expect(cmd).toContain('J3');
		expect((cmd.match(/BZ1,/g) ?? []).length).toBe(8); // 4 angoli tondi per foglio, 2 fogli
		/* il foglio girato: il primo punto M(r, 0) del bordo finisce in (x + w - 0, y + r) */
		const png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82, 0, 0, 0, 1, 0, 0, 0, 1, 8, 6, 0, 0, 0, 31, 21, 196, 137, 0, 0, 0, 13, 73, 68, 65, 84, 120, 156, 99, 248, 255, 255, 63, 0, 5, 254, 2, 254, 167, 53, 129, 132, 0, 0, 0, 0, 73, 69, 78, 68, 174, 66, 96, 130]);
		const bytes = await buildPdf({ title: 'prova', arts: [{ png, cutW: 100, cutH: 150, bleed: 0, pathD: 'M0 0 L20 0 L20 20 L0 20 Z' }], pages: [{ w: 700, h: 360, pieces, sheets }], pieceCut: 'CutContour', sheetCut: 'Passante' });
		expect(bytes.length).toBeGreaterThan(1000);
	});
});
