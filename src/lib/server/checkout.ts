/**
 * Chiusura dell'ordine del sito: fattura, email di conferma, pianificazione della produzione, avviso allo staff.
 * Con il pagamento "test" avviene subito; con Stripe quando arriva la conferma dell'incasso (webhook o ritorno alla pagina Grazie).
 * I dati necessari vengono salvati in checkout_sessions al momento dell'ordine.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { PUBLIC_SITE_URL } from '$env/static/public';
import { klaviyoPlacedOrder } from './klaviyo';
import { buildInvoicePdf, type InvoiceLine } from './invoice';
import { sendEmail } from './email';
import { pushStaff } from './push';
import { orderConfirmationEmail } from './email-templates';
import { estimatedShipDate, formatItDate } from '$lib/utils/shipping';
import { ensurePlan } from './produzione';
import type { OrderRow } from '$lib/dashboard/orders';

type DB = SupabaseClient;
export interface CheckoutItem { product: string; productName: string; forma: string; materiale: string; finitura: string | null; w: number; h: number; qty: number; gross: number; previewUrl: string | null }
export interface CheckoutPayload {
	userId: string | null; email: string; firstName: string; lastName: string; payment: string;
	ship: Record<string, string>; bill: Record<string, string>;
	numbers: string[]; invoiceLines: InvoiceLine[]; emailLines: InvoiceLine[]; items: CheckoutItem[];
	productsNet: number; expressNet: number; discount: number; discountCode: string | null; creditUsed: number;
	vatAmount: number; totalGross: number; toPay: number; express: boolean; autoProof: boolean[];
}
/** Etichetta del metodo nei documenti */
export const PAYMENT_NAME: Record<string, string> = { paypal: 'PayPal', stripe: 'Carta di credito (Stripe)', test: 'Test' };

function toBase64(bytes: Uint8Array): string {
	let bin = '';
	for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
	return btoa(bin);
}
const r2 = (v: number) => Math.round(v * 100) / 100;

export async function savePendingCheckout(db: DB, group: string, payload: CheckoutPayload, provider: string): Promise<string | null> {
	const { error } = await db.from('checkout_sessions').insert({ checkout_group: group, provider, payload, status: 'pending' });
	return error?.message ?? null;
}
export async function setCheckoutSession(db: DB, group: string, sessionId: string) { await db.from('checkout_sessions').update({ session_id: sessionId }).eq('checkout_group', group); }
export async function readCheckout(db: DB, group: string): Promise<{ payload: CheckoutPayload; status: string } | null> {
	const { data } = await db.from('checkout_sessions').select('payload, status').eq('checkout_group', group).maybeSingle();
	return data ? { payload: data.payload as CheckoutPayload, status: String(data.status) } : null;
}
/** Pagamento annullato dal cliente: gli ordini in attesa spariscono, il carrello resta nel browser */
export async function cancelPendingCheckout(db: DB, group: string): Promise<void> {
	const { data } = await db.from('checkout_sessions').update({ status: 'cancelled' }).eq('checkout_group', group).eq('status', 'pending').select('checkout_group');
	if (!data?.length) return;
	await db.from('order_payments').delete().eq('checkout_group', group);
	await db.from('orders').delete().eq('checkout_group', group).eq('status', 'attesa_pagamento');
}

/**
 * Chiude l'ordine una volta sola (la riga passa da pending a done in modo atomico):
 * credito e codice sconto usati, fattura con PDF, ordini in produzione, email al cliente, avviso allo staff.
 */
