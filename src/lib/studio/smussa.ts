/**
 * Stickerprint Studio — smussatura degli angoli vivi di un tracciato di taglio.
 *
 * I file pronti delle aziende arrivano spesso con spigoli a 90 gradi o anche piu' chiusi. In
 * resinatura un angolo vivo e' un punto debole: la resina ci si accumula, il pezzo si scheggia e il
 * plotter ci inchioda sopra. Qui gli angoli vivi si riconoscono da soli e si arrotondano quanto
 * decide l'operatore, lasciando intatto tutto il resto del tracciato del cliente.
 *
 * Come si riconosce un angolo vivo: nel punto in cui due tratti si incontrano si guarda se la
 * direzione di marcia CAMBIA DI COLPO. In un rettangolo stondato il passaggio fra lato e raccordo e'
 * dolce (la direzione non salta) e non viene toccato; in uno spigolo la direzione salta, ed e' li'
 * che si interviene.
 */
import { parsePath, type Seg } from './path';

export type P = [number, number];

/** un tratto del tracciato: retta (due punti) o curva di Bezier (quattro punti) */
interface Tratto {
	tipo: 'L' | 'C';
	p: P[];
}

/** un angolo vivo trovato sul tracciato */
export interface AngoloVivo {
	/** dove si trova (mm) */
	x: number;
	y: number;
	/** ampiezza dell'angolo interno in gradi: 90 = spigolo retto, meno = piu' appuntito */
	gradi: number;
	/** quanto si puo' smussare al massimo senza mangiarsi i tratti vicini (mm) */
	max: number;
}

const sub = (a: P, b: P): P => [a[0] - b[0], a[1] - b[1]];
const add = (a: P, b: P): P => [a[0] + b[0], a[1] + b[1]];
const mul = (a: P, k: number): P => [a[0] * k, a[1] * k];
const len = (a: P) => Math.hypot(a[0], a[1]);
const norm = (a: P): P => { const l = len(a) || 1; return [a[0] / l, a[1] / l]; };
const lerp = (a: P, b: P, t: number): P => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];

/** punto della curva al parametro t */
function punto(t: Tratto, u: number): P {
	if (t.tipo === 'L') return lerp(t.p[0], t.p[1], u);
	const [a, b, c, d] = t.p, s = 1 - u;
	return [
		s * s * s * a[0] + 3 * s * s * u * b[0] + 3 * s * u * u * c[0] + u * u * u * d[0],
		s * s * s * a[1] + 3 * s * s * u * b[1] + 3 * s * u * u * c[1] + u * u * u * d[1]
	];
}

/** direzione di marcia al parametro t (gia' normalizzata) */
function tangente(t: Tratto, u: number): P {
	if (t.tipo === 'L') return norm(sub(t.p[1], t.p[0]));
	const [a, b, c, d] = t.p, s = 1 - u;
	let v: P = [
		3 * s * s * (b[0] - a[0]) + 6 * s * u * (c[0] - b[0]) + 3 * u * u * (d[0] - c[0]),
		3 * s * s * (b[1] - a[1]) + 6 * s * u * (c[1] - b[1]) + 3 * u * u * (d[1] - c[1])
	];
	/* punti di controllo sovrapposti: la derivata si annulla, si guarda un filo piu' in la' */
	if (len(v) < 1e-9) v = sub(punto(t, Math.min(1, u + 0.01)), punto(t, Math.max(0, u - 0.01)));
	return norm(v);
}

/** lunghezza del tratto (campionata: basta e avanza per decidere dove tagliare) */
function lunghezza(t: Tratto): number {
	if (t.tipo === 'L') return len(sub(t.p[1], t.p[0]));
	let l = 0, prev = t.p[0];
	for (let i = 1; i <= 24; i++) { const q = punto(t, i / 24); l += len(sub(q, prev)); prev = q; }
	return l;
}

