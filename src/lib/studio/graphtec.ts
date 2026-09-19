/**
 * Stickerprint Studio — crocini, codice a barre e file di taglio per i Graphtec FC9000
 * (Data Link Server di Cutting Master 5).
 *
 * Tutto ricavato dai file dell'azienda (18/9/2026):
 * - EPS preparati da Cutting Master in Illustrator (LORENCIC, VIBESESOUND) per crocini e codici;
 * - file di taglio .xpf nella cartella di Data Link Server per il formato del taglio.
 *
 * Striscia (coordinate pagina in mm, y verso il BASSO come nel resto dello studio):
 * - crocini a L, spessore 1 mm, bracci 20,5 mm, bordo esterno a 14,5 mm dal bordo alto/basso
 *   e sul bordo sinistro/destro della pagina;
 * - codice a barre Code 39 alto 9 mm sul bordo: in alto a destra quello "F" (dritto), in basso a
 *   sinistra quello "R" (girato di 180 gradi), ognuno con una barra nera piena di 50 mm;
 * - contenuto "G1200" + codice del lavoro (4 cifre esadecimali) + F/R + cifra di controllo mod 43.
 * File di taglio (.xpf): intestazione con il codice del lavoro, miniatura RGB, comandi GP-GL in
 * decimi di mm con origine sull'angolo (linea centrale) del crocino in basso a sinistra, asse X lungo
 * l'altezza della pagina (verso l'alto) e asse Y lungo la larghezza.
 */
import type { Placement, Strip } from './layout';
import { parsePath } from './path';

/* ------------------------------------------------------------------ misure */

export const MARK = {
	/** bordo esterno del crocino dal bordo alto e basso della pagina */
	edge: 14.5,
	/** spessore del tratto */
	thick: 1,
	/** lunghezza dei bracci (esterna) */
	arm: 20.5,
	/** altezza del codice a barre (sul bordo della pagina) */
	barH: 9,
	/** barra nera piena accanto al codice */
	blockW: 50,
	/** spazio fra barra nera e codice */
	blockGap: 7,
	narrow: 0.4,
	wide: 1.0
};

/** margini del contenuto dentro la striscia con i crocini (fuori dai bracci, con 5-6 mm di aria) */
export const MARKED_MARGIN = { x: MARK.thick / 2 + MARK.arm + 5.5, y: MARK.edge + MARK.thick / 2 + 5 };

/** la pagina con i crocini e' un po' piu' stretta della bobina (come in Cutting Master: 688 su 70 cm) */
export const pageWidthFor = (rollWidth: number) => rollWidth - 12;

/** condizioni del plotter: 1 = mezzo taglio, 3 = passante (come nei lavori di Cutting Master) */
export const DEFAULT_COND = { half: 1, through: 3 };

/* ------------------------------------------------------------------ codice */

const C39: Record<string, string> = {
	'0': 'nnnwwnwnn', '1': 'wnnwnnnnw', '2': 'nnwwnnnnw', '3': 'wnwwnnnnn', '4': 'nnnwwnnnw', '5': 'wnnwwnnnn', '6': 'nnwwwnnnn', '7': 'nnnwnnwnw', '8': 'wnnwnnwnn', '9': 'nnwwnnwnn',
	A: 'wnnnnwnnw', B: 'nnwnnwnnw', C: 'wnwnnwnnn', D: 'nnnnwwnnw', E: 'wnnnwwnnn', F: 'nnwnwwnnn', G: 'nnnnnwwnw', H: 'wnnnnwwnn', I: 'nnwnnwwnn', J: 'nnnnwwwnn',
	K: 'wnnnnnnww', L: 'nnwnnnnww', M: 'wnwnnnnwn', N: 'nnnnwnnww', O: 'wnnnwnnwn', P: 'nnwnwnnwn', Q: 'nnnnnnwww', R: 'wnnnnnwwn', S: 'nnwnnnwwn', T: 'nnnnwnwwn',
	U: 'wwnnnnnnw', V: 'nwwnnnnnw', W: 'wwwnnnnnn', X: 'nwnnwnnnw', Y: 'wwnnwnnnn', Z: 'nwwnwnnnn', '-': 'nwnnnnwnw', '.': 'wwnnnnwnn', ' ': 'nwwnnnwnn', '*': 'nwnnwnwnn',
	$: 'nwnwnwnnn', '/': 'nwnwnnnwn', '+': 'nwnnnwnwn', '%': 'nnnwnwnwn'
};
const C39_VAL = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ-. $/+%';

