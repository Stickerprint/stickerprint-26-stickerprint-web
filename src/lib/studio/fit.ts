/**
 * Stickerprint Studio — tracciato di taglio con POCHI punti di ancoraggio.
 *
 * Il motore descrive il contorno con una curva per ogni punto della spezzata (centinaia di
 * nodi): il plotter rallenta su ogni nodo e un adesivo ci mette minuti. Qui il contorno
 * (la spezzata fitta del motore, in mm) viene:
 *   1. ricampionato a passo costante e lisciato (sparisce il tremolio dei pixel);
 *   2. spezzato solo sugli angoli veri (svolta netta in poco spazio);
 *   3. riadattato con curve di Bezier cubiche (Schneider, "An Algorithm for Automatically
 *      Fitting Digitized Curves", Graphics Gems 1990) con uno scarto massimo in mm.
 * Il risultato segue il contorno entro la tolleranza con pochi nodi, raccordati in tangenza.
 */

export type P = [number, number];
export type Bez = [P, P, P, P];

const add = (a: P, b: P): P => [a[0] + b[0], a[1] + b[1]];
const sub = (a: P, b: P): P => [a[0] - b[0], a[1] - b[1]];
const mul = (a: P, k: number): P => [a[0] * k, a[1] * k];
const dot = (a: P, b: P) => a[0] * b[0] + a[1] * b[1];
const len = (a: P) => Math.hypot(a[0], a[1]);
const norm = (a: P): P => { const l = len(a) || 1; return [a[0] / l, a[1] / l]; };
const dist = (a: P, b: P) => Math.hypot(a[0] - b[0], a[1] - b[1]);

/* ------------------------------------------------------------ preparazione */

function polyLength(pts: P[]) {
	let L = 0;
	for (let i = 0; i < pts.length; i++) L += dist(pts[i], pts[(i + 1) % pts.length]);
	return L;
}

/** ricampiona una spezzata CHIUSA a passo costante */
function resampleClosed(pts: P[], step: number): P[] {
	const L = polyLength(pts);
	const n = Math.max(8, Math.round(L / step));
	const d = L / n;
	const out: P[] = [];
	let i = 0, acc = 0, t = 0;
	for (let k = 0; k < n; k++) {
		const target = k * d;
		while (i < pts.length) {
			const a = pts[i], b = pts[(i + 1) % pts.length], s = dist(a, b);
			if (acc + s >= target || i === pts.length - 1) { t = s > 0 ? (target - acc) / s : 0; out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]); break; }
			acc += s; i++;
		}
	}
	return out;
}

/** media mobile circolare (lisciatura leggera) */
function smoothClosed(pts: P[], radius: number, passes: number): P[] {
	let cur = pts;
	const n = pts.length;
	for (let p = 0; p < passes; p++) {
		const next: P[] = new Array(n);
		for (let i = 0; i < n; i++) {
			let sx = 0, sy = 0;
			for (let k = -radius; k <= radius; k++) { const q = cur[(i + k + n) % n]; sx += q[0]; sy += q[1]; }
			next[i] = [sx / (2 * radius + 1), sy / (2 * radius + 1)];
		}
		cur = next;
	}
	return cur;
}

/** angoli veri: svolta > cornerDeg misurata su ±k punti, massimo locale */
function findCorners(pts: P[], k: number, cornerDeg: number): number[] {
	const n = pts.length, ang = new Float64Array(n);
	for (let i = 0; i < n; i++) {
		const a = norm(sub(pts[i], pts[(i - k + n) % n])), b = norm(sub(pts[(i + k) % n], pts[i]));
		ang[i] = Math.acos(Math.max(-1, Math.min(1, dot(a, b)))) * 180 / Math.PI;
	}
	const out: number[] = [];
	for (let i = 0; i < n; i++) {
		if (ang[i] < cornerDeg) continue;
		let best = true;
		for (let j = -k; j <= k; j++) if (j && ang[(i + j + n) % n] > ang[i]) { best = false; break; }
		if (best && (!out.length || i - out[out.length - 1] > k)) out.push(i);
	}
	if (out.length > 1 && out[0] + n - out[out.length - 1] <= k) out.pop();
	return out;
}

