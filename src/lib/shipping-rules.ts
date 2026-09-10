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
const VAT = 1.22;
export const isRemote = (province?: string | null) => REMOTE_PROVINCES.has(String(province ?? '').trim().toUpperCase());

/** costo di spedizione (IVA inclusa) per un carrello con quel totale prodotti, verso quella provincia */
export function shippingGrossFor(productsGross: number, onlySamples = false, province?: string | null): number {
	if (onlySamples || productsGross <= 0) return 0;
	if (productsGross >= FREE_SHIPPING_GROSS - 0.005) return 0;
	return isRemote(province) ? SHIPPING_REMOTE_GROSS : SHIPPING_GROSS;
}
/** quanto manca alla spedizione gratuita (0 se raggiunta) */
export function missingForFree(productsGross: number): number {
	return Math.max(0, Math.round((FREE_SHIPPING_GROSS - productsGross) * 100) / 100);
}