/** parametro a cui il tratto ha percorso `d` millimetri dall'inizio (o dalla fine se `daFine`) */
function paramA(t: Tratto, d: number, daFine: boolean): number {
	const tot = lunghezza(t);
	if (tot <= 1e-9) return daFine ? 1 : 0;
	const bersaglio = Math.min(d, tot) / tot;
	if (t.tipo === 'L') return daFine ? 1 - bersaglio : bersaglio;
	/* sulle curve la lunghezza non e' proporzionale al parametro: si cerca per bisezione */
	const dist = (u: number) => {
		let l = 0, prev = punto(t, 0);
		const n = 40;
		for (let i = 1; i <= n; i++) { const q = punto(t, (u * i) / n); l += len(sub(q, prev)); prev = q; }
		return l;
	};
	const voluto = daFine ? tot - Math.min(d, tot) : Math.min(d, tot);
	let lo = 0, hi = 1;
	for (let i = 0; i < 22; i++) { const m = (lo + hi) / 2; if (dist(m) < voluto) lo = m; else hi = m; }
	return (lo + hi) / 2;
}

/** porzione di tratto fra due parametri */
function porzione(t: Tratto, u0: number, u1: number): Tratto {
	if (t.tipo === 'L') return { tipo: 'L', p: [punto(t, u0), punto(t, u1)] };
	const [a, b, c, d] = t.p;
	// de Casteljau: prima si taglia a u1, poi la parte che resta a u0 riscalato
	const tagliaFine = (q: P[], u: number): P[] => {
		const ab = lerp(q[0], q[1], u), bc = lerp(q[1], q[2], u), cd = lerp(q[2], q[3], u);
		const abc = lerp(ab, bc, u), bcd = lerp(bc, cd, u);
		return [q[0], ab, abc, lerp(abc, bcd, u)];
	};
	const tagliaInizio = (q: P[], u: number): P[] => {
		const ab = lerp(q[0], q[1], u), bc = lerp(q[1], q[2], u), cd = lerp(q[2], q[3], u);
		const abc = lerp(ab, bc, u), bcd = lerp(bc, cd, u);
		return [lerp(abc, bcd, u), bcd, cd, q[3]];
	};
	let q = [a, b, c, d];
	if (u1 < 1) q = tagliaFine(q, u1);
	if (u0 > 0) q = tagliaInizio(q, u1 < 1 ? u0 / u1 : u0);
	return { tipo: 'C', p: q };
}

/** i tratti di ogni sotto-tracciato chiuso */
function tratti(segs: Seg[]): { chiusa: boolean; t: Tratto[] }[] {
	const out: { chiusa: boolean; t: Tratto[] }[] = [];
	let cur: Tratto[] = [], start: P = [0, 0], pos: P = [0, 0], aperta = false;
	const chiudi = (chiusa: boolean) => {
		if (cur.length) out.push({ chiusa, t: cur });
		cur = [];
	};
	for (const s of segs) {
		if (s[0] === 'M') { chiudi(false); start = pos = [s[1], s[2]]; aperta = true; }
		else if (s[0] === 'L') { if (aperta) cur.push({ tipo: 'L', p: [pos, [s[1], s[2]]] }); pos = [s[1], s[2]]; }
		else if (s[0] === 'C') { if (aperta) cur.push({ tipo: 'C', p: [pos, [s[1], s[2]], [s[3], s[4]], [s[5], s[6]]] }); pos = [s[5], s[6]]; }
		else if (s[0] === 'Z') {
			if (aperta && len(sub(pos, start)) > 1e-6) cur.push({ tipo: 'L', p: [pos, start] });
			chiudi(true); pos = start; aperta = false;
		}
	}
	chiudi(false);
	return out.filter((p) => p.t.length);
}

/** l'angolo interno (gradi) fra due tratti che si incontrano: 180 = dritto, 90 = spigolo retto */
function angoloFra(a: Tratto, b: Tratto): number {
	const tIn = tangente(a, 1), tOut = tangente(b, 0);
	const cos = Math.max(-1, Math.min(1, -tIn[0] * tOut[0] - tIn[1] * tOut[1]));
	return (Math.acos(cos) * 180) / Math.PI;
}

/** sotto questo angolo interno il vertice e' uno SPIGOLO, sopra e' un raccordo dolce */
const VIVO = 165;

/**
 * Gli angoli vivi del tracciato: dove la direzione di marcia salta di colpo.
 * `max` dice fino a quanti millimetri si puo' smussare quell'angolo senza mangiare i tratti vicini.
 */
