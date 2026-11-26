/** Conferma d'ordine come pagina del cliente: tipi e testo email proposto (condivisi tra server e browser). */
import type { OrderGroup } from './orders';
import { LOCALES, type Lang } from '$lib/i18n';
import { perLingua, t as tradotto } from '$lib/traduzioni';
import { dataCliente, formatoValuta, linguaOrdine } from '$lib/lingua-cliente';

export type PaymentStatus = 'da_pagare' | 'pagato' | 'annullato';
export interface OrderPayment { id: string; checkout_group: string; seq: number; method: string; due: string; amount: number; upfront: boolean; status: PaymentStatus; paid_at: string | null; provider: string | null; provider_ref: string | null; note: string | null; created_at: string; kind?: 'scadenza' | 'integrazione'; reason?: string | null; changes?: IntegrationChange[] | null; invoice_id?: string | null }
export interface IntegrationChange { order_id: string; width_mm: number | null; height_mm: number | null; materiale: string | null; finitura: string | null; qty: number; total_net: number; total_gross: number; unit_net: number; label: string }
export interface OrderConfirmation { checkout_group: string; token: string; sent_at: string | null; sent_subject: string | null; sent_message: string | null; sender_name: string | null; opened_count: number; opened_at: string | null; pdf_downloaded_at: string | null; unread: boolean; created_at: string }
export interface OrderMessage { id: number; checkout_group: string; direction: 'in' | 'out'; kind: 'domanda' | 'errore' | 'risposta'; author: string | null; body: string; created_at: string }
export const PAYMENT_STATUS: Record<PaymentStatus, { label: string; color: string; soft: string }> = {
	da_pagare: { label: 'Da pagare', color: '#b45309', soft: '#fef3c7' },
	pagato: { label: 'Pagato', color: '#15803d', soft: '#dcfce7' },
	annullato: { label: 'Annullato', color: '#6b7280', soft: '#e5e7eb' }
};
const eur = (v: number) => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', useGrouping: 'always' }).format(v);
const itLong = (d: string | null) => (d ? new Date(d + 'T12:00:00').toLocaleDateString('it-IT', { day: 'numeric', month: 'long' }) : '');
/** somma delle scadenze anticipate ancora da pagare */
export const upfrontDue = (payments: OrderPayment[]) => payments.filter((p) => p.upfront && p.status === 'da_pagare').reduce((a, p) => a + Number(p.amount), 0);

/** Email proposta: si modifica nel popup prima dell'invio. Nella lingua del cliente (26/11/2026): quella dell'ordine,
 *  cioe' il sito da cui ha ordinato o, per gli ordini inseriti da noi, il paese di fatturazione. */
export function defaultConfirmEmail(g: Pick<OrderGroup, 'number' | 'customer' | 'items' | 'gross' | 'delivery_date'>, payments: OrderPayment[], _sender?: string | null, lang: Lang = linguaOrdine(g.items[0]).lang): { subject: string; body: string } {
	const P = (k: string, params?: Record<string, string | number>) => tradotto(perLingua(lang), `proposte.${k}`, params);
	const soldi = (v: number) => (lang === 'it' ? eur(v) : formatoValuta(v, 'EUR', lang));
	const f = g.items[0];
	const first = (f.billing?.first_name || f.shipping?.first_name || '').trim() || g.customer;
	const cosa = g.items[0].description || g.items[0].product_name;
	const what = g.items.length === 1 ? `${g.items[0].qty.toLocaleString(LOCALES[perLingua(lang)].intl)} ${cosa}` : P('conferma.articoli', { n: g.items.length });
	const due = upfrontDue(payments);
	const subject = P('conferma.oggetto', { n: g.number, cosa }).slice(0, 120);
	const pay = due > 0 ? P('conferma.daPagare', { importo: soldi(due) }) : P('conferma.inLavorazione');
	/* senza IVA (cliente estero con partita IVA valida, fuori UE) non si scrive "IVA inclusa" */
	const iva = Number((f as { vat_rate?: number | null }).vat_rate ?? 0.22) === 0 ? '' : P('ivaInclusa');
	const spedizione = g.delivery_date ? P('conferma.spedizione', { data: (lang === 'it' ? itLong(g.delivery_date) : dataCliente(g.delivery_date, lang)) ?? '' }) : '';
	const body = `${P('conferma.corpo', { nome: first, n: g.number, cosa: what, totale: soldi(g.gross), iva, spedizione })}${pay}${P('conferma.chiusura', { firma: 'Stickerprint-Staff' })}`;
	return { subject, body };
}
