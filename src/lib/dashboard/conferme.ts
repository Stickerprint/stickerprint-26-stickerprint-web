/** Conferma d'ordine come pagina del cliente: tipi e testo email proposto (condivisi tra server e browser). */
import type { OrderGroup } from './orders';

export type PaymentStatus = 'da_pagare' | 'pagato' | 'annullato';
export interface OrderPayment { id: string; checkout_group: string; seq: number; method: string; due: string; amount: number; upfront: boolean; status: PaymentStatus; paid_at: string | null; provider: string | null; provider_ref: string | null; note: string | null; created_at: string }
export interface OrderConfirmation { checkout_group: string; token: string; sent_at: string | null; sent_subject: string | null; sent_message: string | null; sender_name: string | null; opened_count: number; opened_at: string | null; pdf_downloaded_at: string | null; unread: boolean; created_at: string }
export interface OrderMessage { id: number; checkout_group: string; direction: 'in' | 'out'; kind: 'domanda' | 'errore' | 'risposta'; author: string | null; body: string; created_at: string }
export const PAYMENT_STATUS: Record<PaymentStatus, { label: string; color: string; soft: string }> = {
	da_pagare: { label: 'Da pagare', color: '#b45309', soft: '#fef3c7' },
	pagato: { label: 'Pagato', color: '#15803d', soft: '#dcfce7' },
	annullato: { label: 'Annullato', color: '#6b7280', soft: '#e5e7eb' }
};
const eur = (v: number) => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(v);
const itLong = (d: string | null) => (d ? new Date(d + 'T12:00:00').toLocaleDateString('it-IT', { day: 'numeric', month: 'long' }) : '');
/** somma delle scadenze anticipate ancora da pagare */
export const upfrontDue = (payments: OrderPayment[]) => payments.filter((p) => p.upfront && p.status === 'da_pagare').reduce((a, p) => a + Number(p.amount), 0);

/** Email proposta: si modifica nel popup prima dell'invio */
export function defaultConfirmEmail(g: Pick<OrderGroup, 'number' | 'customer' | 'items' | 'gross' | 'delivery_date'>, payments: OrderPayment[], sender: string | null): { subject: string; body: string } {
	const f = g.items[0];
	const first = (f.billing?.first_name || f.shipping?.first_name || '').trim() || g.customer;
	const what = g.items.length === 1 ? `${g.items[0].qty.toLocaleString('it-IT')} ${g.items[0].description || g.items[0].product_name}` : `${g.items.length} articoli`;
	const due = upfrontDue(payments);
	const subject = `La tua conferma d'ordine ${g.number}: ${g.items[0].description || g.items[0].product_name}`.slice(0, 120);
	const pay = due > 0
		? `\n\nPer far partire la produzione ci serve il pagamento anticipato di ${eur(due)}: dalla pagina trovi come farlo, e appena arriva si parte.`
		: '\n\nL\'ordine è già in lavorazione.';
	const body = `Ciao ${first},\n\nti confermo l'ordine ${g.number} per ${what}, totale ${eur(g.gross)} IVA inclusa${g.delivery_date ? `, spedizione prevista ${itLong(g.delivery_date)}` : ''}. Dal bottone qui sotto puoi controllare tutti i dettagli (articoli, indirizzi, scadenze) e scaricare il PDF.${pay}\n\nSe qualcosa non torna, segnalamelo direttamente dalla pagina: lo sistemiamo prima di stampare.\n\nA presto,\n${sender ?? 'Stickerprint'}`;
	return { subject, body };
}
