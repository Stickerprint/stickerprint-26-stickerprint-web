/** Stickerprint Studio — lettura dei tracciati SVG del motore (M/L/H/V/C/A/Z) in segmenti M/L/C/Z. */

export type Seg = ['M', number, number] | ['L', number, number] | ['C', number, number, number, number, number, number] | ['Z'];

/** Converte il `d` di un path SVG (quello del motore) in segmenti assoluti M/L/C/Z. */
export function parsePath(d: string): Seg[] {
	const tok = d.match(/[a-zA-Z]|[-+]?(?:\d*\.\d+|\d+\.?)(?:[eE][-+]?\d+)?/g) ?? [];
	const out: Seg[] = [];
	let i = 0, cmd = '', x = 0, y = 0, sx = 0, sy = 0;
	const num = () => parseFloat(tok[i++]);
	const isNum = () => i < tok.length && !/^[a-zA-Z]$/.test(tok[i]);
	while (i < tok.length) {
		if (/^[a-zA-Z]$/.test(tok[i])) cmd = tok[i++];
		const rel = cmd === cmd.toLowerCase();
		const C = cmd.toUpperCase();
		if (C === 'Z') { out.push(['Z']); x = sx; y = sy; continue; }
		if (!isNum()) { i++; continue; }
		if (C === 'M') {
			x = (rel ? x : 0) + num(); y = (rel ? y : 0) + num();
			out.push(['M', x, y]); sx = x; sy = y;
			cmd = rel ? 'l' : 'L'; // coppie successive = linee
		} else if (C === 'L') {
			x = (rel ? x : 0) + num(); y = (rel ? y : 0) + num(); out.push(['L', x, y]);
		} else if (C === 'H') {
			x = (rel ? x : 0) + num(); out.push(['L', x, y]);
		} else if (C === 'V') {
			y = (rel ? y : 0) + num(); out.push(['L', x, y]);
		} else if (C === 'C') {
			const ox = rel ? x : 0, oy = rel ? y : 0;
			const a = [ox + num(), oy + num(), ox + num(), oy + num(), ox + num(), oy + num()];
			out.push(['C', a[0], a[1], a[2], a[3], a[4], a[5]]); x = a[4]; y = a[5];
		} else if (C === 'A') {
			const rx = num(), ry = num(), rotDeg = num(), large = num(), sweep = num();
			const ex = (rel ? x : 0) + num(), ey = (rel ? y : 0) + num();
			for (const c of arcToCubic(x, y, rx, ry, rotDeg, !!large, !!sweep, ex, ey)) out.push(c);
			x = ex; y = ey;
		} else {
			i++; // comando non gestito (il motore non li usa): si salta il numero
		}
	}
	return out;
}

/** Arco ellittico SVG -> curve di Bezier (spezzato in archi da al massimo 90 gradi). */
function arcToCubic(x1: number, y1: number, rx: number, ry: number, rotDeg: number, large: boolean, sweep: boolean, x2: number, y2: number): Seg[] {
	if (rx === 0 || ry === 0) return [['L', x2, y2]];
	rx = Math.abs(rx); ry = Math.abs(ry);
	const phi = (rotDeg * Math.PI) / 180, cos = Math.cos(phi), sin = Math.sin(phi);
	const dx = (x1 - x2) / 2, dy = (y1 - y2) / 2;
	const xp = cos * dx + sin * dy, yp = -sin * dx + cos * dy;
	const lam = (xp * xp) / (rx * rx) + (yp * yp) / (ry * ry);
	if (lam > 1) { const s = Math.sqrt(lam); rx *= s; ry *= s; }
	const num = rx * rx * ry * ry - rx * rx * yp * yp - ry * ry * xp * xp;
	const den = rx * rx * yp * yp + ry * ry * xp * xp;
	let k = Math.sqrt(Math.max(0, num / den));
	if (large === sweep) k = -k;
	const cxp = (k * rx * yp) / ry, cyp = (-k * ry * xp) / rx;
	const cx = cos * cxp - sin * cyp + (x1 + x2) / 2, cy = sin * cxp + cos * cyp + (y1 + y2) / 2;
	const ang = (ux: number, uy: number, vx: number, vy: number) => {
		const a = Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy);
		return a;
	};
	const t1 = ang(1, 0, (xp - cxp) / rx, (yp - cyp) / ry);
	let dt = ang((xp - cxp) / rx, (yp - cyp) / ry, (-xp - cxp) / rx, (-yp - cyp) / ry);
	if (!sweep && dt > 0) dt -= 2 * Math.PI;
	if (sweep && dt < 0) dt += 2 * Math.PI;
	const n = Math.max(1, Math.ceil(Math.abs(dt) / (Math.PI / 2) - 1e-9));
	const step = dt / n, alpha = (4 / 3) * Math.tan(step / 4);
	const pt = (t: number) => [cx + rx * Math.cos(t) * cos - ry * Math.sin(t) * sin, cy + rx * Math.cos(t) * sin + ry * Math.sin(t) * cos];
	const der = (t: number) => [-rx * Math.sin(t) * cos - ry * Math.cos(t) * sin, -rx * Math.sin(t) * sin + ry * Math.cos(t) * cos];
	const out: Seg[] = [];
	for (let j = 0; j < n; j++) {
		const a = t1 + j * step, b = a + step;
		const [ax, ay] = pt(a), [bx, by] = pt(b), [dax, day] = der(a), [dbx, dby] = der(b);
		out.push(['C', ax + alpha * dax, ay + alpha * day, bx - alpha * dbx, by - alpha * dby, bx, by]);
	}
	return out;
}


