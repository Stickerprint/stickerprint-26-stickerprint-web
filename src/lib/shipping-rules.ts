/**
 * Spedizione in Italia: gratuita da FREE_SHIPPING_GROSS in su (IVA inclusa, prodotti al netto di sconti),
 * altrimenti SHIPPING_GROSS (10 € al cliente). Il kit campioni viaggia sempre gratis.
 * Sono le uniche due cifre da cambiare per spostare la soglia.
 */
export const FREE_SHIPPING_GROSS = 50;
export const SHIPPING_GROSS = 10; // al cliente; a noi costa 4,90 (10 sulle isole)
const VAT = 1.22;
export const SHIPPING_NET = Math.round((SHIPPING_GROSS / VAT) * 100) / 100;

/** costo di spedizione (IVA inclusa) per un carrello con quel totale prodotti */
export function shippingGrossFor(productsGross: number, onlySamples = false): number {
	if (onlySamples || productsGross <= 0) return 0;
	return productsGross >= FREE_SHIPPING_GROSS - 0.005 ? 0 : SHIPPING_GROSS;
}
/** quanto manca alla spedizione gratuita (0 se raggiunta) */
export function missingForFree(productsGross: number): number {
	return Math.max(0, Math.round((FREE_SHIPPING_GROSS - productsGross) * 100) / 100);
}
