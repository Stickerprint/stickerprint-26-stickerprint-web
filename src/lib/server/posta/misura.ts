/**
 * Misura dei soggetti dentro un allegato, come nello Studio: prima il tracciato di taglio del PDF
 * (readyPdf), poi, se non c'e', l'ingombro della grafica sull'immagine resa (componenti connesse).
 */
import { analyzeReadyPdf, NeedChoice, type CutCandidate } from '$lib/studio/readyPdf';
import { parsePath } from '$lib/studio/path';
import { rendiPdf } from './mockup';

const MM = 25.4 / 72;
export interface Soggetto { w: number; h: number; /** riquadro sulla pagina in pt, y verso l'alto */ boxPt: [number, number, number, number] }
export interface Misurato { soggetti: Soggetto[]; fonte: 'tracciato' | 'ingombro'; pageMm: [number, number]; nota: string | null }

/** fra piu' candidati: via la cornice grande quanto la pagina, poi il tratto piu' sottile (il bordo grafico e' piu' spesso) */
function scegli(c: CutCandidate[], pageMm: [number, number] | null): CutCandidate | null {
	const utili = c.filter((x) => !(pageMm && x.wMm > pageMm[0] * 0.9 && x.hMm > pageMm[1] * 0.9));
	const pool = utili.length ? utili : c;
	if (!pool.length) return null;
	return [...pool].sort((a, b) => a.widthPt - b.widthPt || b.wMm * b.hMm - a.wMm * a.hMm)[0];
}

/** riquadri dei tracciati chiusi (uno per soggetto); quelli dentro un altro sono fori e si scartano */
function riquadri(pathD: string): { x0: number; y0: number; x1: number; y1: number }[] {
	const out: { x0: number; y0: number; x1: number; y1: number }[] = [];
	let cur: { x0: number; y0: number; x1: number; y1: number } | null = null;
	const punto = (x: number, y: number) => { if (!cur) cur = { x0: x, y0: y, x1: x, y1: y }; else { cur.x0 = Math.min(cur.x0, x); cur.y0 = Math.min(cur.y0, y); cur.x1 = Math.max(cur.x1, x); cur.y1 = Math.max(cur.y1, y); } };
	let px = 0, py = 0;
	for (const s of parsePath(pathD)) {
		if (s[0] === 'M') { if (cur) out.push(cur); cur = null; punto(s[1], s[2]); px = s[1]; py = s[2]; }
		else if (s[0] === 'L') { punto(s[1], s[2]); px = s[1]; py = s[2]; }
		else if (s[0] === 'C') {
			// la curva, non i punti di controllo (che sporgono): si campiona
			for (let t = 0.1; t <= 1.0001; t += 0.1) { const u = 1 - t; punto(u * u * u * px + 3 * u * u * t * s[1] + 3 * u * t * t * s[3] + t * t * t * s[5], u * u * u * py + 3 * u * u * t * s[2] + 3 * u * t * t * s[4] + t * t * t * s[6]); }
			px = s[5]; py = s[6];
		}
	}
	if (cur) out.push(cur);
	const dentro = (a: typeof out[number], b: typeof out[number]) => a !== b && a.x0 >= b.x0 - 0.3 && a.y0 >= b.y0 - 0.3 && a.x1 <= b.x1 + 0.3 && a.y1 <= b.y1 + 0.3;
	return out.filter((a) => a.x1 - a.x0 > 2 && a.y1 - a.y0 > 2 && !out.some((b) => dentro(a, b)));
}

export async function misuraPdf(bytes: Uint8Array): Promise<Misurato> {
	let nota: string | null = null;
	try {
		let r;
		try { r = await analyzeReadyPdf(bytes); }
		catch (e) {
			if (!(e instanceof NeedChoice) || !e.candidates.length) throw e;
			const c = scegli(e.candidates, null);
			if (!c) throw e;
			nota = e.candidates.length === 1 ? `tracciato: unico tratto chiuso (${c.label})` : `tracciato scelto fra ${e.candidates.length} candidati: ${c.label}, tratto da ${c.widthPt} pt`;
			r = await analyzeReadyPdf(bytes, c.key);
		}
		// pathD: origine nell'angolo in alto a sinistra del taglio, mm, y verso il basso; bboxPt sulla pagina (y verso l'alto)
		const box = riquadri(r.pathD);
		const [bx0, , , by1] = r.bboxPt;
		const soggetti: Soggetto[] = (box.length ? box : [{ x0: 0, y0: 0, x1: r.cutW, y1: r.cutH }]).map((b) => ({ w: Math.round((b.x1 - b.x0) * 10) / 10, h: Math.round((b.y1 - b.y0) * 10) / 10, boxPt: [bx0 + b.x0 / MM, by1 - b.y1 / MM, bx0 + b.x1 / MM, by1 - b.y0 / MM] }));
		return { soggetti, fonte: 'tracciato', pageMm: r.pageMm, nota: nota ?? r.reason };
	} catch (e) {
		nota = `nessun tracciato di taglio (${(e as Error).message.slice(0, 80)}): misura dall'ingombro della grafica`;
	}
	return { ...(await ingombro(bytes)), nota };
}

/** ingombro della grafica: componenti connesse dei pixel non bianchi sulla pagina resa, tenute quelle >= 8% della piu' grande */
async function ingombro(bytes: Uint8Array): Promise<Omit<Misurato, 'nota'>> {
	const r = await rendiPdf(bytes, 900);
	const { width: W, height: H, data } = r.ctx.getImageData(0, 0, r.canvas.width, r.canvas.height);
	const mask = new Uint8Array(W * H);
	for (let i = 0; i < W * H; i++) { const a = data[i * 4 + 3]; mask[i] = a > 30 && (data[i * 4] < 235 || data[i * 4 + 1] < 235 || data[i * 4 + 2] < 235) ? 1 : 0; }
	const seen = new Uint8Array(W * H);
	const comp: { x0: number; y0: number; x1: number; y1: number; n: number }[] = [];
	const stack: number[] = [];
	for (let s = 0; s < W * H; s++) {
		if (!mask[s] || seen[s]) continue;
		const c = { x0: W, y0: H, x1: 0, y1: 0, n: 0 };
		stack.push(s); seen[s] = 1;
		while (stack.length) {
			const p = stack.pop()!; const x = p % W, y = (p - x) / W;
			c.n++; c.x0 = Math.min(c.x0, x); c.x1 = Math.max(c.x1, x); c.y0 = Math.min(c.y0, y); c.y1 = Math.max(c.y1, y);
			for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) {
				const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
				const q = ny * W + nx; if (mask[q] && !seen[q]) { seen[q] = 1; stack.push(q); }
			}
		}
		comp.push(c);
	}
	const max = Math.max(1, ...comp.map((c) => c.n));
	const buone = comp.filter((c) => c.n >= max * 0.08).sort((a, b) => a.y0 - b.y0 || a.x0 - b.x0);
	const pxMm = r.pageMm[0] / W;
	const soggetti: Soggetto[] = buone.map((c) => ({ w: Math.round((c.x1 - c.x0 + 1) * pxMm * 10) / 10, h: Math.round((c.y1 - c.y0 + 1) * pxMm * 10) / 10, boxPt: [c.x0 / r.scale, (H - 1 - c.y1) / r.scale, (c.x1 + 1) / r.scale, (H - c.y0) / r.scale] }));
	return { soggetti, fonte: 'ingombro', pageMm: r.pageMm };
}
