/**
 * Conferma d'ordine come pagina del cliente (/conferma/[token]): scadenze con pagamento, email scritta dallo staff,
 * domande e segnalazioni dalla pagina, aperture. Le scadenze anticipate si incassano prima di produrre.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { groupOrders, money, type OrderGroup, type OrderRow } from '$lib/dashboard/orders';
import type { PaymentMethod } from '$lib/dashboard/payments';
import { upfrontDue, type OrderConfirmation, type OrderMessage, type OrderPayment } from '$lib/dashboard/conferme';
import { sendEmail } from './email';
import { OWNER_EMAIL, orderConfirmEmail, orderPaymentReminderEmail, orderReplyEmail, ownerNotifyEmail } from './email-templates';
import { pushStaff } from './push';
import { ensurePlan } from './produzione';
export * from '$lib/dashboard/conferme';

type DB = SupabaseClient;

export async function loadGroup(db: DB, group: string): Promise<OrderGroup | null> {
	const { data } = await db.from('orders').select('*').eq('checkout_group', group);
	return data?.length ? groupOrders(data as OrderRow[])[0] : null;
}

/** Le scadenze dell'ordine → righe di pagamento (le pagate restano, le altre si riallineano al documento) */
export async function syncPayments(db: DB, group: string): Promise<OrderPayment[]> {
	const g = await loadGroup(db, group);
	if (!g) return [];
	const { data: methods } = await db.from('payment_methods').select('name, paid_upfront');
	const upfrontOf = (name: string) => !!(methods ?? []).find((m) => m.name === name)?.paid_upfront;
	const terms = (g.items[0].payment_terms ?? []).map((t, i) => ({ seq: i + 1, method: t.method, due: t.due, amount: Number(t.amount), upfront: upfrontOf(t.method) }));
	const { data: existing } = await db.from('order_payments').select('*').eq('checkout_group', group).order('seq');
	const paid = ((existing ?? []) as OrderPayment[]).filter((p) => p.status === 'pagato');
	const paidSeq = new Set(paid.map((p) => p.seq));
	await db.from('order_payments').delete().eq('checkout_group', group).neq('status', 'pagato');
	const rows = terms.filter((t) => !paidSeq.has(t.seq)).map((t) => ({ ...t, checkout_group: group }));
	if (rows.length) await db.from('order_payments').insert(rows);
	return loadPayments(db, group);
}
export async function loadPayments(db: DB, group: string): Promise<OrderPayment[]> {
	const { data } = await db.from('order_payments').select('*').eq('checkout_group', group).order('seq');
	return (data ?? []) as OrderPayment[];
}
export async function getConfirmation(db: DB, group: string): Promise<OrderConfirmation> {
	const { data } = await db.from('order_confirmations').select('*').eq('checkout_group', group).maybeSingle();
	if (data) return data as OrderConfirmation;
	const { data: ins } = await db.from('order_confirmations').insert({ checkout_group: group }).select('*').single();
	return ins as OrderConfirmation;
}
export async function loadMessages(db: DB, group: string): Promise<OrderMessage[]> {
	const { data } = await db.from('order_messages').select('*').eq('checkout_group', group).order('created_at');
	return (data ?? []) as OrderMessage[];
}
export async function markConfirmationRead(db: DB, group: string) { await db.from('order_confirmations').update({ unread: false }).eq('checkout_group', group).eq('unread', true); }

/** Se ci sono anticipi da incassare, l'ordine aspetta; altrimenti (o quando arrivano) entra in produzione */
export async function applyPaymentGate(db: DB, group: string, operator: string | null = null): Promise<'attesa_pagamento' | 'in_produzione' | null> {
	const g = await loadGroup(db, group);
	if (!g) return null;
	const payments = await loadPayments(db, group);
	const due = upfrontDue(payments);
	const statuses = new Set(g.items.map((i) => i.status));
	if (due > 0 && [...statuses].every((s) => s === 'in_produzione' || s === 'attesa_pagamento')) {
		const started = g.items.some((i) => i.status === 'in_produzione' && i.prod_stage && i.prod_stage !== 'stampa');
		if (!started) { await db.from('orders').update({ status: 'attesa_pagamento', prod_stage: null }).eq('checkout_group', group); return 'attesa_pagamento'; }
	}
	if (due === 0 && statuses.has('attesa_pagamento')) {
		const allPaid = payments.every((p) => !p.upfront || p.status !== 'da_pagare');
		await db.from('orders').update({ status: 'in_produzione', prod_stage: 'stampa', payment_status: allPaid && payments.length && payments.every((p) => p.status === 'pagato') ? 'paid' : 'pending' }).eq('checkout_group', group).eq('status', 'attesa_pagamento');
		const { data: rows } = await db.from('orders').select('*').eq('checkout_group', group);
		await ensurePlan(db, (rows ?? []) as OrderRow[], operator);
		return 'in_produzione';
	}
	return null;
}