/** cifra di controllo Code 39 (modulo 43) */
export function code39Check(s: string): string {
	let sum = 0;
	for (const ch of s) sum += C39_VAL.indexOf(ch);
	return C39_VAL[sum % 43];
}

/** barre del codice (x e larghezza in mm dall'inizio), con start/stop e cifra di controllo */
export function code39Bars(data: string): { bars: { x: number; w: number }[]; length: number } {
	const full = `*${data}${code39Check(data)}*`;
	const bars: { x: number; w: number }[] = [];
	let x = 0;
	for (let c = 0; c < full.length; c++) {
		const pat = C39[full[c]];
		if (!pat) throw new Error(`Carattere non valido nel codice a barre: ${full[c]}`);
		for (let i = 0; i < 9; i++) {
			const w = pat[i] === 'w' ? MARK.wide : MARK.narrow;
			if (i % 2 === 0) bars.push({ x, w });
			x += w;
		}
		if (c < full.length - 1) x += MARK.narrow; // spazio fra i caratteri
	}
	return { bars, length: x };
}

/** codice del lavoro: "G1200" + 4 cifre esadecimali, diverso da quelli gia' presenti */
export function newJobId(taken: Set<string> = new Set()): string {
	for (let k = 0; k < 1000; k++) {
		const n = Math.floor(Math.random() * 0x10000);
		const id = 'G1200' + n.toString(16).toUpperCase().padStart(4, '0');
		if (!taken.has(id)) return id;
	}
	throw new Error('Nessun codice libero');
}

/* ------------------------------------------------------------------ disegno della striscia */

export interface Rect { x: number; y: number; w: number; h: number }

/** crocini (4 L, ognuna come due rettangoli pieni), in coordinate pagina (mm, y verso il basso) */
export function markRects(W: number, H: number): Rect[] {
	const t = MARK.thick, a = MARK.arm, e = MARK.edge;
	const top = e, bottom = H - e;
	return [
		// in alto a sinistra
		{ x: 0, y: top, w: a, h: t }, { x: 0, y: top, w: t, h: a },
		// in alto a destra
		{ x: W - a, y: top, w: a, h: t }, { x: W - t, y: top, w: t, h: a },
		// in basso a sinistra
		{ x: 0, y: bottom - t, w: a, h: t }, { x: 0, y: bottom - a, w: t, h: a },
		// in basso a destra
		{ x: W - a, y: bottom - t, w: a, h: t }, { x: W - t, y: bottom - a, w: t, h: a }
	];
}

/** codici a barre e barre nere; il testo leggibile accanto a ognuno */
export function barcodeRects(W: number, H: number, id: string): { rects: Rect[]; labels: { text: string; x: number; y: number; rot180: boolean }[] } {
	const rects: Rect[] = [];
	const hB = MARK.barH;
	// in alto a destra: "F", dritto, barra nera sul bordo destro
	const f = code39Bars(`${id}F`);
	const fx0 = W - MARK.blockW - MARK.blockGap - f.length;
	for (const b of f.bars) rects.push({ x: fx0 + b.x, y: 0, w: b.w, h: hB });
	rects.push({ x: W - MARK.blockW, y: 0, w: MARK.blockW, h: hB });
	// in basso a sinistra: "R", girato di 180 gradi, barra nera sul bordo sinistro
	const r = code39Bars(`${id}R`);
	const rx1 = MARK.blockW + MARK.blockGap + r.length; // il codice si legge da destra verso sinistra
	for (const b of r.bars) rects.push({ x: rx1 - b.x - b.w, y: H - hB, w: b.w, h: hB });
	rects.push({ x: 0, y: H - hB, w: MARK.blockW, h: hB });
	return {
		rects,
		labels: [
			{ text: `${id}-F`, x: fx0 - 3, y: hB / 2, rot180: false },
			{ text: `${id}-R`, x: rx1 + 3, y: H - hB / 2, rot180: true }
		]
	};
}

/* ------------------------------------------------------------------ file di taglio .xpf */