/* ------------------------------------------------------------ Schneider */

function bezPt(b: Bez, t: number): P {
	const u = 1 - t;
	return [
		u * u * u * b[0][0] + 3 * u * u * t * b[1][0] + 3 * u * t * t * b[2][0] + t * t * t * b[3][0],
		u * u * u * b[0][1] + 3 * u * u * t * b[1][1] + 3 * u * t * t * b[2][1] + t * t * t * b[3][1]
	];
}
function bezD1(b: Bez, t: number): P {
	const u = 1 - t;
	return [
		3 * (u * u * (b[1][0] - b[0][0]) + 2 * u * t * (b[2][0] - b[1][0]) + t * t * (b[3][0] - b[2][0])),
		3 * (u * u * (b[1][1] - b[0][1]) + 2 * u * t * (b[2][1] - b[1][1]) + t * t * (b[3][1] - b[2][1]))
	];
}
function bezD2(b: Bez, t: number): P {
	const u = 1 - t;
	return [
		6 * (u * (b[2][0] - 2 * b[1][0] + b[0][0]) + t * (b[3][0] - 2 * b[2][0] + b[1][0])),
		6 * (u * (b[2][1] - 2 * b[1][1] + b[0][1]) + t * (b[3][1] - 2 * b[2][1] + b[1][1]))
	];
}

function chordParams(pts: P[]): number[] {
	const u = [0];
	for (let i = 1; i < pts.length; i++) u.push(u[i - 1] + dist(pts[i], pts[i - 1]));
	const L = u[u.length - 1] || 1;
	return u.map((v) => v / L);
}

function generate(pts: P[], u: number[], t1: P, t2: P): Bez {
	const first = pts[0], last = pts[pts.length - 1];
	let c00 = 0, c01 = 0, c11 = 0, x0 = 0, x1 = 0;
	for (let i = 0; i < pts.length; i++) {
		const t = u[i], s = 1 - t;
		const b0 = s * s * s, b1 = 3 * s * s * t, b2 = 3 * s * t * t, b3 = t * t * t;
		const a1 = mul(t1, b1), a2 = mul(t2, b2);
		c00 += dot(a1, a1); c01 += dot(a1, a2); c11 += dot(a2, a2);
		const tmp = sub(pts[i], add(mul(first, b0 + b1), mul(last, b2 + b3)));
		x0 += dot(a1, tmp); x1 += dot(a2, tmp);
	}
	const det = c00 * c11 - c01 * c01;
	let al = det ? (x0 * c11 - x1 * c01) / det : 0, ar = det ? (c00 * x1 - c01 * x0) / det : 0;
	const segLen = dist(first, last), eps = 1e-6 * segLen;
	if (al < eps || ar < eps) { al = ar = segLen / 3; }
	return [first, add(first, mul(t1, al)), add(last, mul(t2, ar)), last];
}

function maxError(pts: P[], b: Bez, u: number[]): [number, number] {
	let max = 0, at = Math.floor(pts.length / 2);
	for (let i = 1; i < pts.length - 1; i++) {
		const d = dist(bezPt(b, u[i]), pts[i]);
		if (d > max) { max = d; at = i; }
	}
	return [max, at];
}

function reparam(pts: P[], u: number[], b: Bez): number[] {
	return u.map((t, i) => {
		const d = sub(bezPt(b, t), pts[i]), d1 = bezD1(b, t), d2 = bezD2(b, t);
		const den = dot(d1, d1) + dot(d, d2);
		const nt = den ? t - dot(d, d1) / den : t;
		return Math.max(0, Math.min(1, nt));
	});
}

