/** Fattura come pagina del cliente: tipi e testo email proposto (condivisi tra server e browser). */
import type { Lang } from '$lib/i18n';
import { perLingua, t as tradotto } from '$lib/traduzioni';
import { dataCliente, formatoValuta, linguaDaPaese } from '$lib/lingua-cliente';
export interface InvoicePayment { id: string; invoice_id: string; seq: number; method: string; xml_code: string | null; due: string; amount: number; payable: boolean; status: 'da_pagare' | 'pagato' | 'annullato'; paid_at: string | null; provider: string | null; provider_ref: string | null; note: string | null }
export interface InvoiceMessage { id: number; invoice_id: string; direction: 'in' | 'out'; author: string | null; body: string; created_at: string }
/** Ricevuta bancaria (RiBa, codice MP12): addebito alla scadenza, niente bottone. Tutto il resto (bonifici) si puo' pagare subito. */
export const isRiba = (method: string, xml?: string | null) => xml === 'MP12' || /ricevuta|riba|rid\b|sdd/i.test(method);
export const dueNow = (p: InvoicePayment[]) => p.filter((x) => x.payable && x.status === 'da_pagare').reduce((a, x) => a + Number(x.amount), 0);
const eur = (v: number) => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', useGrouping: 'always' }).format(v);
const it = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString('it-IT', { day: 'numeric', month: 'long' });
/** Email proposta per l'invio della fattura, nella lingua del cliente (26/11/2026). `cliente`: lingua e, se ha pagato in
 *  un'altra valuta, quanto (allora il totale si scrive in quella valuta, come sul suo PDF). Senza, il paese di fatturazione. */
export function defaultInvoiceEmail(inv: { number: string; issued_at: string; amount_gross: number; billing: Record<string, string> | null; order_numbers?: string[] | null; vat_rate?: number | null }, payments: InvoicePayment[], _sender?: string | null, cliente?: { lang: Lang; valuta?: string | null; importo?: number | null } | null): { subject: string; body: string } {
	const lang: Lang = cliente?.lang ?? linguaDaPaese(inv.billing?.country);
	const P = (k: string, params?: Record<string, string | number>) => tradotto(perLingua(lang), `proposte.${k}`, params);
	const soldi = (v: number) => (lang === 'it' ? eur(v) : formatoValuta(v, 'EUR', lang));
	const giorno = (d: string) => (lang === 'it' ? it(d) : (dataCliente(d.slice(0, 10), lang) ?? d));
	const first = (inv.billing?.first_name || '').trim() || inv.billing?.company || '';
	const open = payments.filter((p) => p.status !== 'pagato');
	const subject = P('fattura.oggetto', { n: inv.number });
	let pay = '';
	if (!open.length) pay = P('fattura.saldata');
	else if (open.every((p) => !p.payable)) pay = open.length === 1 ? P('fattura.ribaUna', { importo: soldi(Number(open[0].amount)), data: giorno(open[0].due) }) : P('fattura.ribaTante');
	else pay = P('fattura.paga', { scadenze: open.length > 1 ? P('fattura.perScadenza') : '' });
	const totale = cliente?.valuta === 'USD' && cliente.importo ? formatoValuta(cliente.importo, 'USD', lang) : soldi(Number(inv.amount_gross));
	const iva = inv.vat_rate != null && Number(inv.vat_rate) === 0 ? '' : P('ivaInclusa');
	const body = `${P('fattura.corpo', { nome: first, n: inv.number, data: giorno(inv.issued_at), ordine: inv.order_numbers?.length ? P('fattura.ordine', { n: inv.order_numbers.join(', ') }) : '', totale, iva })}\n\n${pay}\n\n${P('fattura.chiusura', { firma: 'Stickerprint-Staff' })}`;
	return { subject, body };
}
