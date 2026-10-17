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
const EPS = 1e-9;
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

/* ------------------------------------------------------------------ lo spigolo nel suo giro

   Il primo smusso tagliava i DUE TRATTI che formano lo spigolo, al massimo il 45% di ognuno.
   Funziona finche' quei tratti sono lunghi, ma non e' cosi' che e' fatto un tracciato vero: il
   logo Rineau (17/10/2026) ha una linguetta attaccata all'ovale con due monconi da 0,24 mm, e il
   limite del 45% fermava il raccordo a 0,11 mm — invisibile, Mattia vedeva il tracciato "identico".

   Qui lo spigolo si guarda lungo TUTTO il contorno, non sui due tratti che lo toccano: si cammina
   all'indietro e in avanti per i millimetri chiesti, attraversando quanti tratti serve. Il limite
   diventa la distanza dallo spigolo VICINO (meta' strada, cosi' due raccordi non si accavallano).
   ------------------------------------------------------------------ */

/** un contorno percorribile a millimetri: i tratti con la loro lunghezza progressiva */
interface Giro {
	t: Tratto[];
	chiusa: boolean;
	/** lunghezza di ogni tratto */
	l: number[];
	/** lunghezza progressiva all'INIZIO di ogni tratto (l'ultima voce e' il totale) */
	s: number[];
}

function giro(g: { chiusa: boolean; t: Tratto[] }): Giro {
	const l = g.t.map(lunghezza), s = [0];
	for (const q of l) s.push(s[s.length - 1] + q);
	return { t: g.t, chiusa: g.chiusa, l, s };
}

/** il punto del contorno a `d` millimetri dall'inizio */
function puntoA(G: Giro, d: number): P {
	const tot = G.s[G.s.length - 1];
	let x = G.chiusa ? ((d % tot) + tot) % tot : Math.max(0, Math.min(tot, d));
	for (let i = 0; i < G.t.length; i++) {
		if (x <= G.l[i] + EPS) return punto(G.t[i], paramA(G.t[i], x, false));
		x -= G.l[i];
	}
	return punto(G.t[G.t.length - 1], 1);
}

/** la direzione di marcia del contorno a `d` millimetri dall'inizio */
function tangenteA(G: Giro, d: number): P {
	const tot = G.s[G.s.length - 1];
	let x = G.chiusa ? ((d % tot) + tot) % tot : Math.max(0, Math.min(tot, d));
	for (let i = 0; i < G.t.length; i++) {
		if (x <= G.l[i] + EPS) return tangente(G.t[i], paramA(G.t[i], x, false));
		x -= G.l[i];
	}
	return tangente(G.t[G.t.length - 1], 1);
}

/** il pezzo di contorno fra due misure progressive, come tratti interi o porzioni */
function pezzoDa(G: Giro, da: number, a: number): Tratto[] {
	const tot = G.s[G.s.length - 1];
	const out: Tratto[] = [];
	if (a - da <= 1e-6) return out;
	let resta = a - da;
	let x = G.chiusa ? ((da % tot) + tot) % tot : Math.max(0, da);
	let i = 0;
	while (x > G.l[i] + EPS) { x -= G.l[i]; i = (i + 1) % G.t.length; }
	while (resta > 1e-6) {
		const t = G.t[i], disponibile = G.l[i] - x;
		const prendo = Math.min(resta, disponibile);
		if (prendo > 1e-6) {
			const u0 = x <= 1e-9 ? 0 : paramA(t, x, false);
			const u1 = x + prendo >= G.l[i] - 1e-9 ? 1 : paramA(t, x + prendo, false);
			if (u1 > u0 + 1e-9) out.push(porzione(t, u0, u1));
		}
		resta -= prendo;
		x = 0;
		i = (i + 1) % G.t.length;
		if (!G.chiusa && i === 0) break;
	}
	return out;
}

/** gli spigoli di un contorno: dove si trovano (in millimetri dal via) e quanto sono chiusi */
function spigoli(G: Giro, soglia: number): { i: number; s: number; gradi: number }[] {
	const out: { i: number; s: number; gradi: number }[] = [];
	const n = G.t.length;
	for (let i = 0; i < n; i++) {
		const prec = i === 0 ? (G.chiusa ? n - 1 : -1) : i - 1;
		if (prec < 0) continue;
		const g = angoloFra(G.t[prec], G.t[i]);
		if (g < soglia) out.push({ i, s: G.s[i], gradi: Math.round(g) });
	}
	return out;
}

/** quanto puo' aprirsi ogni raccordo senza toccare quello vicino: meta' strada fra due spigoli */
function respiro(G: Giro, sp: { s: number }[]): number[] {
	const tot = G.s[G.s.length - 1];
	if (!sp.length) return [];
	if (sp.length === 1) return [G.chiusa ? tot * 0.45 : Math.min(sp[0].s, tot - sp[0].s) * 0.9];
	return sp.map((c, k) => {
		const prima = k === 0 ? (G.chiusa ? tot - sp[sp.length - 1].s + c.s : c.s) : c.s - sp[k - 1].s;
		const dopo = k === sp.length - 1 ? (G.chiusa ? tot - c.s + sp[0].s : tot - c.s) : sp[k + 1].s - c.s;
		return Math.min(prima, dopo) * 0.45;
	});
}

