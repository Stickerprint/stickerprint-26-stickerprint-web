import { describe, it, expect } from 'vitest';
import { parsePath, scriviPath, semplificaSegmenti, semplificaLinee, contaPunti, puntiPer10cm, TOL_LINEE } from './path';

/** distanza di un punto dal segmento ab */
const distSeg = (p: [number, number], a: [number, number], b: [number, number]) => {
	const dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy;
	const t = l2 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2)) : 0;
	return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
};

/** cerchio di raggio r come polilinea a passo `step` mm (il file "a puntini" del cliente) */
function cerchioFitto(r: number, step: number): string {
	const n = Math.ceil((2 * Math.PI * r) / step);
	let d = '';
	for (let i = 0; i < n; i++) {
		const a = (i / n) * 2 * Math.PI;
		d += `${i ? 'L' : 'M'}${(r + r * Math.cos(a)).toFixed(4)} ${(r + r * Math.sin(a)).toFixed(4)} `;
	}
	return d + 'Z';
}

describe('semplificaLinee', () => {
	it('toglie i punti allineati di un rettangolo e lascia i quattro angoli', () => {
		const d = 'M0 0 L5 0 L10 0 L10 5 L10 10 L5 10 L0 10 L0 5 Z';
		expect(semplificaLinee(d)).toBe('M0 0 L10 0 L10 10 L0 10 L0 5 Z');
	});
	it('su un cerchio a passo 0,06 mm restano pochi punti e la linea non si sposta piu di 0,03 mm', () => {
		const segs = parsePath(cerchioFitto(60, 0.06));
		const prima = contaPunti(segs);
		const dopo = semplificaSegmenti(segs);
		expect(prima).toBeGreaterThan(6000);
		expect(contaPunti(dopo)).toBeLessThan(prima / 12);
		/* ogni punto originale sta a meno di TOL dal tracciato semplificato */
		const vert = dopo.filter((s) => s[0] === 'M' || s[0] === 'L').map((s) => [s[1], s[2]] as [number, number]);
		vert.push(vert[0]);
		let worst = 0;
		for (const s of segs) {
			if (s[0] !== 'L' && s[0] !== 'M') continue;
			let best = Infinity;
			for (let i = 1; i < vert.length; i++) best = Math.min(best, distSeg([s[1], s[2]], vert[i - 1], vert[i]));
			worst = Math.max(worst, best);
		}
		expect(worst).toBeLessThanOrEqual(TOL_LINEE + 1e-9);
		/* i punti che restano sono punti del file, non nuovi */
		const orig = new Set(segs.filter((s) => s[0] !== 'Z').map((s) => `${s[1]},${s[2]}`));
		for (const v of vert) expect(orig.has(`${v[0]},${v[1]}`)).toBe(true);
	});
	it('non tocca le curve e riparte dalla fine di ogni curva', () => {
		const d = 'M0 0 L1 0 L2 0 C3 0 4 1 4 2 L4 3 L4 4 Z';
		expect(semplificaLinee(d)).toBe('M0 0 L2 0 C3 0 4 1 4 2 L4 4 Z');
	});
	it('tiene i dettagli veri: un dente di 0,2 mm resta', () => {
		const d = 'M0 0 L5 0 L5.1 0.2 L5.2 0 L10 0 L10 10 L0 10 Z';
		expect(semplificaLinee(d)).toBe(scriviPath(parsePath(d)));
	});
	it('misura la densita dei punti ogni 10 cm', () => {
		expect(puntiPer10cm(parsePath('M0 0 L100 0 L100 100 L0 100 Z'))).toBe(1);
		expect(puntiPer10cm(parsePath(cerchioFitto(60, 0.06)))).toBeGreaterThan(1500);
	});
});
