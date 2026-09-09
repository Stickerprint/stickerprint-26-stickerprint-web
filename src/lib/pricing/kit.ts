/**
 * Kit di adesivi: bustina trasparente con cavallotto personalizzato e fino a 6 adesivi
 * personalizzati diversi, tutti dello stesso materiale e della stessa misura.
 *
 * PREZZO PROVVISORIO (da definire con Mattia): ogni adesivo del kit costa come un adesivo
 * personalizzato sagomato di quella misura alla quantita' dei kit (listino adesivi_personalizzati),
 * piu' un costo fisso per kit per bustina, cavallotto stampato e confezionamento.
 */
import { quoteWith, type EngineConfig } from './engine';

export const KIT_QTY = [10, 50, 100, 250, 500, 1000];
export const KIT_SIZES = [40, 50, 60, 80]; // lato lungo dell'adesivo, in mm
export const KIT_MAX = 6;
/** costi fissi per kit, netti: bustina, cavallotto stampato fronte/retro, confezionamento a mano */
export const KIT_EXTRA_NET = { bustina: 0.18, cavallotto: 0.32, confezionamento: 0.25 };

export interface KitQuote { n: number; qty: number; perKitNet: number; perKitGross: number; net: number; gross: number; stickerNet: number; extraNet: number }

export function kitQuote(cfg: EngineConfig, o: { materiale: string; finitura: string; misura: number; n: number; qty: number }): KitQuote {
	const n = Math.max(0, Math.min(KIT_MAX, Math.round(o.n)));
	const qty = Math.max(1, Math.round(o.qty));
	// un adesivo sagomato di misura x misura*0,8 (proporzione media dei loghi) alla quantita' dei kit
	const w = o.misura, h = Math.round(o.misura * 0.8);
	const one = n ? quoteWith(cfg, { w, h, forma: 'sagomato', materiale: o.materiale, finitura: o.finitura, qty, vatIncluded: false }).net / qty : 0;
	const stickerNet = r2(one * n);
	const extraNet = r2(KIT_EXTRA_NET.bustina + KIT_EXTRA_NET.cavallotto + KIT_EXTRA_NET.confezionamento);
	const perKitNet = r2(stickerNet + extraNet);
	const net = r2(perKitNet * qty);
	return { n, qty, perKitNet, perKitGross: r2(perKitNet * cfg.vat), net, gross: r2(net * cfg.vat), stickerNet, extraNet };
}

/** numero di adesivi codificato nella "forma" della riga d'ordine (kit3, kit6…) */
export const kitN = (forma: string) => Math.max(1, Math.min(KIT_MAX, Number(String(forma).replace(/\D/g, '')) || 1));

const r2 = (v: number) => Math.round(v * 100) / 100;