/** Invio della conferma: email scritta dallo staff con il bottone; niente allegato */
export async function sendConfirmation(db: DB, group: string, origin: string, o: { to?: string | null; cc?: string | null; subject: string; message: string; sender: string | null }): Promise<{ ok: boolean; message: string }> {
	const g = await loadGroup(db, group);
	if (!g) return { ok: false, message: 'Ordine non trovato.' };
	const email = (o.to || g.email || '').trim().toLowerCase();
	if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { ok: false, message: 'Indirizzo email del cliente non valido.' };
	if (!o.subject.trim() || !o.message.trim()) return { ok: false, message: "Oggetto e testo dell'email sono obbligatori." };
	const payments = await syncPayments(db, group);
	const conf = await getConfirmation(db, group);
	const due = upfrontDue(payments);
	const mail = orderConfirmEmail({ subject: o.subject.trim(), message: o.message.trim(), senderName: o.sender, number: g.number, href: `${origin}/conferma/${conf.token}`, toPay: due > 0 ? money(due) : null });
	const cc = (o.cc || '').split(/[,;\s]+/).map((x) => x.trim().toLowerCase()).filter((x) => /^[^@]+@[^@]+\.[^@]+$/.test(x));
	const r = await sendEmail({ to: [email, ...cc], ...mail, metadata: { order: g.number } });
	if (!r.ok) return { ok: false, message: r.error ?? 'Email non inviata.' };
	await db.from('order_confirmations').update({ sent_at: new Date().toISOString(), sent_subject: o.subject.trim(), sent_message: o.message.trim(), sender_name: o.sender }).eq('checkout_group', group);
	await applyPaymentGate(db, group, o.sender);
	return { ok: true, message: r.skipped ? 'Postmark non configurato: email simulata.' : `Conferma inviata a ${email}${cc.length ? ` (copia a ${cc.join(', ')})` : ''}.` };
}

export async function setPaymentStatus(db: DB, group: string, seq: number, status: 'pagato' | 'da_pagare', operator: string | null, ref?: string | null): Promise<string | null> {
	const patch = status === 'pagato' ? { status, paid_at: new Date().toISOString(), provider: 'manuale', provider_ref: ref || null, note: operator ? `segnato da ${operator}` : null } : { status, paid_at: null, provider: null, provider_ref: null, note: null };
	const { error } = await db.from('order_payments').update(patch).eq('checkout_group', group).eq('seq', seq);
	if (error) return error.message;
	const payments = await loadPayments(db, group);
	const allPaid = payments.length > 0 && payments.every((p) => p.status === 'pagato');
	await db.from('orders').update({ payment_status: allPaid ? 'paid' : 'pending' }).eq('checkout_group', group);
	await applyPaymentGate(db, group, operator);
	return null;
}

/* ---------- pagina del cliente ---------- */
export async function getByToken(db: DB, token: string): Promise<{ group: OrderGroup; conf: OrderConfirmation; payments: OrderPayment[]; messages: OrderMessage[] } | null> {
	if (!/^[0-9a-f-]{36}$/.test(token)) return null;
	const { data: conf } = await db.from('order_confirmations').select('*').eq('token', token).maybeSingle();
	if (!conf) return null;
	const group = await loadGroup(db, conf.checkout_group);
	if (!group) return null;
	const [payments, messages] = await Promise.all([loadPayments(db, conf.checkout_group), loadMessages(db, conf.checkout_group)]);
	return { group, conf: conf as OrderConfirmation, payments, messages };
}
export async function trackOpen(db: DB, conf: OrderConfirmation) { await db.from('order_confirmations').update({ opened_count: conf.opened_count + 1, opened_at: new Date().toISOString() }).eq('checkout_group', conf.checkout_group); }
export async function trackPdf(db: DB, group: string) { await db.from('order_confirmations').update({ pdf_downloaded_at: new Date().toISOString() }).eq('checkout_group', group); }

