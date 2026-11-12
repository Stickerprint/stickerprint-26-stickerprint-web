/**
 * Fattura come pagina del cliente (/fattura/[token]): scadenze pagabili online (bonifici) o solo informative (ricevute bancarie),
 * email scritta dallo staff, domande dalla pagina, aperture.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { money } from '$lib/dashboard/orders';
import { LOCALES, isLocale, langOf, localizePath, type Lang, type LocaleCode } from '$lib/i18n';
import { perLingua, t as tradotto } from '$lib/traduzioni';
import { dueNow, isRiba, type InvoiceMessage, type InvoicePayment } from '$lib/dashboard/fatture';
import { sendEmail } from './email';
import { invoiceEmail, invoiceReplyEmail, OWNER_EMAIL, ownerNotifyEmail } from './email-templates';
import { pushStaff } from './push';
import { buildInvoicePdf, aliquotaFattura, type InvoiceData, type InvoiceLine } from './invoice';
export * from '$lib/dashboard/fatture';

type DB = SupabaseClient;
export interface InvoiceRow { id: string; number: string; issued_at: string; email: string | null; billing: Record<string, string> | null; lines: InvoiceLine[] | null; vat_rate?: number | null; natura?: string | null; currency?: string | null; ddt_number?: string | null; ddt_numbers?: string[] | null; subtotal_net: number; discount_net: number; express_net: number; vat_amount: number; amount_gross: number; payment_method: string; payment_terms: { method: string; due: string; amount: number; xml_code?: string }[] | null; order_numbers: string[] | null; checkout_group: string | null; user_id: string | null; pdf_path: string | null; paid_at: string | null; sent_at: string | null; token: string; sent_subject: string | null; sent_message: string | null; sender_name: string | null; opened_count: number; opened_at: string | null; pdf_downloaded_at: string | null; unread: boolean; notes: string | null }

export async function getInvoice(db: DB, id: string): Promise<InvoiceRow | null> {
	const { data } = await db.from('invoices').select('*').eq('id', id).maybeSingle();
	return (data as InvoiceRow | null) ?? null;
}
/* ---------- lingua del cliente e PDF: UN SOLO punto da cui passano pagina del cliente, invio, reinvio e modifica ---------- */
/** Lingua dal paese di fatturazione: Italia (e paesi del sito italiano) = italiano; un paese con la sua lingua sul sito = quella; ogni altro paese = inglese */
export function linguaDaPaese(country?: string | null): Lang {
	const c = (country || 'IT').trim().toUpperCase();
	return Object.values(LOCALES).find((l) => l.countries.includes(c))?.lang ?? 'en';
}
/** Lingua della fattura per il cliente: quella del sito da cui ha ordinato (orders.locale); senza un ordine del sito (ordini manuali, DDT)
 *  il paese di fatturazione. Insieme, quanto ha pagato nella sua valuta se non e' l'euro (sito USA). */
