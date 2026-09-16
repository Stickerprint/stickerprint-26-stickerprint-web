/**
 * Texture dei materiali (oro, argento, olografico, glitter): stesso disegno del motore preprint,
 * portato sul sito per lo sfondo dei fogli di adesivi. Un colore stampato sopra non copre il materiale:
 * l'effetto si vede attraverso (moltiplicazione), come sul foglio stampato.
 */
export type MatKind = 'white' | 'gold' | 'silver' | 'holo' | 'glitter' | 'clear';
export const MAT_KIND: Record<string, MatKind> = { bianco: 'white', super: 'white', oro: 'gold', argento: 'silver', olografico: 'holo', glitterato: 'glitter', glitter: 'glitter', trasparente: 'clear' };
export const matKindOf = (id: string): MatKind => MAT_KIND[id] ?? 'white';

function seeded(s: number) { return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
const cache = new Map<string, HTMLCanvasElement>();
export function materialCanvas(kind: MatKind, W: number, H: number): HTMLCanvasElement | null {
	if (typeof document === 'undefined' || kind === 'white' || kind === 'clear') return null;
	const key = `${kind}|${W}|${H}`;
	const hit = cache.get(key); if (hit) return hit;
	const c = document.createElement('canvas'); c.width = W; c.height = H;
	const g = c.getContext('2d'); if (!g) return null;
	const D = Math.hypot(W, H);
	if (kind === 'gold' || kind === 'silver') {
		const st: [number, string][] = kind === 'gold'
			? [[0, '#6d4a10'], [0.13, '#f6df8c'], [0.26, '#b9862a'], [0.41, '#fff0b8'], [0.5, '#8a5f16'], [0.57, '#dcae45'], [0.72, '#fff6d0'], [0.86, '#a97c22'], [1, '#6a4d14']]
			: [[0, '#4b5058'], [0.13, '#eff3f7'], [0.26, '#98a1ab'], [0.41, '#ffffff'], [0.5, '#5c636c'], [0.57, '#c6cdd5'], [0.72, '#ffffff'], [0.86, '#8d949d'], [1, '#666d76']];
		const gr = g.createLinearGradient(0, 0, W * 0.28, H); st.forEach(([o, col]) => gr.addColorStop(o, col));
		g.fillStyle = gr; g.fillRect(0, 0, W, H);
		const sh = g.createLinearGradient(0, H, W, 0); sh.addColorStop(0, 'rgba(255,255,255,0)'); sh.addColorStop(0.42, 'rgba(255,255,255,0.30)'); sh.addColorStop(0.56, 'rgba(255,255,255,0)'); sh.addColorStop(1, 'rgba(255,255,255,0)');
		g.fillStyle = sh; g.fillRect(0, 0, W, H);
	} else if (kind === 'holo') {
		const gr = g.createLinearGradient(0, H, W, 0);
		const hu = [288, 252, 205, 162, 112, 58, 28, 338, 300];
		hu.forEach((h, i) => gr.addColorStop(i / (hu.length - 1), `hsl(${h},88%,70%)`));
		g.fillStyle = gr; g.fillRect(0, 0, W, H);
		const g2 = g.createLinearGradient(0, 0, W * 0.55, H);
		for (let i = 0; i <= 14; i++) g2.addColorStop(i / 14, i % 2 ? 'rgba(255,255,255,0.26)' : 'rgba(255,255,255,0)');
		g.fillStyle = g2; g.fillRect(0, 0, W, H);
	} else if (kind === 'glitter') {
		const gr = g.createLinearGradient(0, 0, W * 0.4, H);
		gr.addColorStop(0, '#9aa2ad'); gr.addColorStop(0.38, '#d8dde4'); gr.addColorStop(0.7, '#848c97'); gr.addColorStop(1, '#c2c9d1');
		g.fillStyle = gr; g.fillRect(0, 0, W, H);
		const rnd = seeded(20260808), n = Math.round((W * H) / 110), rs = Math.max(0.9, D / 380);
		for (let i = 0; i < n; i++) {
			const x = rnd() * W, y = rnd() * H, r = rs * (0.35 + rnd() * 1.3), v = rnd();
			g.fillStyle = v < 0.16 ? `hsla(${Math.floor(rnd() * 360)},90%,74%,0.95)` : v < 0.3 ? 'rgba(90,98,110,0.55)' : `rgba(255,255,255,${(0.65 + rnd() * 0.35).toFixed(2)})`;
			g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
		}
	}
	if (cache.size > 8) cache.delete(cache.keys().next().value as string);
	cache.set(key, c);
	return c;
}
/** Sfondo del foglio: materiale sotto, colore stampato sopra (non coprente: si moltiplica sul materiale) */
export function paintSheetBackground(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, kind: MatKind, color: string) {
	const white = /^#(fff|ffffff)$/i.test(color);
	if (kind === 'clear') {
		/* vinile trasparente: scacchiera leggera sotto, il colore stampato lascia passare la luce */
		const s = Math.max(6, Math.round(w / 40));
		for (let yy = 0; yy < h; yy += s) for (let xx = 0; xx < w; xx += s) { g.fillStyle = ((xx / s + yy / s) % 2 === 0) ? '#e9ecf2' : '#f8f9fb'; g.fillRect(x + xx, y + yy, Math.min(s, w - xx), Math.min(s, h - yy)); }
		if (!white) { g.save(); g.globalAlpha = 0.62; g.fillStyle = color; g.fillRect(x, y, w, h); g.restore(); }
		return;
	}
	const tex = materialCanvas(kind, Math.max(64, Math.round(w)), Math.max(64, Math.round(h)));
	if (!tex) { g.fillStyle = color; g.fillRect(x, y, w, h); return; }
	g.drawImage(tex, x, y, w, h);
	if (!white) { g.save(); g.globalCompositeOperation = 'multiply'; g.globalAlpha = 0.92; g.fillStyle = color; g.fillRect(x, y, w, h); g.restore(); }
}
