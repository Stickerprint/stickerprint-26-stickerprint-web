/**
 * Integrazioni di pagamento: dopo l'ordine il cliente vuole una misura, una finitura o una quantita' diversa.
 * Dalla scheda ordine si modificano le righe, il listino ricalcola, la differenza diventa una scadenza "Integrazione"
 * sulla pagina del cliente (carta, PayPal o bonifico). Finche' non paga l'ordine e' fermo (attesa_integrazione, fasi bloccate).
 * All'incasso: righe aggiornate, produzione ripianificata, fattura a se' con il numero successivo, email con il PDF.
 * Se la modifica costa meno o uguale si applica subito; il rimborso (se serve) lo fa lo staff da Stripe/PayPal.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { PUBLIC_SITE_URL } from '$env/static/public';
import { groupOrders, type OrderRow } from '$lib/dashboard/orders';
import type { IntegrationChange, OrderPayment } from '$lib/dashboard/conferme';
import { MATERIAL_LABEL } from '$lib/account';
import { loadEngine } from './pricing';
import { quoteWith, PRODUCT_ENGINES } from '$lib/pricing/engine';
import { getConfirmation, loadGroup, loadPayments } from './conferme';
import { blockPhase, unblockPhase, loadJob, recalcAll, ensurePlan, logEvent } from './produzione';
import { buildInvoicePdf } from './invoice';
import { sendEmail } from './email';
import { pushStaff } from './push';
import { integrationRequestEmail, integrationInvoiceEmail, OWNER_EMAIL, ownerNotifyEmail } from './email-templates';

type DB = SupabaseClient;
const r2 = (v: number) => Math.round(v * 100) / 100;
const eur = (v: number) => `${v.toFixed(2).replace('.', ',')} €`;

export interface ChangeInput { order_id: string; width_mm?: number | null; height_mm?: number | null; materiale?: string | null; finitura?: string | null; qty?: number | null }

/** Descrizione leggibile di una riga con i valori nuovi */
function describe(row: OrderRow, c: { width_mm: number | null; height_mm: number | null; materiale: string | null; finitura: string | null; qty: number }): string {
	const size = c.width_mm && c.height_mm ? `${c.width_mm}×${c.height_mm} mm` : '';
	const fin = c.finitura && c.finitura !== 'nessuna' ? `lamina ${c.finitura}` : '';
	return [`${c.qty} × ${row.product_name}`, row.forma, MATERIAL_LABEL[c.materiale ?? ''] ?? c.materiale, fin, size].filter(Boolean).join(' · ');
}

/** Ricalcola le righe con i valori nuovi: prezzo dal listino quando c'e' un motore, altrimenti proporzionale alla quantita' */
export async function previewIntegration(db: DB, group: string, inputs: ChangeInput[]): Promise<{ changes: IntegrationChange[]; paid: number; newGross: number; diff: number; engine: boolean } | { error: string }> {
	const g = await loadGroup(db, group);
	if (!g) return { error: 'Ordine non trovato.' };
	const changes: IntegrationChange[] = [];
	let engineUsed = false;
	for (const row of g.items) {
		const inp = inputs.find((i) => i.order_id === row.id);
		const c = { width_mm: inp?.width_mm ?? row.width_mm, height_mm: inp?.height_mm ?? row.height_mm, materiale: inp?.materiale ?? row.materiale, finitura: inp?.finitura ?? row.finitura, qty: Math.max(1, Math.round(inp?.qty ?? row.qty)) };
		const same = c.width_mm === row.width_mm && c.height_mm === row.height_mm && c.materiale === row.materiale && c.finitura === row.finitura && c.qty === row.qty;
		let net = Number(row.total_net), gross = Number(row.total_gross);
		if (!same) {
			const eng = PRODUCT_ENGINES.find((e) => e.slug === row.product_slug);
			if (eng && c.width_mm && c.height_mm) {
				try {
					const { config } = await loadEngine(db, row.product_slug);
					const q = quoteWith(config, { w: Number(c.width_mm), h: Number(c.height_mm), forma: row.forma ?? 'sagomato', materiale: c.materiale ?? 'bianco', finitura: c.finitura ?? 'nessuna', qty: c.qty, vatIncluded: true });
					net = r2(q.net); gross = r2(q.gross); engineUsed = true;
				} catch { net = r2((Number(row.total_net) / row.qty) * c.qty); gross = r2(net * 1.22); }
			} else { net = r2((Number(row.total_net) / row.qty) * c.qty); gross = r2(net * 1.22); }
		}
		changes.push({ order_id: row.id, ...c, total_net: net, total_gross: gross, unit_net: r2(net / c.qty), label: describe(row, c) });
	}
	const paid = r2(g.items.reduce((s, i) => s + Number(i.total_gross), 0));
	const newGross = r2(changes.reduce((s, c) => s + c.total_gross, 0));
	return { changes, paid, newGross, diff: r2(newGross - paid), engine: engineUsed };
}