export async function linguaFattura(db: DB, inv: Pick<InvoiceRow, 'order_numbers' | 'billing'>): Promise<{ lang: Lang; locale: LocaleCode; pagato: { currency: string; amount: number } | null }> {
	let code: LocaleCode | null = null; let pagato: { currency: string; amount: number } | null = null;
	const nums = (inv.order_numbers ?? []).filter(Boolean);
	if (nums.length) {
		const { data, error } = await db.from('orders').select('locale, currency, total_paid_currency').in('number', nums);
		if (!error && data?.length) {
			const rows = data as { locale: string | null; currency: string | null; total_paid_currency: number | null }[];
			const loc = rows.map((r) => r.locale).find((l) => isLocale(l));
			if (isLocale(loc)) code = loc;
			const cur = rows.map((r) => r.currency).find((c) => c && c !== 'EUR');
			if (cur) { const amount = Math.round(rows.filter((r) => r.currency === cur).reduce((s, r) => s + Number(r.total_paid_currency ?? 0), 0) * 100) / 100; if (amount > 0) pagato = { currency: cur, amount }; }
		}
	}
	const lang = code ? langOf(code) : linguaDaPaese(inv.billing?.country);
	return { lang, locale: code ?? perLingua(lang), pagato };
}
/** Dati del PDF a partire dalla fattura registrata: aliquota e natura REGISTRATE (0% per l'estero), lingua del cliente. `over` = valori appena modificati. */
export async function datiPdfFattura(db: DB, inv: InvoiceRow, over: Partial<InvoiceData> = {}): Promise<InvoiceData> {
	const l = await linguaFattura(db, { order_numbers: inv.order_numbers, billing: (over.billing as Record<string, string> | undefined) ?? inv.billing });
	return {
		number: inv.number, issued_at: inv.issued_at, email: inv.email ?? '', billing: inv.billing ?? {}, lines: inv.lines ?? [],
		vat_rate: aliquotaFattura(inv.vat_rate), natura: inv.natura ?? null, lang: l.lang, paid_currency: l.pagato,
		subtotal_net: Number(inv.subtotal_net), discount_net: Number(inv.discount_net), express_net: Number(inv.express_net), credit_used: 0,
		vat_amount: Number(inv.vat_amount), total_gross: Number(inv.amount_gross), to_pay: Number(inv.amount_gross), payment_method: inv.payment_method,
		orders: inv.order_numbers ?? [], payment_terms: inv.payment_terms ?? [], ddt_numbers: inv.ddt_numbers?.length ? inv.ddt_numbers : inv.ddt_number ? [inv.ddt_number] : [], notes: inv.notes,
		...over
	};
}
/** PDF della fattura rigenerato dai dati registrati (sempre l'ultima versione del layout), con il nome del file nella lingua del cliente */
export async function pdfFattura(db: DB, inv: InvoiceRow, over: Partial<InvoiceData> = {}): Promise<{ bytes: Uint8Array; nome: string; lang: Lang; locale: LocaleCode }> {
	const dati = await datiPdfFattura(db, inv, over);
	const lang = dati.lang ?? 'it';
	return { bytes: await buildInvoicePdf(dati), nome: tradotto(perLingua(lang), 'account.doc.fileFattura', { n: inv.number }), lang, locale: perLingua(lang) };
}

/** Scadenze della fattura → righe di pagamento (le pagate restano). Fatture e-commerce gia' incassate: una riga pagata. */
export async function syncInvoicePayments(db: DB, inv: InvoiceRow): Promise<InvoicePayment[]> {
	const terms = (inv.payment_terms?.length ? inv.payment_terms : [{ method: inv.payment_method || 'Bonifico bancario vista fattura', due: inv.issued_at, amount: Number(inv.amount_gross), xml_code: 'MP05' }])
		.map((t, i) => ({ seq: i + 1, method: t.method, xml_code: t.xml_code ?? null, due: t.due, amount: Number(t.amount), payable: !isRiba(t.method, t.xml_code) }));
	const { data: existing } = await db.from('invoice_payments').select('*').eq('invoice_id', inv.id);
	const paidSeq = new Set(((existing ?? []) as InvoicePayment[]).filter((p) => p.status === 'pagato').map((p) => p.seq));
	await db.from('invoice_payments').delete().eq('invoice_id', inv.id).neq('status', 'pagato');
	const online = ['paypal', 'stripe', 'test'].includes(inv.payment_method) || !!inv.paid_at;
	const rows = terms.filter((t) => !paidSeq.has(t.seq)).map((t) => ({ ...t, invoice_id: inv.id, ...(online ? { status: 'pagato', paid_at: inv.paid_at ?? inv.issued_at, provider: inv.payment_method, note: 'pagata al checkout' } : {}) }));
	if (rows.length) await db.from('invoice_payments').insert(rows);
	return loadInvoicePayments(db, inv.id);
}
export async function loadInvoicePayments(db: DB, id: string): Promise<InvoicePayment[]> {
	const { data } = await db.from('invoice_payments').select('*').eq('invoice_id', id).order('seq');
	return (data ?? []) as InvoicePayment[];
}
export async function loadInvoiceMessages(db: DB, id: string): Promise<InvoiceMessage[]> {
	const { data } = await db.from('invoice_messages').select('*').eq('invoice_id', id).order('created_at');
	return (data ?? []) as InvoiceMessage[];
}
export async function markInvoiceRead(db: DB, id: string) { await db.from('invoices').update({ unread: false }).eq('id', id).eq('unread', true); }