function fitCubic(pts: P[], t1: P, t2: P, err: number, out: Bez[], depth = 0) {
	if (pts.length === 2) {
		const d = dist(pts[0], pts[1]) / 3;
		out.push([pts[0], add(pts[0], mul(t1, d)), add(pts[1], mul(t2, d)), pts[1]]);
		return;
	}
	let u = chordParams(pts);
	let b = generate(pts, u, t1, t2);
	let [e, split] = maxError(pts, b, u);
	if (e < err) { out.push(b); return; }
	if (e < err * 4) {
		for (let k = 0; k < 6; k++) {
			u = reparam(pts, u, b);
			b = generate(pts, u, t1, t2);
			[e, split] = maxError(pts, b, u);
			if (e < err) { out.push(b); return; }
		}
	}
	if (depth > 30 || pts.length < 4) { out.push(b); return; }
	split = Math.max(1, Math.min(pts.length - 2, split));
	const tc = norm(sub(pts[split - 1], pts[split + 1]));
	fitCubic(pts.slice(0, split + 1), t1, tc, err, out, depth + 1);
	fitCubic(pts.slice(split), mul(tc, -1), t2, err, out, depth + 1);
}

/* ------------------------------------------------------------ contorno chiuso */

export interface FitOptions {
	/** scarto massimo della curva dal contorno lisciato (mm) */
	tolerance?: number;
	/** svolta minima per considerare un angolo vero (gradi) */
	cornerDeg?: number;
	/** raggio della lisciatura del contorno (mm) */
	smooth?: number;
	/** tratto su cui si misura una svolta per dirla "angolo" (mm) */
	cornerWindow?: number;
	/** tratti dritti: scarto massimo dalla corda (mm) e lunghezza minima (mm); false = spento */
	straight?: { tol: number; minLen: number } | false;
}

/* ------------------------------------------------------------ tratti dritti */

/**
 * LINEE DRITTE (30/10/2026). Dove il disegno ha un lato dritto (il fianco della V, l'asta del 7)
 * il taglio deve essere una RETTA, non una curva che lo segue a onde. Qui si cercano, in un tratto
 * fra due angoli, le corse di punti che stanno tutti entro `tol` dalla loro corda, lunghe almeno
 * `minLen` e senza curvatura (svolta totale sotto i 3 gradi: un arco largo sta sotto `tol` ma gira,
 * e non va spezzato in faccette). Ritorna gli indici [inizio, fine] di ogni corsa, in ordine.
 */
export function trattiDritti(seg: P[], tol: number, minLen: number): [number, number][] {
	const n = seg.length, out: [number, number][] = [];
	if (n < 4) return out;
	const turn = (i: number) => {
		const a = sub(seg[i], seg[i - 1]), b = sub(seg[i + 1], seg[i]);
		return (Math.atan2(a[0] * b[1] - a[1] * b[0], dot(a, b)) * 180) / Math.PI;
	};
	let i = 0;
	while (i < n - 1) {
		let j = i + 1, best = i;
		let tot = 0;
		while (j < n) {
			// tutti i punti fra i e j entro tol dalla corda i-j?
			const a = seg[i], b = seg[j], dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1e-9;
			let ok = true;
			for (let k = i + 1; k < j && ok; k++) if (Math.abs((seg[k][0] - a[0]) * dy - (seg[k][1] - a[1]) * dx) / L > tol) ok = false;
			if (!ok) break;
			if (j >= i + 2) tot += turn(j - 1);
			if (Math.abs(tot) > 3) break;
			if (L >= minLen) best = j;
			j++;
		}
		if (best > i) { out.push([i, best]); i = best; } else i++;
	}
	return out;
}