/** Domanda o segnalazione di errore dalla pagina: entra nell'ordine, avvisa lo staff; un errore ferma la produzione */
export async function customerMessage(db: DB, token: string, body: string, kind: 'domanda' | 'errore', origin: string): Promise<string | null> {
	const c = await getByToken(db, token);
	if (!c) return 'Ordine non trovato.';
	if (!body.trim()) return kind === 'errore' ? 'Scrivi cosa non torna.' : 'Scrivi la domanda.';
	await db.from('order_messages').insert({ checkout_group: c.group.key, direction: 'in', kind, author: c.group.customer, body: body.trim() });
	await db.from('order_confirmations').update({ unread: true }).eq('checkout_group', c.group.key);
	if (kind === 'errore') {
		// la commessa si ferma finche' lo staff non sistema: torna "in attesa" senza fase
		await db.from('orders').update({ status: 'modifiche_richieste', prod_stage: null }).eq('checkout_group', c.group.key).in('status', ['in_produzione', 'attesa_pagamento']);
	}
	const title = kind === 'errore' ? `⚠ ${c.group.customer} segnala un errore sull'ordine ${c.group.number}` : `${c.group.customer} ha scritto sull'ordine ${c.group.number}`;
	await Promise.all([
		sendEmail({ to: OWNER_EMAIL, ...ownerNotifyEmail({ title, lines: [body.trim().slice(0, 300)], href: `${origin}/dashboard/fatturazione/ordini/${c.group.key}` }) }),
		pushStaff({ title, body: body.trim().slice(0, 120), url: `/dashboard/fatturazione/ordini/${c.group.key}`, tag: `order-${c.group.key}` })
	]);
	return null;
}
export async function replyCustomer(db: DB, group: string, body: string, author: string | null, origin: string): Promise<string | null> {
	if (!body.trim()) return 'Scrivi la risposta.';
	const g = await loadGroup(db, group);
	if (!g?.email) return "L'ordine non ha un'email.";
	const conf = await getConfirmation(db, group);
	await db.from('order_messages').insert({ checkout_group: group, direction: 'out', kind: 'risposta', author, body: body.trim() });
	const r = await sendEmail({ to: g.email, ...orderReplyEmail({ name: g.items[0].billing?.first_name || g.customer, number: g.number, body: body.trim(), author, href: `${origin}/conferma/${conf.token}` }) });
	if (!r.ok) return r.error ?? 'Email non inviata.';
	await db.from('order_confirmations').update({ unread: false }).eq('checkout_group', group);
	return null;
}
/** Promemoria di pagamento sulle scadenze anticipate ancora aperte (conferma inviata da almeno 2 giorni) */
export async function remindPayment(db: DB, group: string, origin: string): Promise<{ ok: boolean; message: string }> {
	const g = await loadGroup(db, group);
	if (!g?.email) return { ok: false, message: "L'ordine non ha un'email." };
	const payments = await loadPayments(db, group);
	const due = upfrontDue(payments);
	if (due <= 0) return { ok: false, message: 'Non ci sono anticipi da incassare.' };
	const conf = await getConfirmation(db, group);
	const r = await sendEmail({ to: g.email, ...orderPaymentReminderEmail({ name: g.items[0].billing?.first_name || g.customer, number: g.number, amount: money(due), href: `${origin}/conferma/${conf.token}`, senderName: conf.sender_name }) });
	return r.ok ? { ok: true, message: 'Promemoria inviato.' } : { ok: false, message: r.error ?? 'Email non inviata.' };
}
export async function confirmCounts(db: DB): Promise<number> {
	const { count } = await db.from('order_confirmations').select('checkout_group', { count: 'exact', head: true }).eq('unread', true);
	return count ?? 0;
}
export type { PaymentMethod };