/** Invio: email scritta dallo staff con il bottone "Apri la fattura"; niente allegato */
export async function sendInvoice(db: DB, id: string, origin: string, o: { to?: string | null; cc?: string | null; subject: string; message: string; sender: string | null }): Promise<{ ok: boolean; message: string }> {
	const inv = await getInvoice(db, id);
	if (!inv) return { ok: false, message: 'Fattura non trovata.' };
	const email = (o.to || inv.email || '').trim().toLowerCase();
	if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { ok: false, message: 'Indirizzo email del cliente non valido.' };
	if (!o.subject.trim() || !o.message.trim()) return { ok: false, message: "Oggetto e testo dell'email sono obbligatori." };
	const payments = await syncInvoicePayments(db, inv);
	const due = dueNow(payments);
	/* lingua del cliente: cornice dell'email, pagina (link col prefisso della lingua) e PDF allegato */
	const lingua = await linguaFattura(db, inv);
	const mail = invoiceEmail({ subject: o.subject.trim(), message: o.message.trim(), senderName: o.sender, number: inv.number, href: `${origin}${localizePath(`/fattura/${inv.token}`, lingua.locale)}`, toPay: due > 0 ? money(due) : null }, lingua.lang);
	const cc = (o.cc || '').split(/[,;\s]+/).map((x) => x.trim().toLowerCase()).filter((x) => /^[^@]+@[^@]+\.[^@]+$/.test(x));
	/* il PDF della fattura viaggia sempre in allegato (rigenerato dai dati, cosi' e' sempre l'ultima versione) */
	let attachments: { name: string; content: string; contentType: string }[] | undefined;
	try {
		const { bytes, nome } = await pdfFattura(db, inv);
		let b = ''; for (let i = 0; i < bytes.length; i += 0x8000) b += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
		attachments = [{ name: nome, content: btoa(b), contentType: 'application/pdf' }];
		if (inv.pdf_path) await db.storage.from('invoices').upload(inv.pdf_path, bytes, { contentType: 'application/pdf', upsert: true }).catch(() => {});
	} catch (e) { console.error('[fattura] pdf allegato', e); }
	const r = await sendEmail({ to: [email, ...cc], ...mail, attachments, metadata: { invoice: inv.number } });
	if (!r.ok) return { ok: false, message: r.error ?? 'Email non inviata.' };
	await db.from('invoices').update({ sent_at: new Date().toISOString(), sent_subject: o.subject.trim(), sent_message: o.message.trim(), sender_name: o.sender, email: inv.email || email }).eq('id', id);
	return { ok: true, message: r.skipped ? 'Postmark non configurato: email simulata.' : `Fattura inviata a ${email}${cc.length ? ` (copia a ${cc.join(', ')})` : ''}.` };
}
export async function setInvoicePaymentStatus(db: DB, id: string, seq: number, status: 'pagato' | 'da_pagare', operator: string | null, ref?: string | null, provider = 'manuale'): Promise<string | null> {
	const patch = status === 'pagato' ? { status, paid_at: new Date().toISOString(), provider, provider_ref: ref || null, note: operator ? `segnato da ${operator}` : provider === 'stripe' || provider === 'paypal' ? 'incassato online' : provider === 'simulazione' ? 'pagamento simulato (prova)' : null } : { status, paid_at: null, provider: null, provider_ref: null, note: null };
	const { error } = await db.from('invoice_payments').update(patch).eq('invoice_id', id).eq('seq', seq);
	if (error) return error.message;
	const payments = await loadInvoicePayments(db, id);
	const allPaid = payments.length > 0 && payments.every((p) => p.status === 'pagato');
	await db.from('invoices').update({ paid_at: allPaid ? new Date().toISOString() : null }).eq('id', id);
	return null;
}