/** un contorno chiuso (spezzata in mm) -> curve di Bezier con pochi nodi */
export function fitClosed(poly: P[], o: FitOptions = {}): Bez[] {
	const tol = o.tolerance ?? 0.2;
	const L = polyLength(poly);
	if (poly.length < 3 || L < 1) return [];
	const step = Math.max(0.05, Math.min(0.2, L / 2500));
	// lisciatura su circa ±0,5 mm: toglie le ondine del contorno (angoli inutili) senza spostarlo
	const pts = smoothClosed(resampleClosed(poly, step), Math.max(1, Math.round((o.smooth ?? 0.5) / step)), 2);
	const n = pts.length;
	const k = Math.max(2, Math.round((o.cornerWindow ?? 0.8) / step)); // angoli misurati su circa 0,8 mm (di piu' sui pezzi grandi)
	let cuts = findCorners(pts, k, o.cornerDeg ?? 55);
	const corner = new Set(cuts);
	// nessun angolo (o uno solo): si spezza comunque in punti lisci, con tangente continua
	if (cuts.length < 2) {
		const s = cuts[0] ?? 0;
		cuts = [s, (s + Math.floor(n / 3)) % n, (s + Math.floor((2 * n) / 3)) % n].sort((a, b) => a - b);
	}
	const tangentAt = (i: number, dir: 1 | -1): P => {
		if (corner.has(i)) {
			// angolo: tangente da un solo lato
			const j = (i + dir * Math.max(1, Math.round(k / 2)) + n) % n;
			return norm(sub(pts[j], pts[i]));
		}
		const a = pts[(i - 1 + n) % n], b = pts[(i + 1) % n];
		return dir === 1 ? norm(sub(b, a)) : norm(sub(a, b));
	};
	const out: Bez[] = [];
	for (let c = 0; c < cuts.length; c++) {
		const a = cuts[c], b = cuts[(c + 1) % cuts.length];
		const seg: P[] = [];
		for (let i = a; ; i = (i + 1) % n) { seg.push(pts[i]); if (i === b) break; if (seg.length > n + 1) break; }
		if (seg.length < 2) continue;
		const st = o.straight === false ? [] : trattiDritti(seg, o.straight?.tol ?? Math.max(0.1, tol * 0.6), o.straight?.minLen ?? 3);
		if (!st.length) { fitCubic(seg, tangentAt(a, 1), tangentAt(b, -1), tol, out); continue; }
		/* curva - retta - curva...: le rette sono Bezier con i controlli sulla corda; le curve accanto
		   partono con la tangente della retta, cosi' il raccordo e' continuo e senza gradino */
		let pos = 0, tIn = tangentAt(a, 1);
		for (const [i0, i1] of st) {
			const dir = norm(sub(seg[i1], seg[i0]));
			if (i0 > pos) {
				const parte = seg.slice(pos, i0 + 1);
				if (parte.length >= 2) fitCubic(parte, tIn, mul(dir, -1), tol, out);
			}
			const p0 = seg[i0], p1 = seg[i1], d3 = dist(p0, p1) / 3;
			out.push([p0, add(p0, mul(dir, d3)), add(p1, mul(dir, -d3)), p1]);
			pos = i1; tIn = dir;
		}
		if (pos < seg.length - 1) {
			const parte = seg.slice(pos);
			if (parte.length >= 2) fitCubic(parte, tIn, tangentAt(b, -1), tol, out);
		}
	}
	return out;
}

/** il tracciato SVG approvato (M/L/C/Z) -> spezzate fitte, una per sottotracciato (passo ~0,05 mm) */
export function samplePath(segs: ([string, ...number[]])[], step = 0.05): P[][] {
	const out: P[][] = [];
	let cur: P = [0, 0], poly: P[] = [];
	const flush = () => { if (poly.length > 2) out.push(poly); poly = []; };
	for (const sg of segs) {
		if (sg[0] === 'M') { flush(); cur = [sg[1] as number, sg[2] as number]; poly.push(cur); }
		else if (sg[0] === 'L') { cur = [sg[1] as number, sg[2] as number]; poly.push(cur); }
		else if (sg[0] === 'C') {
			const [, x1, y1, x2, y2, x3, y3] = sg as [string, number, number, number, number, number, number];
			const L = dist(cur, [x1, y1]) + dist([x1, y1], [x2, y2]) + dist([x2, y2], [x3, y3]);
			const n = Math.max(2, Math.ceil(L / step));
			for (let k = 1; k <= n; k++) poly.push(bezPt([cur, [x1, y1], [x2, y2], [x3, y3]], k / n));
			cur = [x3, y3];
		} else flush();
	}
	flush();
	return out;
}