/** Blocca/sblocca tutte le fasi aperte della commessa (l'ordine aspetta il pagamento dell'integrazione) */
async function holdProduction(db: DB, group: string, hold: boolean, operator: string | null) {
	const jf = await loadJob(db, group);
	if (!jf) return;
	for (const p of jf.phases) {
		if (hold && (p.status === 'pronto' || p.status === 'in_corso')) await blockPhase(db, p.id, 'Integrazione da pagare: fermo finché il cliente non salda la differenza', operator);
		if (!hold && p.status === 'bloccato' && /Integrazione da pagare/.test(p.block_reason ?? '')) await unblockPhase(db, p.id, operator);
	}
}

/** Crea la richiesta: scadenza "Integrazione", ordine fermo, email al cliente. Con differenza <= 0 applica subito. */
export async function requestIntegration(db: DB, group: string, inputs: ChangeInput[], amountOverride: number | null, reason: string, operator: string | null, origin: string): Promise<{ error?: string; applied?: boolean; amount?: number }> {
	const g = await loadGroup(db, group);
	if (!g) return { error: 'Ordine non trovato.' };
	if (!['in_produzione', 'attesa_pagamento', 'attesa_integrazione', 'in_attesa'].includes(g.status)) return { error: `L'ordine è "${g.status}": l'integrazione si chiede prima della spedizione.` };
	const pv = await previewIntegration(db, group, inputs);
	if ('error' in pv) return pv;
	const amount = amountOverride != null ? r2(amountOverride) : pv.diff;
	const why = reason.trim() || pv.changes.filter((c) => inputs.some((i) => i.order_id === c.order_id)).map((c) => c.label).join('; ');
	if (amount <= 0) {
		await applyChanges(db, group, pv.changes, operator);
		await db.from('orders').update({ internal_notes: `${g.items[0].internal_notes ? g.items[0].internal_notes + ' · ' : ''}Modifica applicata senza integrazione (${why})${amount < 0 ? ` · da rimborsare ${eur(-amount)}` : ''}` }).eq('checkout_group', group);
		return { applied: true, amount };
	}
	/* una sola integrazione aperta alla volta: la precedente non pagata viene sostituita */
	await db.from('order_payments').delete().eq('checkout_group', group).eq('kind', 'integrazione').eq('status', 'da_pagare');
	const payments = await loadPayments(db, group);
	const seq = Math.max(0, ...payments.map((p) => p.seq)) + 1;
	const { error } = await db.from('order_payments').insert({ checkout_group: group, seq, method: 'Carta o PayPal', due: new Date().toISOString().slice(0, 10), amount, upfront: true, status: 'da_pagare', kind: 'integrazione', reason: why, changes: pv.changes });
	if (error) return { error: error.message };
	await db.from('orders').update({ status: 'attesa_integrazione' }).eq('checkout_group', group).neq('status', 'annullato');
	await holdProduction(db, group, true, operator);
	const conf = await getConfirmation(db, group);
	const href = `${(origin || PUBLIC_SITE_URL || 'https://stickerprint.it').replace(/\/$/, '')}/conferma/${conf.token}`;
	if (g.email) {
		const mail = integrationRequestEmail({ name: g.items[0].shipping?.first_name || g.customer, number: g.number, amount: eur(amount), reason: why, lines: pv.changes.map((c) => c.label), href, senderName: operator });
		await sendEmail({ to: g.email, subject: mail.subject, html: mail.html, tag: mail.tag, metadata: { order: g.number } }).catch(() => {});
	}
	pushStaff({ title: `Integrazione richiesta · ${g.number}`, body: `${eur(amount)} · ${why}`.slice(0, 120), url: `/dashboard/fatturazione/ordini/${group}`, tag: `integr-${group}` });
	return { amount };
}

/** Scrive i valori nuovi sulle righe dell'ordine */
async function applyChanges(db: DB, group: string, changes: IntegrationChange[], operator: string | null) {
	for (const c of changes) {
		await db.from('orders').update({ width_mm: c.width_mm, height_mm: c.height_mm, materiale: c.materiale, finitura: c.finitura, qty: c.qty, total_net: c.total_net, total_gross: c.total_gross, unit_net: c.unit_net }).eq('id', c.order_id);
	}
	const { data: rows } = await db.from('orders').select('*').eq('checkout_group', group);
	const list = (rows ?? []) as OrderRow[];
	if (list.length && list[0].status === 'in_produzione') { await ensurePlan(db, list, operator); await recalcAll(db); }
	const jf = await loadJob(db, group);
	if (jf) await logEvent(db, { order_id: list[0]?.id ?? jf.group.items[0].id, job_id: jf.job.id, kind: 'nota', detail: 'Ordine modificato: ' + changes.map((c) => c.label).join('; '), operator });
}

