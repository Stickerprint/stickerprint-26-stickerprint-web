/**
 * Stickerprint Studio — contorno esterno di un'immagine con trasparenza.
 * Serve per il foglio di adesivi composto sul sito quando qualche adesivo sporge dal bordo
 * (foglio "sagomato"): il PNG del sito e' trasparente fuori dal foglio e dagli adesivi, e il
 * passante deve seguire proprio quel profilo. Si legge il canale alfa, si tiene il pezzo piu'
 * grande, se ne segue il bordo e lo si riadatta con poche curve (fit.ts), come le altre sagome.
 */
import { fitPathD, type FitOptions, type P } from './fit';

export interface Contorno {
	/** tracciato SVG (mm, origine nell'angolo in alto a sinistra dell'immagine) */
	pathD: string;
	nodes: number;
	/** riquadro del contorno (mm) */
	bbox: { x: number; y: number; w: number; h: number };
}

export interface ContornoOpts extends FitOptions {
	/** alfa minima per contare un pixel come pieno (0-255) */
	soglia?: number;
	/** celle per millimetro della griglia di lettura (default 4: un quarto di millimetro) */
	cellePerMm?: number;
}

type Img = { width: number; height: number; data: Uint8ClampedArray | Uint8Array };

/** griglia binaria a blocchi: una cella e' piena se almeno un pixel del blocco e' pieno (il taglio sta fuori, mai dentro) */
function griglia(img: Img, k: number, soglia: number) {
	const gw = Math.ceil(img.width / k), gh = Math.ceil(img.height / k);
	const bin = new Uint8Array(gw * gh);
	const d = img.data, W = img.width;
	for (let y = 0; y < img.height; y++) {
		const gy = (y / k) | 0;
		for (let x = 0; x < W; x++) {
			if (d[(y * W + x) * 4 + 3] >= soglia) bin[gy * gw + ((x / k) | 0)] = 1;
		}
	}
	return { bin, gw, gh };
}

/** tiene solo il pezzo piu' grande (4 vicini) */
function pezzoPiuGrande(bin: Uint8Array, w: number, h: number): Uint8Array {
	const lab = new Int32Array(w * h).fill(-1);
	const sizes: number[] = [];
	const st: number[] = [];
	for (let s = 0; s < w * h; s++) {
		if (!bin[s] || lab[s] >= 0) continue;
		const n = sizes.length;
		let a = 0;
		st.length = 0; st.push(s); lab[s] = n;
		while (st.length) {
			const i = st.pop() as number; a++;
			const x = i % w, y = (i / w) | 0;
			if (x > 0 && bin[i - 1] && lab[i - 1] < 0) { lab[i - 1] = n; st.push(i - 1); }
			if (x < w - 1 && bin[i + 1] && lab[i + 1] < 0) { lab[i + 1] = n; st.push(i + 1); }
			if (y > 0 && bin[i - w] && lab[i - w] < 0) { lab[i - w] = n; st.push(i - w); }
			if (y < h - 1 && bin[i + w] && lab[i + w] < 0) { lab[i + w] = n; st.push(i + w); }
		}
		sizes.push(a);
	}
	if (!sizes.length) return new Uint8Array(w * h);
	let best = 0;
	sizes.forEach((v, i) => { if (v > sizes[best]) best = i; });
	const out = new Uint8Array(w * h);
	for (let i = 0; i < w * h; i++) if (lab[i] === best) out[i] = 1;
	return out;
}

