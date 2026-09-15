/** Fattura come pagina del cliente: tipi e testo email proposto (condivisi tra server e browser). */
export interface InvoicePayment { id: string; invoice_id: string; seq: number; method: string; xml_code: string | null; due: string; amount: number; payable: boolean; status: 'da_pagare' | 'pagato' | 'annullato'; paid_at: string | null; provider: string | null; provider_ref: string | null; note: string | null }
export interface InvoiceMessage { id: number; invoice_id: string; direction: 'in' | 'out'; author: string | null; body: string; created_at: string }
/** Ricevuta bancaria (RiBa, codice MP12): addebito alla scadenza, niente bottone. Tutto il resto (bonifici) si puo' pagare subito. */
export const isRiba = (method: string, xml?: string | null) => xml === 'MP12' || /ricevuta|riba|rid\b|sdd/i.test(method);
export const dueNow = (p: InvoicePayment[]) => p.filter((x) => x.payable && x.status === 'da_pagare').reduce((a, x) => a + Number(x.amount), 0);
const eur = (v: number) => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(v);
const it = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString('it-IT', { day: 'numeric', month: 'long' });
export function defaultInvoiceEmail(inv: { number: string; issued_at: string; amount_gross: number; billing: Record<string, string> | null; order_numbers?: string[] | null }, payments: InvoicePayment[], sender: string | null): { subject: string; body: string } {
	const first = (inv.billing?.first_name || '').trim() || inv.billing?.company || '';
	const open = payments.filter((p) => p.status !== 'pagato');
	const subject = `La tua fattura ${inv.number} di Stickerprint`;
	let pay = '';
	if (!open.length) pay = 'La fattura risulta già saldata: è solo per i tuoi archivi.';
	else if (open.every((p) => !p.payable)) pay = open.length === 1 ? `L'importo di ${eur(Number(open[0].amount))} verrà addebitato con ricevuta bancaria alla scadenza del ${it(open[0].due)}: non devi fare nulla.` : `Gli importi verranno addebitati con ricevuta bancaria alle scadenze indicate nella pagina: non devi fare nulla.`;
	else pay = `Dalla pagina puoi pagare subito con carta o vedere i dati per il bonifico${open.length > 1 ? ', scadenza per scadenza' : ''}.`;
	const body = `Ciao ${first},\n\nti mando la fattura ${inv.number} del ${it(inv.issued_at)}${inv.order_numbers?.length ? ` per l'ordine ${inv.order_numbers.join(', ')}` : ''}, totale ${eur(Number(inv.amount_gross))} IVA inclusa. Dal bottone qui sotto la vedi nel dettaglio e scarichi il PDF.\n\n${pay}\n\nPer qualsiasi cosa (intestazione, importi, scadenze) scrivimi dalla pagina o rispondi a questa email.\n\nGrazie e a presto,\n${sender ?? 'Stickerprint'}`;
	return { subject, body };
}
