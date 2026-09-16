/**
 * Kit di adesivi: bustina trasparente con cavallotto personalizzato e fino a 6 adesivi
 * personalizzati diversi, tutti dello stesso materiale e della stessa misura.
 *
 * Listino del kit (deciso con Mattia il 16/9/2026): prezzo per kit a scaglioni di quantita',
 * riferito al kit "tipo" (6 adesivi da 50 mm, vinile bianco, senza lamina), IVA inclusa:
 *   10 kit → 8,90 · 50 → 6,50 · 100 → 5,50 · 250 → 4,50 · 500 → 3,80 · 1000 → 3,20
 * Il prezzo si divide in una parte fissa (bustina, cavallotto stampato, confezionamento, avvio)
 * e una parte "adesivi" (KIT_STICKER_SHARE), che cambia con il numero di adesivi, la misura
 * (in proporzione all'area, smorzata), il materiale e la lamina.
 * Il listino adesivi_personalizzati non entra piu' nel calcolo: `cfg` serve solo per l'IVA.
 */
import type { EngineConfig } from './engine';

export const KIT_QTY = [10, 50, 100, 250, 500, 1000];
export const KIT_SIZES = [40, 50, 60, 80]; // lato lungo dell'adesivo, in mm
export const KIT_MAX = 6;
/** prezzo per kit IVA INCLUSA del kit tipo (6 adesivi da 50 mm, bianco, senza lamina) */
export const KIT_BASE_GROSS: [number, number][] = [[10, 8.9], [50, 6.5], [100, 5.5], [250, 4.5], [500, 3.8], [1000, 3.2]];
/** quota del prezzo che dipende dagli adesivi (il resto e' bustina, cavallotto, confezionamento, avvio) */
export const KIT_STICKER_SHARE = 0.55;
/** maggiorazione della quota adesivi per materiale e lamina */
export const KIT_MATERIAL_FACTOR: Record<string, number> = { bianco: 1, trasparente: 1, super: 1.05, oro: 1.1, argento: 1.15, olografico: 1.15, glitterato: 1.15 };
export const KIT_LAMINATE_FACTOR = 1.1;
/** costi vivi per kit, netti (solo per i controlli di margine in dashboard): bustina, cavallotto stampato, confezionamento a mano */
export const KIT_EXTRA_NET = { bustina: 0.18, cavallotto: 0.32, confezionamento: 0.25 };

export interface KitQuote { n: number; qty: number; perKitNet: number; perKitGross: number; net: number; gross: number; stickerNet: number; extraNet: number }

/** prezzo base lordo per kit alla quantita' richiesta (tra due scaglioni si interpola sul logaritmo della quantita') */
export function kitBaseGross(qty: number): number {
	const t = KIT_BASE_GROSS;
	if (qty <= t[0][0]) return t[0][1];
	if (qty >= t[t.length - 1][0]) return t[t.length - 1][1];
	for (let i = 1; i < t.length; i++) {
		if (qty <= t[i][0]) {
			const [q0, p0] = t[i - 1], [q1, p1] = t[i];
			const k = (Math.log(qty) - Math.log(q0)) / (Math.log(q1) - Math.log(q0));
			return p0 + (p1 - p0) * k;
		}
	}
	return t[t.length - 1][1];
}

export function kitQuote(cfg: EngineConfig, o: { materiale: string; finitura: string; misura: number; n: number; qty: number }): KitQuote {
	const n = Math.max(0, Math.min(KIT_MAX, Math.round(o.n)));
	const qty = Math.max(1, Math.round(o.qty));
	const vat = cfg?.vat || 1.22;
	const base = kitBaseGross(qty);
	/* area rispetto al kit tipo (50×40 mm), smorzata: un adesivo da 80 mm non costa 2,5 volte uno da 50 */
	const area = (o.misura * Math.round(o.misura * 0.8)) / (50 * 40);
	const sizeF = Math.pow(Math.max(0.2, area), 0.6);
	const matF = KIT_MATERIAL_FACTOR[o.materiale] ?? 1;
	const lamF = cfg?.finishes?.find((f) => f.id === o.finitura)?.laminate ? KIT_LAMINATE_FACTOR : 1;
	const fixedGross = base * (1 - KIT_STICKER_SHARE);
	const stickerGross = base * KIT_STICKER_SHARE * (n / KIT_MAX) * sizeF * matF * lamF;
	const perKitGross = r2(fixedGross + stickerGross);
	const perKitNet = r2(perKitGross / vat);
	const net = r2(perKitNet * qty);
	return { n, qty, perKitNet, perKitGross, net, gross: r2(net * vat), stickerNet: r2(stickerGross / vat), extraNet: r2(fixedGross / vat) };
}

/** numero di adesivi codificato nella "forma" della riga d'ordine (kit3, kit6…) */
export const kitN = (forma: string) => Math.max(1, Math.min(KIT_MAX, Number(String(forma).replace(/\D/g, '')) || 1));

const r2 = (v: number) => Math.round(v * 100) / 100;