/* ---------- pagina del cliente ---------- */
export async function getInvoiceByToken(db: DB, token: string): Promise<{ inv: InvoiceRow; payments: InvoicePayment[]; messages: InvoiceMessage[] } | null> {
	if (!/^[0-9a-f-]{36}$/.test(token)) return null;
	const { data } = await db.from('invoices').select('*').eq('token', token).maybeSingle();
	if (!data) return null;
	const inv = data as InvoiceRow;
	let payments = await loadInvoicePayments(db, inv.id);
	if (!payments.length) payments = await syncInvoicePayments(db, inv);
	return { inv, payments, messages: await loadInvoiceMessages(db, inv.id) };
}
export async function trackInvoiceOpen(db: DB, inv: InvoiceRow) { await db.from('invoices').update({ opened_count: (inv.opened_count ?? 0) + 1, opened_at: new Date().toISOString() }).eq('id', inv.id); }
export async function trackInvoicePdf(db: DB, id: string) { await db.from('invoices').update({ pdf_downloaded_at: new Date().toISOString() }).eq('id', id); }
/** Domanda del cliente dalla pagina pubblica: i messaggi di errore nella sua lingua (`lang`) */
export async function invoiceQuestion(db: DB, token: string, body: string, origin: string, lang: Lang = 'it'): Promise<string | null> {
	const T = (k: string) => tradotto(perLingua(lang), `account.${k}`);
	const c = await getInvoiceByToken(db, token);
	if (!c) return T('errori.fatturaNonTrovata');
	if (!body.trim()) return T('errori.scriviDomanda');
	const who = c.inv.billing?.company || `${c.inv.billing?.first_name ?? ''} ${c.inv.billing?.last_name ?? ''}`.trim() || c.inv.email || 'Cliente';
	await db.from('invoice_messages').insert({ invoice_id: c.inv.id, direction: 'in', author: who, body: body.trim() });
	await db.from('invoices').update({ unread: true }).eq('id', c.inv.id);
	await Promise.all([
		sendEmail({ to: OWNER_EMAIL, ...ownerNotifyEmail({ title: `${who} ha scritto sulla fattura ${c.inv.number}`, lines: [body.trim().slice(0, 300)], href: `${origin}/dashboard/fatturazione/fatture/${c.inv.id}` }) }),
		pushStaff({ title: `Domanda sulla fattura ${c.inv.number}`, body: body.trim().slice(0, 120), url: `/dashboard/fatturazione/fatture/${c.inv.id}`, tag: `invoice-${c.inv.id}` })
	]);
	return null;
}
export async function replyInvoice(db: DB, id: string, body: string, author: string | null, origin: string): Promise<string | null> {
	if (!body.trim()) return 'Scrivi la risposta.';
	const inv = await getInvoice(db, id);
	if (!inv?.email) return "La fattura non ha un'email.";
	await db.from('invoice_messages').insert({ invoice_id: id, direction: 'out', author, body: body.trim() });
	const r = await sendEmail({ to: inv.email, ...invoiceReplyEmail({ name: inv.billing?.first_name || inv.billing?.company, number: inv.number, body: body.trim(), author, href: `${origin}/fattura/${inv.token}` }) });
	if (!r.ok) return r.error ?? 'Email non inviata.';
	await db.from('invoices').update({ unread: false }).eq('id', id);
	return null;
}
export async function invoiceCounts(db: DB): Promise<number> {
	const { count } = await db.from('invoices').select('id', { count: 'exact', head: true }).eq('unread', true);
	return count ?? 0;
}