/** All'incasso dell'integrazione: modifiche applicate, ordine ripartito, fattura a se' + email con PDF */
export async function settleIntegration(db: DB, group: string, payment: OrderPayment, operator: string | null): Promise<void> {
	const g = await loadGroup(db, group);
	if (!g) return;
	const changes = (payment.changes ?? []) as IntegrationChange[];
	/* l'ordine riparte: prima lo stato, poi le righe (cosi' ensurePlan lo vede in produzione) */
	await db.from('orders').update({ status: 'in_produzione', payment_status: 'paid' }).eq('checkout_group', group).eq('status', 'attesa_integrazione');
	if (changes.length) await applyChanges(db, group, changes, operator);
	await holdProduction(db, group, false, operator);
	/* fattura dell'integrazione: solo la differenza, numero progressivo, IVA scorporata dal pagato */
	const first = g.items[0];
	const amount = r2(Number(payment.amount));
	const net = r2(amount / 1.22), vat = r2(amount - net);
	const { data: invNum } = await db.rpc('next_invoice_number');
	const number = (invNum as string) ?? `SPF-${Date.now()}`;
	const today = new Date().toISOString().slice(0, 10);
	const bill = (first.billing ?? first.shipping ?? {}) as Record<string, string>;
	const lines = [{ description: `Integrazione ordine ${g.number}: ${payment.reason ?? 'modifica dell’ordine'}`.slice(0, 200), qty: 1, unit_net: net, total_net: net }];
	const method = payment.provider === 'paypal' ? 'PayPal' : payment.provider === 'stripe' ? 'Carta di credito (Stripe)' : 'Bonifico bancario';
	const terms = [{ due: today, amount, method, xml_code: payment.provider === 'stripe' || payment.provider === 'paypal' ? 'MP08' : 'MP05' }];
	const inv = { number, issued_at: today, email: g.email, billing: bill, lines, subtotal_net: net, discount_net: 0, express_net: 0, credit_used: 0, vat_amount: vat, total_gross: amount, to_pay: amount, payment_method: method, orders: g.numbers, payment_terms: terms, notes: null };
	let pdfPath: string | null = null; let b64: string | null = null;
	try {
		const bytes = await buildInvoicePdf(inv);
		pdfPath = `${first.user_id ?? 'guest'}/${number}.pdf`;
		const { error } = await db.storage.from('invoices').upload(pdfPath, bytes, { contentType: 'application/pdf', upsert: true });
		if (error) pdfPath = null; else { let bin = ''; for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000)); b64 = btoa(bin); }
	} catch (e) { console.error('[integrazione] pdf', e); }
	const { data: created } = await db.from('invoices').insert({ user_id: first.user_id, order_id: first.id, number, issued_at: today, amount_gross: amount, pdf_path: pdfPath, email: g.email, billing: bill, lines, payment_terms: terms, order_numbers: g.numbers, subtotal_net: net, discount_net: 0, express_net: 0, credit_used: 0, vat_amount: vat, payment_method: payment.provider ?? 'manuale', paid_at: new Date().toISOString(), checkout_group: group, sent_at: g.email ? new Date().toISOString() : null }).select('id').single();
	if (created?.id) await db.from('order_payments').update({ invoice_id: created.id }).eq('id', payment.id);
	if (g.email) {
		const mail = integrationInvoiceEmail({ name: first.shipping?.first_name || g.customer, number: g.number, invoice: number, amount: eur(amount), lines: changes.map((c) => c.label) });
		await sendEmail({ to: g.email, subject: mail.subject, html: mail.html, tag: mail.tag, metadata: { order: g.number }, attachments: b64 ? [{ name: `${number}.pdf`, content: b64, contentType: 'application/pdf' }] : undefined }).catch(() => {});
	}
	pushStaff({ title: `Integrazione pagata · ${g.number}`, body: `${eur(amount)} · fattura ${number} · ordine ripartito`, url: `/dashboard/fatturazione/ordini/${group}`, tag: `integr-${group}` });
	sendEmail({ to: OWNER_EMAIL, ...ownerNotifyEmail({ title: `Integrazione pagata · ${g.number} · ${eur(amount)}`, lines: [`Cliente: ${g.customer} (${g.email})`, ...changes.map((c) => c.label), `Fattura ${number}`], href: `${(PUBLIC_SITE_URL || 'https://stickerprint.it')}/dashboard/fatturazione/ordini/${encodeURIComponent(group)}` }) }).catch(() => {});
}

/** Annulla una richiesta non pagata: l'ordine riparte com'era */
export async function cancelIntegration(db: DB, group: string, operator: string | null): Promise<string | null> {
	const { data } = await db.from('order_payments').delete().eq('checkout_group', group).eq('kind', 'integrazione').eq('status', 'da_pagare').select('id');
	if (!data?.length) return 'Nessuna integrazione in attesa.';
	await db.from('orders').update({ status: 'in_produzione' }).eq('checkout_group', group).eq('status', 'attesa_integrazione');
	await holdProduction(db, group, false, operator);
	return null;
}