export interface XpfJob {
	id: string;
	/** pagina della striscia (mm) */
	W: number;
	H: number;
	/** tracciato del pezzo (mm, origine nell'angolo del taglio) */
	pathD: string;
	cutW: number;
	cutH: number;
	pieces: Placement[];
	sheets?: Strip['sheets'];
	/** condizione del plotter per i pezzi (1 mezzo taglio, 3 passante) */
	pieceCond: number | null;
	/** condizione per il bordo dei fogli */
	sheetCond?: number | null;
	/** avanzamento dopo il taglio (mm) */
	feed?: number;
}

const enc = new TextEncoder();

/** comandi GP-GL, ognuno chiuso da ETX (0x03) */
export function xpfCommands(j: XpfJob): string {
	const e = MARK.edge + MARK.thick / 2, cx = MARK.thick / 2;
	// dalla pagina (mm, y in basso) al plotter (0,1 mm, origine sul crocino in basso a sinistra)
	const P = (x: number, y: number) => `${Math.round((j.H - y - e) * 10)},${Math.round((x - cx) * 10)}`;
	const distX = Math.floor((j.H - 2 * e) * 10 + 1e-6), distY = Math.floor((j.W - 2 * cx) * 10 + 1e-6);
	const out: string[] = ['\x1b.v:TC1007,4,20', 'TB99', 'TB57,1,1', 'TB59,1,1', 'TB50,0', 'TB51,200', 'TB52,2', 'TB54,0,0', 'TB55,1', 'TB44,0,0,0', `TB24,${distX},${distY}`, 'TB99'];
	const segs = parsePath(j.pathD);
	const tf = (p: Placement, x: number, y: number): [number, number] => (p.rot ? [p.x + j.cutH - y, p.y + x] : [p.x + x, p.y + y]);
	let first = true;
	if (j.pieceCond) {
		out.push(`&100,100,100,^0,0,\\0,0,J${j.pieceCond}`, 'L0,B0');
		first = false;
		for (const p of j.pieces) {
			let cur: [number, number] = [0, 0], start: [number, number] = [0, 0];
			for (const s of segs) {
				if (s[0] === 'M') { cur = start = tf(p, s[1], s[2]); out.push(`M${P(...cur)}`); }
				else if (s[0] === 'L') { cur = tf(p, s[1], s[2]); out.push(`D${P(...cur)}`); }
				else if (s[0] === 'C') {
					const a = tf(p, s[1], s[2]), b = tf(p, s[3], s[4]), c = tf(p, s[5], s[6]);
					out.push(`BZ1,${P(...cur)},${P(...a)},${P(...b)},${P(...c)},`);
					cur = c;
				} else if (cur[0] !== start[0] || cur[1] !== start[1]) { out.push(`D${P(...start)}`); cur = start; }
			}
		}
	}
	if (j.sheetCond && j.sheets?.length) {
		out.push(first ? `&100,100,100,^0,0,\\0,0,J${j.sheetCond}` : `J${j.sheetCond}`, 'L0,B0');
		for (const s of j.sheets) {
			out.push(`M${P(s.x, s.y + s.h)}`, `D${P(s.x, s.y)}`, `D${P(s.x + s.w, s.y)}`, `D${P(s.x + s.w, s.y + s.h)}`, `D${P(s.x, s.y + s.h)}`);
		}
	}
	out.push('TB0', `M${distX + Math.round((j.feed ?? 42) * 10)},0`, 'SO0', 'M0,0');
	return out.map((c) => c + '\x03').join('');
}

/* colori della miniatura (quelli di Cutting Master): mezzo taglio viola, passante verde */
const THUMB_COL: Record<number, [number, number, number]> = { 1: [0x90, 0x2e, 0xea], 3: [0x53, 0xbb, 0x5e] };