/** i bordi fra celle piene e vuote, percorsi in senso orario (y verso il basso), uniti in anelli chiusi */
function anelli(bin: Uint8Array, w: number, h: number): [number, number][][] {
	const at = (x: number, y: number) => (x < 0 || y < 0 || x >= w || y >= h ? 0 : bin[y * w + x]);
	const key = (x: number, y: number) => y * (w + 1) + x;
	/* da ogni vertice di partenza, i tratti che ne escono */
	const next = new Map<number, [number, number][]>();
	const add = (sx: number, sy: number, ex: number, ey: number) => {
		const k = key(sx, sy), a = next.get(k);
		if (a) a.push([ex, ey]); else next.set(k, [[ex, ey]]);
	};
	for (let y = 0; y < h; y++)
		for (let x = 0; x < w; x++) {
			if (!bin[y * w + x]) continue;
			if (!at(x, y - 1)) add(x, y, x + 1, y);
			if (!at(x + 1, y)) add(x + 1, y, x + 1, y + 1);
			if (!at(x, y + 1)) add(x + 1, y + 1, x, y + 1);
			if (!at(x - 1, y)) add(x, y + 1, x, y);
		}
	const out: [number, number][][] = [];
	for (const [k0, lista] of next) {
		while (lista.length) {
			const start: [number, number] = [k0 % (w + 1), Math.floor(k0 / (w + 1))];
			const loop: [number, number][] = [start];
			let cur = lista.pop() as [number, number];
			let guard = 0;
			while ((cur[0] !== start[0] || cur[1] !== start[1]) && guard++ < w * h * 4) {
				loop.push(cur);
				const l = next.get(key(cur[0], cur[1]));
				if (!l || !l.length) break;
				cur = l.pop() as [number, number];
			}
			if (loop.length >= 4) out.push(loop);
		}
	}
	return out;
}

const area = (p: [number, number][]) => {
	let a = 0;
	for (let i = 0; i < p.length; i++) { const q = p[(i + 1) % p.length]; a += p[i][0] * q[1] - q[0] * p[i][1]; }
	return a / 2;
};

/** toglie i punti allineati e le scalette piu' piccole di `tol` (Ramer-Douglas-Peucker su un anello) */
function semplifica(p: P[], tol: number): P[] {
	if (p.length < 5) return p;
	/* si parte dai due punti piu' lontani, cosi' l'anello si spezza in due tratti aperti */
	let i0 = 0, i1 = 0, dmax = -1;
	for (let i = 0; i < p.length; i += Math.max(1, (p.length / 400) | 0)) {
		const d = (p[i][0] - p[0][0]) ** 2 + (p[i][1] - p[0][1]) ** 2;
		if (d > dmax) { dmax = d; i1 = i; }
	}
	const rdp = (pts: P[]): P[] => {
		if (pts.length < 3) return pts;
		const a = pts[0], b = pts[pts.length - 1];
		const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1;
		let best = 0, bi = 0;
		for (let i = 1; i < pts.length - 1; i++) {
			const d = Math.abs((pts[i][0] - a[0]) * dy - (pts[i][1] - a[1]) * dx) / L;
			if (d > best) { best = d; bi = i; }
		}
		if (best <= tol) return [a, b];
		const l = rdp(pts.slice(0, bi + 1)), r = rdp(pts.slice(bi));
		return l.slice(0, -1).concat(r);
	};
	const tratto1 = p.slice(i0, i1 + 1), tratto2 = p.slice(i1).concat([p[0]]);
	const r1 = rdp(tratto1), r2 = rdp(tratto2);
	return r1.slice(0, -1).concat(r2.slice(0, -1));
}

/** contorno esterno delle zone opache: null se l'immagine e' tutta trasparente */
export function contornoAlpha(img: Img, ppm: number, o: ContornoOpts = {}): Contorno | null {
	const k = Math.max(1, Math.round(ppm / (o.cellePerMm ?? 4)));
	const { bin, gw, gh } = griglia(img, k, o.soglia ?? 128);
	const solo = pezzoPiuGrande(bin, gw, gh);
	const loops = anelli(solo, gw, gh);
	if (!loops.length) return null;
	let best = loops[0], bestA = Math.abs(area(best));
	for (const l of loops) { const a = Math.abs(area(l)); if (a > bestA) { best = l; bestA = a; } }
	const mm = k / ppm;
	const poly: P[] = semplifica(best.map(([x, y]) => [x * mm, y * mm] as P), Math.max(0.05, mm * 0.6));
	const fit = fitPathD([poly], { tolerance: o.tolerance ?? 0.2, smooth: o.smooth ?? 0.5, cornerDeg: o.cornerDeg ?? 55 });
	let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
	for (const [x, y] of poly) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
	return { pathD: fit.d, nodes: fit.nodes, bbox: { x: x0, y: y0, w: x1 - x0, h: y1 - y0 } };
}
