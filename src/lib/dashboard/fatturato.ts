/**
 * Fatturato per la Home: le fatture divise tra e-commerce e manuali, sommate mese per mese.
 * Netto = imponibile - sconto + express (lo stesso "netto" della pagina Fatture). Pura: si prova senza database.
 */
export interface FatturaRiga {
	number: string; issued_at: string; subtotal_net: number | null; discount_net: number | null; express_net: number | null; amount_gross: number;
	payment_method: string | null; ddt_number?: string | null; ddt_numbers?: string[] | null; checkout_group?: string | null;
}
export const COLONNE_FATTURATO = 'number, issued_at, subtotal_net, discount_net, express_net, amount_gross, payment_method, ddt_number, ddt_numbers, checkout_group';
/** metodi di pagamento che nascono solo dal checkout del sito */
const PAGAMENTI_SITO = ['stripe', 'paypal', 'wallet', 'credito', 'test'];
const r2 = (v: number) => Math.round(v * 100) / 100;

export const nettoFattura = (i: FatturaRiga) => r2(Number(i.subtotal_net ?? 0) - Number(i.discount_net ?? 0) + Number(i.express_net ?? 0));
/** e-commerce = fattura nata dal checkout (gruppo di checkout o pagamento del sito) e senza DDT; tutto il resto e' manuale */
export function canaleFattura(i: FatturaRiga): 'ecommerce' | 'manuale' {
	const ddt = i.ddt_numbers?.length ? i.ddt_numbers : i.ddt_number ? [i.ddt_number] : [];
	if (ddt.length) return 'manuale';
	if (i.checkout_group) return 'ecommerce';
	return PAGAMENTI_SITO.includes((i.payment_method ?? '').toLowerCase()) ? 'ecommerce' : 'manuale';
}
export interface MeseFatturato { mese: string; ecommerce: number; manuale: number; totale: number; fatture: number; fattureEcommerce: number; fattureManuali: number }
const vuoto = (mese: string): MeseFatturato => ({ mese, ecommerce: 0, manuale: 0, totale: 0, fatture: 0, fattureEcommerce: 0, fattureManuali: 0 });
/** somma per mese (yyyy-mm) nell'ordine dei mesi dati; i mesi senza fatture restano a zero */
export function fatturatoPerMese(fatture: FatturaRiga[], mesi: string[]): MeseFatturato[] {
	const m = new Map(mesi.map((x) => [x, vuoto(x)]));
	for (const f of fatture) {
		const r = m.get(f.issued_at.slice(0, 7));
		if (!r) continue;
		const n = nettoFattura(f);
		r.fatture++;
		if (canaleFattura(f) === 'ecommerce') { r.ecommerce = r2(r.ecommerce + n); r.fattureEcommerce++; } else { r.manuale = r2(r.manuale + n); r.fattureManuali++; }
		r.totale = r2(r.ecommerce + r.manuale);
	}
	return mesi.map((x) => m.get(x)!);
}
/** Ordine (gruppo) ridotto a cio' che serve all'andamento: mese di creazione (yyyy-mm, ora italiana), canale, stato e netto (imponibile meno sconti) */
export interface OrdineRiga { mese: string; channel: string; status: string; net: number }
/** somma per mese degli ordini, e-commerce (canale del sito) o manuali: la stessa cifra della pagina Ordini, annullati esclusi; i mesi senza ordini restano a zero */
export function fatturatoOrdiniPerMese(ordini: OrdineRiga[], mesi: string[]): MeseFatturato[] {
	const m = new Map(mesi.map((x) => [x, vuoto(x)]));
	for (const o of ordini) {
		if (o.status === 'annullato') continue;
		const r = m.get(o.mese);
		if (!r) continue;
		r.fatture++;
		if (o.channel === 'ecommerce') { r.ecommerce = r2(r.ecommerce + o.net); r.fattureEcommerce++; } else { r.manuale = r2(r.manuale + o.net); r.fattureManuali++; }
		r.totale = r2(r.ecommerce + r.manuale);
	}
	return mesi.map((x) => m.get(x)!);
}
/** media ordine e-commerce (netto): ogni voce e-commerce e' un ordine; null senza ordini */
export const mediaOrdineEcommerce = (m: MeseFatturato): number | null => (m.fattureEcommerce > 0 ? r2(m.ecommerce / m.fattureEcommerce) : null);
/** totale di piu' mesi (es. l'anno in corso) */
export function sommaMesi(mesi: MeseFatturato[]): MeseFatturato {
	const t = vuoto(mesi[0]?.mese ?? '');
	for (const x of mesi) { t.ecommerce = r2(t.ecommerce + x.ecommerce); t.manuale = r2(t.manuale + x.manuale); t.fatture += x.fatture; t.fattureEcommerce += x.fattureEcommerce; t.fattureManuali += x.fattureManuali; }
	t.totale = r2(t.ecommerce + t.manuale);
	return t;
}