/** miniatura RGB (larga 256 px, alta in proporzione, orientata come la striscia) con i tracciati */
function thumbnail(j: XpfJob, tw: number, th: number): Uint8Array {
	const px = new Uint8Array(tw * th * 3).fill(0xff);
	const sx = tw / j.W, sy = th / j.H;
	const dot = (x: number, y: number, c: [number, number, number]) => {
		const X = Math.round(x * sx), Y = Math.round(y * sy);
		if (X < 0 || Y < 0 || X >= tw || Y >= th) return;
		const i = (Y * tw + X) * 3;
		px[i] = c[0]; px[i + 1] = c[1]; px[i + 2] = c[2];
	};
	const line = (a: [number, number], b: [number, number], c: [number, number, number]) => {
		const n = Math.max(1, Math.ceil(Math.hypot((b[0] - a[0]) * sx, (b[1] - a[1]) * sy) * 2));
		for (let k = 0; k <= n; k++) dot(a[0] + ((b[0] - a[0]) * k) / n, a[1] + ((b[1] - a[1]) * k) / n, c);
	};
	const colOf = (cond: number) => THUMB_COL[cond] ?? [0x40, 0x40, 0x40];
	if (j.pieceCond) {
		const c = colOf(j.pieceCond), segs = parsePath(j.pathD);
		const tf = (p: Placement, x: number, y: number): [number, number] => (p.rot ? [p.x + j.cutH - y, p.y + x] : [p.x + x, p.y + y]);
		for (const p of j.pieces) {
			let cur: [number, number] = [0, 0], start: [number, number] = [0, 0];
			for (const s of segs) {
				if (s[0] === 'M') cur = start = tf(p, s[1], s[2]);
				else if (s[0] === 'L') { const b = tf(p, s[1], s[2]); line(cur, b, c); cur = b; }
				else if (s[0] === 'C') {
					const p0 = cur, p1 = tf(p, s[1], s[2]), p2 = tf(p, s[3], s[4]), p3 = tf(p, s[5], s[6]);
					let prev = p0;
					for (let k = 1; k <= 8; k++) {
						const t = k / 8, u = 1 - t;
						const q: [number, number] = [u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0], u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1]];
						line(prev, q, c); prev = q;
					}
					cur = p3;
				} else { line(cur, start, c); cur = start; }
			}
		}
	}
	if (j.sheetCond && j.sheets?.length) {
		const c = colOf(j.sheetCond);
		for (const r of j.sheets) {
			line([r.x, r.y], [r.x + r.w, r.y], c); line([r.x + r.w, r.y], [r.x + r.w, r.y + r.h], c);
			line([r.x + r.w, r.y + r.h], [r.x, r.y + r.h], c); line([r.x, r.y + r.h], [r.x, r.y], c);
		}
	}
	return px;
}

/** file .xpf completo (intestazione Cutting Master 5 / FC9000, miniatura, comandi) */
export function buildXpf(j: XpfJob): Uint8Array {
	const cmd = enc.encode(xpfCommands(j));
	// miniatura: 256 px di larghezza (lungo la striscia) e altezza in proporzione, RGB, righe da 768 byte
	const thumbW = 256;
	const thumbH = Math.max(16, Math.min(1024, Math.round((thumbW * j.H) / j.W)));
	const thumbData = thumbW * thumbH * 3;
	const cmdOffset = 256 + 128 + thumbData;
	const out = new Uint8Array(cmdOffset + 128 + cmd.length);
	const dv = new DataView(out.buffer);
	// intestazione (256 byte)
	out[0] = 0x89;
	out.set(enc.encode('GRAPHTEC XPF\r\n'), 1);
	dv.setUint32(16, 0x00010000, true);
	out.set(enc.encode('CM5'), 20);
	out.set(enc.encode('FC9000'), 36);
	dv.setInt32(52, 60, true);
	dv.setInt32(56, -399, true);
	out.set(enc.encode(j.id), 60);
	dv.setUint32(76, 256, true);
	dv.setUint32(80, cmdOffset, true);
	dv.setInt32(96, -60, true);
	dv.setInt32(100, 399, true);
	// miniatura: intestazione 128 byte (come Cutting Master: altezza*3 a +19, larghezza, altezza, riga) + pixel
	out.set(enc.encode('THUMBNAIL_PART'), 256);
	dv.setUint16(256 + 19, thumbH * 3, true);
	dv.setUint32(256 + 24, thumbW, true);
	dv.setUint32(256 + 28, thumbH, true);
	dv.setUint32(256 + 32, thumbW * 3, true);
	out.set(thumbnail(j, thumbW, thumbH), 384);
	// comandi
	out.set(enc.encode('COMMAND_PART\r\n'), cmdOffset);
	dv.setUint32(cmdOffset + 20, cmd.length, true);
	out.set(cmd, cmdOffset + 128);
	return out;
}

/** codice del lavoro scritto in un .xpf esistente (per non riusarlo) */
export function xpfJobId(head: Uint8Array): string | null {
	if (head.length < 76) return null;
	const s = new TextDecoder('latin1').decode(head.subarray(60, 76)).replace(/\0.*$/, '');
	return /^G1200[0-9A-F]{4}$/.test(s) ? s : null;
}