export async function finalizeCheckout(db: DB, group: string, o: { provider: string; ref: string | null }): Promise<{ done: boolean; payload: CheckoutPayload | null; invoice: string | null }> {
	const { data: rows } = await db.from('checkout_sessions').update({ status: 'done', finalized_at: new Date().toISOString() }).eq('checkout_group', group).eq('status', 'pending').select('payload');
	if (!rows?.length) {
		const cur = await readCheckout(db, group);
		return { done: false, payload: cur?.payload ?? null, invoice: null };
	}
	const p = rows[0].payload as CheckoutPayload;
	const paidAt = new Date().toISOString();
	// ordini: pagati e avviati (prova automatica → subito in stampa, altrimenti in attesa della prova)
	const { data: orders } = await db.from('orders').select('*').eq('checkout_group', group).order('created_at');
	for (const row of (orders ?? []) as OrderRow[]) {
		if (row.status !== 'attesa_pagamento') continue;
		const auto = !!row.auto_proof;
		await db.from('orders').update({ status: auto ? 'in_produzione' : 'attesa_prova', prod_stage: auto && row.product_slug !== 'campioni' ? 'stampa' : null, payment_status: 'paid' }).eq('id', row.id);
	}
	await db.from('orders').update({ payment_status: 'paid' }).eq('checkout_group', group);
	if (o.provider === 'stripe' || o.provider === 'paypal' || o.provider === 'test') await db.from('order_payments').update({ status: 'pagato', paid_at: paidAt, provider: o.provider, provider_ref: o.ref, note: o.provider === 'test' ? 'ordine di prova' : 'incassato online' }).eq('checkout_group', group).eq('seq', 1);
	if (p.creditUsed > 0 && p.userId) await db.from('credit_transactions').insert({ user_id: p.userId, amount: -p.creditUsed, kind: 'spend', order_ref: p.numbers[0], note: `Credito usato sull'ordine ${p.numbers.join(', ')}` });
	if (p.discountCode) await db.rpc('discount_code_used', { p_code: p.discountCode });

	klaviyoPlacedOrder({ email: p.email, firstName: p.firstName, lastName: p.lastName, orderNumber: p.numbers[0], total: p.toPay, items: p.items.map((l) => ({ productId: `${l.product}_${l.forma}`, productName: `${l.productName} ${l.forma}`, price: l.gross, quantity: Number(l.qty) })), discountCode: p.discountCode, discountAmount: r2(p.discount * 1.22) }).catch(() => {});

	// fattura: registrata, PDF generato e allegato all'email di conferma
	const { data: invNum } = await db.rpc('next_invoice_number');
	const payTerms = [{ due: paidAt.slice(0, 10), amount: p.toPay, method: PAYMENT_NAME[p.payment] ?? 'Carta di credito (Stripe)', xml_code: 'MP08' }];
	const invoice = { number: (invNum as string) ?? `FT-${Date.now()}`, issued_at: paidAt.slice(0, 10), email: p.email, billing: p.bill, lines: p.invoiceLines, payment_terms: payTerms, subtotal_net: p.productsNet, discount_net: p.discount, discount_code: p.discountCode, express_net: p.expressNet, credit_used: p.creditUsed, vat_amount: p.vatAmount, total_gross: p.totalGross, to_pay: p.toPay, payment_method: p.payment, orders: p.numbers };
	let pdfPath: string | null = null;
	let pdfB64: string | null = null;
	try {
		const bytes = await buildInvoicePdf(invoice);
		pdfB64 = toBase64(bytes);
		const path = `${p.userId ?? 'guest'}/${invoice.number}.pdf`;
		const { error } = await db.storage.from('invoices').upload(path, bytes, { contentType: 'application/pdf', upsert: true });
		if (!error) pdfPath = path;
	} catch (e) {
		console.error('[invoice] pdf', e);
	}
	const firstOrder = (orders ?? [])[0] as { id: string } | undefined;
	await db.from('invoices').insert({ user_id: p.userId, order_id: firstOrder?.id ?? null, number: invoice.number, issued_at: invoice.issued_at, amount_gross: p.toPay, pdf_path: pdfPath, email: p.email, billing: p.bill, lines: p.invoiceLines, payment_terms: payTerms, order_numbers: p.numbers, subtotal_net: p.productsNet, discount_net: p.discount, express_net: p.expressNet, credit_used: p.creditUsed, vat_amount: p.vatAmount, payment_method: p.payment, paid_at: paidAt, checkout_group: group, sent_at: null });

	// pianificazione della produzione: lavorazioni con scadenze a ritroso dalla data promessa
	try { const { data: prows } = await db.from('orders').select('*').eq('checkout_group', group); await ensurePlan(db, (prows ?? []) as OrderRow[]); } catch (e) { console.error('pianificazione produzione', e); }

	const origin = PUBLIC_SITE_URL || 'https://stickerprint.it';
	const mail = orderConfirmationEmail({ name: p.firstName, numbers: p.numbers, invoiceNumber: invoice.number, total: `${p.toPay.toFixed(2).replace('.', ',')} €`, lines: p.emailLines.map((l, i) => ({ name: l.description, qty: l.qty, preview: p.items[i]?.previewUrl ?? null })), shipDate: formatItDate(estimatedShipDate(p.express ? 3 : 5)), accountUrl: p.userId ? `${origin}/account/ordini` : null });
	sendEmail({ to: p.email, ...mail, attachments: pdfB64 ? [{ name: `${invoice.number}.pdf`, content: pdfB64, contentType: 'application/pdf' }] : undefined })
		.then((r) => { if (r.ok && !r.skipped) db.from('invoices').update({ sent_at: new Date().toISOString() }).eq('number', invoice.number).then(() => {}); })
		.catch((e) => console.error('[checkout] email', e));
	pushStaff({ title: `Nuovo ordine ${p.numbers[0]}`, body: `${p.firstName} ${p.lastName} · ${p.emailLines.length} ${p.emailLines.length === 1 ? 'articolo' : 'articoli'} · ${p.toPay.toFixed(2)} €${o.provider === 'stripe' ? ' · pagato con carta' : o.provider === 'paypal' ? ' · pagato con PayPal' : ''}`, url: `/dashboard/fatturazione/ordini/${group}`, tag: p.numbers[0] }).catch((e) => console.error('[push]', e));
	return { done: true, payload: p, invoice: invoice.number };
}