/**
 * Gli angoli vivi del tracciato: dove la direzione di marcia salta di colpo.
 * `max` dice fino a quanti millimetri si puo' aprire il raccordo prima di toccare lo spigolo vicino.
 */
export function angoliVivi(d: string, soglia = VIVO): AngoloVivo[] {
	const out: AngoloVivo[] = [];
	for (const p of tratti(parsePath(d))) {
		const G = giro(p);
		const sp = spigoli(G, soglia);
		const resp = respiro(G, sp);
		sp.forEach((c, k) => out.push({ x: G.t[c.i].p[0][0], y: G.t[c.i].p[0][1], gradi: c.gradi, max: resp[k] }));
	}
	return out;
}

const n4 = (v: number) => Math.round(v * 1000) / 1000;

/**
 * Smussa tutti gli angoli vivi di `raggio` millimetri. Il resto del tracciato non si tocca: si
 * accorcia il contorno solo attorno agli spigoli e in mezzo si mette un raccordo.
 * Con raggio 0 torna il tracciato di partenza.
 */
export function smussa(d: string, raggio: number, soglia = VIVO): string {
	if (!(raggio > 0)) return d;
	const gruppi = tratti(parsePath(d));
	if (!gruppi.length) return d;
	const fuori: string[] = [];

	for (const g of gruppi) {
		const G = giro(g);
		const sp = spigoli(G, soglia);
		if (!sp.length) { fuori.push(scrivi(G.t, G.chiusa)); continue; }
		const resp = respiro(G, sp);
		const q = sp.map((_, k) => Math.max(0, Math.min(raggio, resp[k])));
		const tot = G.s[G.s.length - 1];

		const pezzi: Tratto[] = [];
		/* Il raccordo deve ripartire NELLA STESSA DIREZIONE in cui il contorno arrivava, altrimenti
		   all'innesto resta un gomito — si vedeva allargando lo smusso sull'ovale del Rineau, dove il
		   raccordo si attacca a una curva e non a una retta. Quindi i punti di controllo si mettono
		   sulle tangenti vere, e lo spigolo "virtuale" e' dove le due tangenti si incrociano. */
		const k = 0.5523;
		const raccordo = (A: P, B: P, V: P, tA: P, tB: P): Tratto => {
			const den = tA[0] * tB[1] - tA[1] * tB[0];
			let W = V;
			if (Math.abs(den) > 1e-6) {
				const u = ((B[0] - A[0]) * tB[1] - (B[1] - A[1]) * tB[0]) / den;
				if (u > 0 && u < len(sub(B, A)) * 6) W = add(A, mul(tA, u));
			}
			const hA = Math.min(len(sub(W, A)), len(sub(B, A)) * 1.5) * k;
			const hB = Math.min(len(sub(W, B)), len(sub(B, A)) * 1.5) * k;
			return { tipo: 'C', p: [A, add(A, mul(tA, hA)), add(B, mul(tB, -hB)), B] };
		};

		if (G.chiusa) {
			/* si parte subito DOPO il primo raccordo e si gira fino a tornarci */
			for (let n = 0; n < sp.length; n++) {
				const c = sp[n], dq = q[n];
				const A = puntoA(G, c.s - dq), B = puntoA(G, c.s + dq);
				if (dq > 1e-4) pezzi.push(raccordo(A, B, G.t[c.i].p[0], tangenteA(G, c.s - dq), tangenteA(G, c.s + dq)));
				const prossimo = n === sp.length - 1 ? sp[0].s + tot : sp[n + 1].s;
				const dqProssimo = n === sp.length - 1 ? q[0] : q[n + 1];
				pezzi.push(...pezzoDa(G, c.s + dq, prossimo - dqProssimo));
			}
		} else {
			let cursore = 0;
			for (let n = 0; n < sp.length; n++) {
				const c = sp[n], dq = q[n];
				pezzi.push(...pezzoDa(G, cursore, c.s - dq));
				const A = puntoA(G, c.s - dq), B = puntoA(G, c.s + dq);
				if (dq > 1e-4) pezzi.push(raccordo(A, B, G.t[c.i].p[0], tangenteA(G, c.s - dq), tangenteA(G, c.s + dq)));
				cursore = c.s + dq;
			}
			pezzi.push(...pezzoDa(G, cursore, tot));
		}
		if (pezzi.length) fuori.push(scrivi(pezzi, G.chiusa));
	}
	return fuori.join(' ') || d;
}

/** i tratti in un `d` SVG */
function scrivi(pezzi: Tratto[], chiusa: boolean): string {
	if (!pezzi.length) return '';
	const inizio = pezzi[0].p[0];
	let s = `M ${n4(inizio[0])} ${n4(inizio[1])}`;
	for (const p of pezzi) {
		if (p.tipo === 'L') s += ` L ${n4(p.p[1][0])} ${n4(p.p[1][1])}`;
		else s += ` C ${n4(p.p[1][0])} ${n4(p.p[1][1])} ${n4(p.p[2][0])} ${n4(p.p[2][1])} ${n4(p.p[3][0])} ${n4(p.p[3][1])}`;
	}
	return s + (chiusa ? ' Z' : '');
}
