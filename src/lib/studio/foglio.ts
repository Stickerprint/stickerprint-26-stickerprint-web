/**
 * Stickerprint Studio — il foglio di adesivi composto dal cliente sul sito (SheetBuilder).
 * Nell'ordine c'e' una cartella con `foglio.png` (il foglio stampabile a FOGLIO_PPM px/mm,
 * trasparente fuori dal foglio) e `layout.json` (formato, sfondo e la posizione di ogni
 * adesivo). Da qui lo studio ricava i mezzi tagli (uno per adesivo) e il passante del foglio,
 * senza rileggere la grafica: la sagoma e' quella che il cliente ha approvato.
 */
import { matriceAdesivo, rettangoloArrotondato, scriviPath, trasformaPath } from './path';

/** pixel per millimetro di foglio.png (SheetBuilder: sheetPng(12)) */
export const FOGLIO_PPM = 12;
/** aria attorno al foglio sagomato, dove gli adesivi possono sporgere (SheetBuilder: PAD) */
export const FOGLIO_PAD = 22;
/** raggio degli angoli del foglio (SheetBuilder: r = 4 mm) */
export const FOGLIO_RAGGIO = 4;

export interface FoglioAdesivo {
	n: number;
	file?: string;
	forma: string;
	/** riquadro del taglio (mm) */
	w: number;
	h: number;
	/** centro dell'adesivo nel foglio (mm, dall'angolo del foglio) */
	x: number;
	y: number;
	/** rotazione in gradi (senso orario) */
	rot: number;
	/** tracciato del motore approvato dal cliente (mm, origine nell'angolo del riquadro); manca negli ordini vecchi */
	cut?: { pathD: string; w: number; h: number; shape?: string | null; border?: number | null } | null;
}

export interface FoglioLayout {
	sheet: {
		w: number; h: number; orientamento: string; formato: string; sagomato: boolean;
		bgColor: string; bgImage: boolean; materiale: string; finitura: string;
		pad?: number; raggio?: number; ppm?: number;
	};
	stickers: FoglioAdesivo[];
}

export interface SoggettoFoglio { pathD: string; x: number; y: number; w: number; h: number; nodi: number; stimato: boolean }

/** l'aria attorno al foglio nel PNG: c'e' solo quando il foglio e' sagomato */
export const ariaFoglio = (l: FoglioLayout) => (l.sheet.sagomato ? (l.sheet.pad ?? FOGLIO_PAD) : 0);

/** misure del PNG del foglio (mm) */
export function misureFoglio(l: FoglioLayout) {
	const a = ariaFoglio(l);
	return { w: l.sheet.w + 2 * a, h: l.sheet.h + 2 * a };
}

const nodi = (d: string) => (d.match(/[MLCmlc]/g) ?? []).length;

/** ellisse (o cerchio) in quattro curve, origine nell'angolo del riquadro */
function ellisse(w: number, h: number): string {
	const rx = w / 2, ry = h / 2, k = 0.5523, cx = rx, cy = ry;
	return scriviPath([
		['M', cx + rx, cy],
		['C', cx + rx, cy + k * ry, cx + k * rx, cy + ry, cx, cy + ry],
		['C', cx - k * rx, cy + ry, cx - rx, cy + k * ry, cx - rx, cy],
		['C', cx - rx, cy - k * ry, cx - k * rx, cy - ry, cx, cy - ry],
		['C', cx + k * rx, cy - ry, cx + rx, cy - k * ry, cx + rx, cy],
		['Z']
	]);
}

/** tracciato di un adesivo nel suo riquadro: quello salvato dal sito; negli ordini vecchi la forma geometrica (stimata) */
export function tracciatoAdesivo(s: FoglioAdesivo): { d: string; stimato: boolean } {
	if (s.cut?.pathD) return { d: s.cut.pathD, stimato: false };
	if (s.forma === 'tondo' || s.forma === 'ovale') return { d: ellisse(s.w, s.h), stimato: true };
	/* quadrato, rettangolare e sagomato senza tracciato: il riquadro (angoli vivi come il motore) */
	return { d: rettangoloArrotondato(s.w, s.h, 0), stimato: s.forma === 'sagomato' };
}

/**
 * Gli adesivi del foglio come soggetti dello studio: tracciati assoluti (mm) nel riquadro del PNG,
 * aria compresa, gia' ruotati e messi al loro posto. `rifinisci` e' la rifinitura dello studio
 * (poche curve) per i tracciati sagomati del motore; le forme geometriche restano com'e'.
 */
export function soggettiDelFoglio(l: FoglioLayout, rifinisci?: (d: string, border: number) => string): SoggettoFoglio[] {
	const a = ariaFoglio(l);
	return l.stickers.map((s) => {
		const t = tracciatoAdesivo(s);
		let d = t.d;
		if (!t.stimato && rifinisci && (s.cut?.shape ?? 'diecut') === 'diecut') d = rifinisci(d, s.cut?.border ?? 1) || d;
		const w = s.cut?.w ?? s.w, h = s.cut?.h ?? s.h;
		const abs = trasformaPath(d, matriceAdesivo(a + s.x, a + s.y, w, h, s.rot || 0));
		return { pathD: abs, x: 0, y: 0, w, h, nodi: nodi(abs), stimato: t.stimato };
	});
}

/** bordo del foglio NON sagomato: rettangolo con gli angoli tondi, come lo disegna il sito */
export const bordoFoglio = (l: FoglioLayout) => rettangoloArrotondato(l.sheet.w, l.sheet.h, l.sheet.raggio ?? FOGLIO_RAGGIO);

/** riassunto per l'operatore */
export function descriviFoglio(l: FoglioLayout): string {
	const s = l.sheet;
	const sfondo = s.bgImage ? 'sfondo immagine' : s.bgColor && s.bgColor.toLowerCase() !== '#ffffff' ? `sfondo ${s.bgColor}` : 'sfondo bianco';
	return `${s.w}×${s.h} mm ${s.orientamento}${s.sagomato ? ', sagomato (gli adesivi sporgono)' : ''} · ${l.stickers.length} ${l.stickers.length === 1 ? 'adesivo' : 'adesivi'} · ${sfondo}`;
}
