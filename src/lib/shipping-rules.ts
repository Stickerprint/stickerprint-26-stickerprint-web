/**
 * Spedizione in Italia: gratuita da FREE_SHIPPING_GROSS in su (IVA inclusa, prodotti al netto di sconti),
 * altrimenti SHIPPING_GROSS (10 € al cliente) e SHIPPING_REMOTE_GROSS (15 €) verso isole e zone remote,
 * dove il corriere ci costa di piu'. Il kit campioni da solo viaggia sempre gratis.
 * Cifre e province sono le uniche cose da toccare per cambiare la regola.
 */
export const FREE_SHIPPING_GROSS = 50;
export const SHIPPING_GROSS = 10; // al cliente; a noi costa 4,90
export const SHIPPING_REMOTE_GROSS = 15; // isole e zone remote: a noi costa 10
/** province con tariffa maggiorata: Sicilia, Sardegna, Calabria */
export const REMOTE_PROVINCES = new Set([
	'AG', 'CL', 'CT', 'EN', 'ME', 'PA', 'RG', 'SR', 'TP', // Sicilia
	'CA', 'NU', 'OR', 'SS', 'SU', 'CI', 'VS', 'OG', 'OT', // Sardegna (sigle attuali e vecchie)
	'CS', 'CZ', 'KR', 'RC', 'VV' // Calabria
]);
import { SPEDIZIONE, costoSpedizioneUE, zonaDi, type Zona } from './mercati';
import { PRICE_BOOKS } from './i18n';
const VAT = 1.22;
export const isRemote = (province?: string | null) => REMOTE_PROVINCES.has(String(province ?? '').trim().toUpperCase());

/** costo di spedizione (IVA inclusa) per un carrello con quel totale prodotti, verso quella provincia */
export function shippingGrossFor(productsGross: number, onlySamples = false, province?: string | null): number {
	if (onlySamples || productsGross <= 0) return 0;
	if (productsGross >= FREE_SHIPPING_GROSS - 0.005) return 0;
	return isRemote(province) ? SHIPPING_REMOTE_GROSS : SHIPPING_GROSS;
}
/** quanto manca alla spedizione gratuita (0 se raggiunta) */
export function missingForFree(productsGross: number, zona: Zona = 'it'): number {
	return Math.max(0, Math.round((SPEDIZIONE[zona].gratisDa - productsGross) * 100) / 100);
}
/** come shippingGrossFor ma per paese: Italia (province remote), Unione Europea, Stati Uniti.
 *  `productsGross` e' in euro IVA inclusa; per gli USA (niente IVA) si confronta in dollari col listino e il costo torna in euro netti. */
export function shippingForCountry(productsGross: number, onlySamples: boolean, country: string | null | undefined, province?: string | null): { gross: number; zona: Zona; gratisDa: number } {
	const zona = zonaDi(country);
	const z = SPEDIZIONE[zona];
	if (zona === 'it') return { gross: shippingGrossFor(productsGross, onlySamples, province), zona, gratisDa: z.gratisDa };
	if (zona === 'us') {
		const fx = PRICE_BOOKS.USD.rate * PRICE_BOOKS.USD.markup;
		const usd = (productsGross / VAT) * fx;
		if (onlySamples || productsGross <= 0 || usd >= z.gratisDa - 0.005) return { gross: 0, zona, gratisDa: z.gratisDa };
		/* Puerto Rico: zona FedEx a parte, costa di piu' */
		const costoUsd = String(province ?? '').trim().toUpperCase() === 'PR' ? z.costoRemoto : z.costo;
		return { gross: Math.round((costoUsd / fx) * 100) / 100, zona, gratisDa: z.gratisDa };
	}
	if (onlySamples || productsGross <= 0 || productsGross >= z.gratisDa - 0.005) return { gross: 0, zona, gratisDa: z.gratisDa };
	return { gross: costoSpedizioneUE(country), zona, gratisDa: z.gratisDa };
}
