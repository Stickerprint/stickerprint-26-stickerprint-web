/**
 * Stickerprint Studio — i design del motore sul foglio composto (fogli di adesivi).
 *
 * La grafica di stampa del motore e' il pezzo con attorno la sua ABBONDANZA: la sagoma di taglio
 * allargata di `bleed` mm, con raccordo tondo, dove i colori del bordo del disegno continuano verso
 * l'esterno. Fino al 29/10/2026 sul foglio si metteva solo il riquadro del taglio: l'abbondanza
 * restava, ma tagliata piatta ai quattro lati del riquadro, e sui design scuri si vedeva che non
 * seguiva la forma. Qui si mette tutta la grafica, abbondanza compresa, con due regole:
 *
 * 1. fuori dal tracciato il BIANCO si toglie: il bianco non si stampa (resta il materiale) e su un
 *    foglio colorato lascerebbe un alone vuoto attorno all'adesivo. L'abbondanza c'e' solo dove serve,
 *    cioe' dove il design arriva al taglio con un colore;
 * 2. si disegnano prima tutte le abbondanze e poi, sopra, il disegno dentro il tracciato di ogni
 *    adesivo: l'abbondanza di uno non copre mai il vicino.
 */

/** una grafica stampata dal motore (misure in mm nel sistema del motore, immagine in pixel) */
export interface StampaDesign {
	img: HTMLImageElement | HTMLCanvasElement;
	cutW: number;
	cutH: number;
	bleed: number;
	/** tracciato di taglio in mm, origine nell'angolo del riquadro del taglio */
	pathD: string;
}

/** sopra questa soglia (su tutti e tre i canali) un pixel dell'abbondanza vale come bianco */
export const BIANCO_DA = 245;

/**
 * La grafica con l'abbondanza pulita: fuori dal tracciato i pixel bianchi diventano trasparenti,
 * dentro resta tutto com'e'. Senza abbondanza torna l'immagine originale.
 */
export function graficaConAbbondanza(st: StampaDesign): HTMLImageElement | HTMLCanvasElement {
	if (!(st.bleed > 0) || !st.pathD) return st.img;
	const W = st.img.width, H = st.img.height;
	if (!(W > 0 && H > 0)) return st.img;
	const k = W / (st.cutW + 2 * st.bleed); // pixel per mm
	const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
	const g = cv.getContext('2d', { willReadFrequently: true });
	if (!g) return st.img;
	g.drawImage(st.img, 0, 0);
	/* maschera dell'interno: il tracciato riempito, nello spazio dei pixel della grafica */
	const mk = document.createElement('canvas'); mk.width = W; mk.height = H;
	const gm = mk.getContext('2d', { willReadFrequently: true });
	if (!gm) return st.img;
	gm.setTransform(k, 0, 0, k, st.bleed * k, st.bleed * k);
	gm.fillStyle = '#000';
	gm.fill(new Path2D(st.pathD), 'evenodd');
	const dentro = gm.getImageData(0, 0, W, H).data;
	const id = g.getImageData(0, 0, W, H), d = id.data;
	for (let i = 0, p = 0; i < W * H; i++, p += 4) {
		if (dentro[p + 3] >= 128 || d[p + 3] === 0) continue;
		if (d[p] >= BIANCO_DA && d[p + 1] >= BIANCO_DA && d[p + 2] >= BIANCO_DA) d[p + 3] = 0;
	}
	g.putImageData(id, 0, 0);
	return cv;
}

/** riquadro di destinazione della grafica intera (abbondanza compresa), in mm, centrato nel pezzo scalato di `z` */
export function riquadroGrafica(st: StampaDesign, z: number) {
	const b = st.bleed * z;
	return { x: -(st.cutW * z) / 2 - b, y: -(st.cutH * z) / 2 - b, w: st.cutW * z + 2 * b, h: st.cutH * z + 2 * b };
}

/**
 * Disegna un design sul foglio. `ctx` e' gia' posizionato: origine nel centro del pezzo, ruotato,
 * in PIXEL del foglio (`ppm` pixel per mm). `z` e' la scala dalla misura del motore a quella ordinata.
 * `cosa`: 'tutto' = grafica intera con l'abbondanza (primo passaggio, o maschera del passante);
 *         'dentro' = solo il disegno dentro il tracciato (secondo passaggio, sopra le abbondanze dei vicini).
 */
export function disegnaDesign(ctx: CanvasRenderingContext2D, img: HTMLImageElement | HTMLCanvasElement, st: StampaDesign, z: number, ppm: number, cosa: 'tutto' | 'dentro') {
	const r = riquadroGrafica(st, z);
	ctx.save();
	if (cosa === 'dentro' && st.pathD) {
		/* il tracciato e' in mm del motore: si ritaglia con quella trasformazione e poi si torna
		   ai pixel del foglio (un restore() toglierebbe anche il ritaglio) */
		const m = ctx.getTransform();
		ctx.scale(ppm * z, ppm * z);
		ctx.translate(-st.cutW / 2, -st.cutH / 2);
		ctx.clip(new Path2D(st.pathD), 'evenodd');
		ctx.setTransform(m);
	}
	ctx.drawImage(img, r.x * ppm, r.y * ppm, r.w * ppm, r.h * ppm);
	ctx.restore();
}