/** sposta un tracciato (mm) di dx, dy: serve a mettere ogni adesivo al suo posto nel foglio */
export function spostaPath(d: string, dx: number, dy: number): string {
	const n = (v: number) => (Math.round(v * 1000) / 1000).toString();
	return parsePath(d)
		.map((s) => {
			if (s[0] === 'M') return `M${n(s[1] + dx)} ${n(s[2] + dy)}`;
			if (s[0] === 'L') return `L${n(s[1] + dx)} ${n(s[2] + dy)}`;
			if (s[0] === 'C') return `C${n(s[1] + dx)} ${n(s[2] + dy)} ${n(s[3] + dx)} ${n(s[4] + dy)} ${n(s[5] + dx)} ${n(s[6] + dy)}`;
			return 'Z';
		})
		.join(' ');
}

/** matrice affine [a, b, c, d, e, f] come in SVG/PDF: x' = a·x + c·y + e, y' = b·x + d·y + f */
export type Matrice = [number, number, number, number, number, number];

/** segmenti -> `d` (M/L/C/Z assoluti, tre decimali) */
export function scriviPath(segs: Seg[]): string {
	const n = (v: number) => (Math.round(v * 1000) / 1000).toString();
	return segs
		.map((s) => {
			if (s[0] === 'M') return `M${n(s[1])} ${n(s[2])}`;
			if (s[0] === 'L') return `L${n(s[1])} ${n(s[2])}`;
			if (s[0] === 'C') return `C${n(s[1])} ${n(s[2])} ${n(s[3])} ${n(s[4])} ${n(s[5])} ${n(s[6])}`;
			return 'Z';
		})
		.join(' ');
}

/** applica una matrice affine a un tracciato (mm): serve a mettere un adesivo ruotato al suo posto nel foglio */
export function trasformaPath(d: string, m: Matrice): string {
	const [a, b, c, dd, e, f] = m;
	const T = (x: number, y: number): [number, number] => [a * x + c * y + e, b * x + dd * y + f];
	return scriviPath(
		parsePath(d).map((s): Seg => {
			if (s[0] === 'M' || s[0] === 'L') { const [x, y] = T(s[1], s[2]); return [s[0], x, y]; }
			if (s[0] === 'C') { const p = T(s[1], s[2]), q = T(s[3], s[4]), r = T(s[5], s[6]); return ['C', p[0], p[1], q[0], q[1], r[0], r[1]]; }
			return s;
		})
	);
}

/** matrice di un adesivo del foglio composto sul sito: riquadro w×h (mm) con il centro in (cx, cy), ruotato di `gradi` */
export function matriceAdesivo(cx: number, cy: number, w: number, h: number, gradi: number): Matrice {
	const r = (gradi * Math.PI) / 180, cos = Math.cos(r), sin = Math.sin(r);
	/* translate(cx, cy) · rotate(r) · translate(-w/2, -h/2) */
	return [cos, sin, -sin, cos, cx - (cos * w) / 2 + (sin * h) / 2, cy - (sin * w) / 2 - (cos * h) / 2];
}

/** rettangolo con gli angoli arrotondati (mm), origine nell'angolo in alto a sinistra: il bordo del foglio composto sul sito */
export function rettangoloArrotondato(w: number, h: number, raggio: number): string {
	const r = Math.max(0, Math.min(raggio, w / 2, h / 2));
	if (r <= 0) return scriviPath([['M', 0, 0], ['L', w, 0], ['L', w, h], ['L', 0, h], ['Z']]);
	const k = 0.5523 * r;
	return scriviPath([
		['M', r, 0], ['L', w - r, 0], ['C', w - r + k, 0, w, r - k, w, r],
		['L', w, h - r], ['C', w, h - r + k, w - r + k, h, w - r, h],
		['L', r, h], ['C', r - k, h, 0, h - r + k, 0, h - r],
		['L', 0, r], ['C', 0, r - k, r - k, 0, r, 0], ['Z']
	]);
}