/** tutti i contorni -> path SVG (M/C/Z) */
export function fitPathD(polys: P[][], o: FitOptions = {}): { d: string; nodes: number } {
	const f = (v: number) => (Math.round(v * 1000) / 1000).toString();
	let d = '', nodes = 0;
	for (const poly of polys) {
		const bz = fitClosed(poly, o);
		if (!bz.length) continue;
		d += `M${f(bz[0][0][0])} ${f(bz[0][0][1])}`;
		for (const b of bz) d += ` C${f(b[1][0])} ${f(b[1][1])} ${f(b[2][0])} ${f(b[2][1])} ${f(b[3][0])} ${f(b[3][1])}`;
		d += ' Z ';
		nodes += bz.length;
	}
	return { d: d.trim(), nodes };
}

/* ------------------------------------------------------------ pulizia del tracciato */

export interface Pulizia {
	/** zig-zag ogni 100 mm di contorno: svolte di almeno 12 gradi che invertono il verso entro 3 mm */
	zigzag100: number;
	/** svolta media per millimetro di contorno (gradi) */
	mediaGradi: number;
	/** perimetro totale (mm) */
	perimetro: number;
	/** vero = linee pulite, falso = tracciato frastagliato */
	ok: boolean;
}

/**
 * Quanto e' pulito un tracciato: si campiona a passo fisso (in scala col pezzo) e si contano le svolte che invertono il
 * verso a poca distanza (il dente di sega). Un angolo vero (stella, lettera) e' isolato e non
 * conta; una riga seghettata ne fa decine ogni 10 cm. Soglia tarata sul caso SP00509 (vercetti,
 * 381 mm: 9 zig-zag ogni 100 mm in stampa) e sui tondi e le sagome pulite (0).
 */
export function puliziaTracciato(polys: P[][]): Pulizia {
	/* la scala e' quella del pezzo: su uno sticker da 45 mm le curve da un millimetro sono il disegno
	   (orecchie, pelo), su uno da 381 mm sono seghettatura. Passo e finestra crescono con il lato lungo */
	let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
	for (const poly of polys) for (const [x, y] of poly) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
	const lato = Math.max(1, x1 - x0, y1 - y0);
	const step = Math.max(0.25, Math.min(0.6, lato / 800));
	let perimetro = 0, zig = 0, somma = 0, campioni = 0;
	for (const poly of polys) {
		const L = polyLength(poly);
		if (poly.length < 3 || L < 2) continue;
		const Q = resampleClosed(poly, step), n = Q.length;
		const ang: number[] = new Array(n);
		for (let j = 0; j < n; j++) {
			const a = Q[(j - 2 + n) % n], b = Q[j], c = Q[(j + 2) % n];
			const v1 = sub(b, a), v2 = sub(c, b);
			ang[j] = (Math.atan2(v1[0] * v2[1] - v1[1] * v2[0], dot(v1, v2)) * 180) / Math.PI;
			somma += Math.abs(ang[j]);
		}
		/* inversioni: una svolta >= 12 gradi seguita entro 6 passi da una >= 12 gradi di segno opposto */
		for (let j = 0; j < n; j++) {
			if (Math.abs(ang[j]) < 12) continue;
			for (let k = 1; k <= 6; k++) {
				const a2 = ang[(j + k) % n];
				if (Math.abs(a2) >= 12) { if (Math.sign(a2) !== Math.sign(ang[j])) zig++; break; }
			}
		}
		perimetro += L; campioni += n;
	}
	const zigzag100 = perimetro > 0 ? (zig / perimetro) * 100 : 0;
	const mediaGradi = campioni > 0 ? somma / campioni / step : 0; // gradi per millimetro di contorno
	return { zigzag100: Math.round(zigzag100 * 10) / 10, mediaGradi: Math.round(mediaGradi * 10) / 10, perimetro: Math.round(perimetro), ok: zigzag100 <= 1.5 };
}