export function angoliVivi(d: string, soglia = VIVO): AngoloVivo[] {
	const out: AngoloVivo[] = [];
	for (const p of tratti(parsePath(d))) {
		const n = p.t.length;
		for (let i = 0; i < n; i++) {
			const b = p.t[i], a = i === 0 ? (p.chiusa ? p.t[n - 1] : null) : p.t[i - 1];
			if (!a) continue;
			const g = angoloFra(a, b);
			if (g >= soglia) continue;
			out.push({ x: b.p[0][0], y: b.p[0][1], gradi: Math.round(g), max: Math.min(lunghezza(a), lunghezza(b)) * 0.45 });
		}
	}
	return out;
}

const n4 = (v: number) => Math.round(v * 1000) / 1000;

/**
 * Smussa tutti gli angoli vivi di `raggio` millimetri. Il resto del tracciato non si tocca:
 * si accorciano solo i due tratti che formano lo spigolo e in mezzo si mette un raccordo.
 * Con raggio 0 torna il tracciato di partenza.
 */
export function smussa(d: string, raggio: number, soglia = VIVO): string {
	if (!(raggio > 0)) return d;
	const gruppi = tratti(parsePath(d));
	if (!gruppi.length) return d;
	const fuori: string[] = [];

	for (const g of gruppi) {
		const n = g.t.length;
		/* per ogni tratto: quanto accorciarlo all'inizio e alla fine */
		const taglioIn = new Array(n).fill(0), taglioOut = new Array(n).fill(0);
		const vertice: (P | null)[] = new Array(n).fill(null);
		for (let i = 0; i < n; i++) {
			const prev = i === 0 ? (g.chiusa ? n - 1 : -1) : i - 1;
			if (prev < 0) continue;
			const a = g.t[prev], b = g.t[i];
			if (angoloFra(a, b) >= soglia) continue;
			/* non si mangia piu' del 45% di un tratto, cosi' due spigoli vicini non si sovrappongono */
			const q = Math.min(raggio, lunghezza(a) * 0.45, lunghezza(b) * 0.45);
			if (q <= 1e-4) continue;
			taglioOut[prev] = q; taglioIn[i] = q; vertice[i] = b.p[0];
		}

		/* si ricostruisce il contorno: tratti accorciati + raccordi negli spigoli */
		const pezzi: Tratto[] = [];
		for (let i = 0; i < n; i++) {
			const t = g.t[i];
			const u0 = taglioIn[i] > 0 ? paramA(t, taglioIn[i], false) : 0;
			const u1 = taglioOut[i] > 0 ? paramA(t, taglioOut[i], true) : 1;
			if (u1 <= u0 + 1e-6) continue;
			/* il raccordo del PRIMO vertice di un contorno chiuso si mette in coda, non qui:
			   qui il tratto precedente non e' ancora stato ricostruito */
			if (vertice[i] && pezzi.length) {
				const A = punto(pezzi[pezzi.length - 1], 1);
				const B = punto(t, u0), V = vertice[i]!;
				const k = 0.5523;
				pezzi.push({ tipo: 'C', p: [A, add(A, mul(sub(V, A), k)), add(B, mul(sub(V, B), k)), B] });
			}
			pezzi.push(porzione(t, u0, u1));
		}
		if (!pezzi.length) continue;

		/* l'eventuale raccordo del primo vertice su un contorno chiuso si aggiunge in coda */
		if (g.chiusa && vertice[0] && pezzi.length) {
			const A = punto(pezzi[pezzi.length - 1], 1), B = punto(pezzi[0], 0), V = vertice[0]!;
			const k = 0.5523;
			pezzi.push({ tipo: 'C', p: [A, add(A, mul(sub(V, A), k)), add(B, mul(sub(V, B), k)), B] });
		}

		const inizio = punto(pezzi[0], 0);
		let s = `M ${n4(inizio[0])} ${n4(inizio[1])}`;
		for (const p of pezzi) {
			if (p.tipo === 'L') s += ` L ${n4(p.p[1][0])} ${n4(p.p[1][1])}`;
			else s += ` C ${n4(p.p[1][0])} ${n4(p.p[1][1])} ${n4(p.p[2][0])} ${n4(p.p[2][1])} ${n4(p.p[3][0])} ${n4(p.p[3][1])}`;
		}
		if (g.chiusa) s += ' Z';
		fuori.push(s);
	}
	return fuori.join(' ') || d;
}
