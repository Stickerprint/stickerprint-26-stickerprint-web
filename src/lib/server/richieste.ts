/**
 * Aziende: richieste dal modulo /aziende → preventivo (stessa bozza dell'editor ordini) → ordine.
 * Il preventivo ha un link pubblico con token: il cliente lo accetta con un clic.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { money } from '$lib/dashboard/orders';
import { draftTotals, emptyDraft, type OrderDraft } from '$lib/dashboard/orderDraft';
import { buildOrderPdf } from './docs';
import { sendEmail } from './email';
import { OWNER_EMAIL, ownerNotifyEmail, quoteAcceptedEmail, quoteEmail, quoteReminderEmail, quoteReplyEmail } from './email-templates';
import { loadEditorData, saveOrderDraft, sendOrderConfirmation, upsertContact } from './orders';
import { pushStaff } from './push';
import { ensurePlan } from './produzione';
import type { OrderRow } from '$lib/dashboard/orders';

export * from '$lib/dashboard/richieste';
import { QUOTE_VALID_DAYS, QUOTE_REMIND_DAYS, REQUEST_STATUS, type ContactRequest, type Quote, type QuoteMessage, type QuoteStatus } from '$lib/dashboard/richieste';
type DB = SupabaseClient;
export const toB64 = (bytes: Uint8Array) => { let s = ''; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000)); return btoa(s); };
const today = () => new Date().toISOString().slice(0, 10);
const addDays = (d: string, n: number) => { const x = new Date(d + 'T12:00:00'); x.setDate(x.getDate() + n); return x.toISOString().slice(0, 10); };
const itDate = (d: string | null) => (d ? new Date(d + 'T12:00:00').toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' }) : null);

/* ---------- richieste ---------- */
export async function listRequests(db: DB): Promise<ContactRequest[]> {
	const { data } = await db.from('contact_requests').select('*').eq('kind', 'aziende').order('created_at', { ascending: false }).limit(500);
	return (data ?? []) as ContactRequest[];
}
export async function getRequest(db: DB, id: string): Promise<ContactRequest | null> {
	const { data } = await db.from('contact_requests').select('*').eq('id', id).maybeSingle();
	return (data as ContactRequest | null) ?? null;
}
export async function markRequestRead(db: DB, id: string) { await db.from('contact_requests').update({ read_at: new Date().toISOString() }).eq('id', id).is('read_at', null); }
export async function setRequestStatus(db: DB, id: string, status: string) {
	if (!(status in REQUEST_STATUS)) return 'Stato non valido.';
	const { error } = await db.from('contact_requests').update({ status }).eq('id', id);
	return error?.message ?? null;
}
export async function setRequestNotes(db: DB, id: string, notes: string) {
	const { error } = await db.from('contact_requests').update({ notes: notes.trim() || null }).eq('id', id);
	return error?.message ?? null;
}
/** Il richiedente entra in anagrafica (o si aggancia a un contatto con la stessa email) */
export async function linkRequestContact(db: DB, r: ContactRequest): Promise<{ id: string | null; error?: string }> {
	const [fn, ...ln] = (r.name ?? '').split(' ');
	const res = await upsertContact(db, { name: r.company || r.name || r.email, first_name: fn ?? '', last_name: ln.join(' '), address: '', city: '', cap: '', province: '', country: 'IT', piva: '', cf: '', sdi: '', pec: '', email: r.email, phone: r.phone ?? '' }, r.contact_id);
	if (res.id) await db.from('contact_requests').update({ contact_id: res.id }).eq('id', r.id);
	return res;
}
/** Bozza di preventivo precompilata dalla richiesta */
export function draftFromRequest(r: ContactRequest): OrderDraft {
	const d = emptyDraft();
	const [fn, ...ln] = (r.name ?? '').split(' ');
	d.customer = { ...d.customer, name: r.company || r.name || '', first_name: fn ?? '', last_name: ln.join(' '), email: r.email, phone: r.phone ?? '' };
	d.contact_id = r.contact_id;
	d.notes = `Richiesta dal sito: ${r.message}`.slice(0, 600);
	d.items = [];
	return d;
}

/* ---------- preventivi ---------- */
async function nextQuoteNumber(db: DB): Promise<{ year: number; seq: number; number: string }> {
	const year = new Date().getFullYear();
	const { data } = await db.from('quotes').select('seq').eq('year', year).order('seq', { ascending: false }).limit(1).maybeSingle();
	const seq = (Number(data?.seq) || 0) + 1;
	return { year, seq, number: `SPP${String(seq).padStart(5, '0')}` };
}
export async function listQuotes(db: DB, year: number): Promise<Quote[]> {
	// i preventivi inviati oltre la validita' diventano scaduti
	await db.from('quotes').update({ status: 'scaduto' }).eq('status', 'inviato').lt('valid_until', today());
	const { data } = await db.from('quotes').select('*').eq('year', year).order('seq', { ascending: false });
	return (data ?? []) as Quote[];
}
export async function getQuote(db: DB, id: string): Promise<Quote | null> {
	const { data } = await db.from('quotes').select('*').eq('id', id).maybeSingle();
	return (data as Quote | null) ?? null;
}
export async function getQuoteByToken(db: DB, token: string): Promise<Quote | null> {
	if (!/^[0-9a-f-]{36}$/.test(token)) return null;
	const { data } = await db.from('quotes').select('*').eq('token', token).maybeSingle();
	return (data as Quote | null) ?? null;
}
/** Crea (id null) o aggiorna un preventivo: la bozza e' quella dell'editor ordini */
export async function saveQuote(db: DB, d: OrderDraft, id: string | null, extra: { request_id?: string | null } = {}): Promise<{ id: string; number: string; error?: string }> {
	const name = (d.customer.name || [d.customer.first_name, d.customer.last_name].filter(Boolean).join(' ')).trim();
	if (!name) return { id: id ?? '', number: '', error: 'Inserisci almeno il nome del cliente.' };
	const t = draftTotals(d);
	const patch = { draft: d, contact_id: d.contact_id || null, total_net: t.net, total_gross: t.tot, updated_at: new Date().toISOString() };
	if (id) {
		const { data, error } = await db.from('quotes').update(patch).eq('id', id).select('id, number').single();
		return { id, number: data?.number ?? '', error: error?.message };
	}
	for (let attempt = 0; attempt < 3; attempt++) {
		const n = await nextQuoteNumber(db);
		const { data, error } = await db.from('quotes').insert({ ...patch, ...n, request_id: extra.request_id ?? null, valid_until: addDays(today(), QUOTE_VALID_DAYS) }).select('id, number').single();
		if (!error && data) {
			if (extra.request_id) await db.from('contact_requests').update({ quote_id: data.id, status: 'in_progress' }).eq('id', extra.request_id).in('status', ['new', 'in_progress']);
			return { id: data.id, number: data.number };
		}
		if (error?.code !== '23505') return { id: '', number: '', error: error?.message };
	}
	return { id: '', number: '', error: 'Numero di preventivo non disponibile, riprova.' };
}
export async function setQuoteValidity(db: DB, id: string, day: string) {
	if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return 'Data non valida.';
	const { error } = await db.from('quotes').update({ valid_until: day, updated_at: new Date().toISOString() }).eq('id', id);
	return error?.message ?? null;
}
export async function quotePdf(q: Quote): Promise<Uint8Array> {
	const d = q.draft; const c = d.customer; const t = draftTotals(d);
	const lordi = d.price_type === 'lordi';
	const billing = { company: c.name, first_name: c.first_name, last_name: c.last_name, street: c.address, city: c.city, zip: c.cap, province: c.province, country: c.country, vat: c.piva };
	const sh = d.ship_same !== false ? billing : { company: d.shipping.name || c.name, first_name: '', last_name: '', street: d.shipping.address, city: d.shipping.city, zip: d.shipping.cap, province: d.shipping.province, country: d.shipping.country, vat: '' };
	return buildOrderPdf({
		kind: 'preventivo', valid_until: q.valid_until, number: q.number + (q.version > 1 ? ` rev. ${q.version}` : ''), numbers: [q.number], issued_at: q.created_at, customer: billing, shipping: sh, email: c.email || null,
		lines: d.items.filter((i) => Number(i.qty) > 0).map((i) => { const unit = lordi ? Number(i.price) / 1.22 : Number(i.price); return { description: `${i.code ? i.code + ' · ' : ''}${i.description}`.trim(), qty: Number(i.qty), unit_net: unit, total_net: Math.round(unit * Number(i.qty) * 100) / 100 }; }),
		subtotal_net: t.net, vat_amount: t.iva, total_gross: t.tot, payment_method: [...new Set((d.terms ?? []).map((x) => x.method))].join(' + ') || '', payment_terms: (d.terms ?? []).map((x) => ({ due: x.due, amount: x.amount, method: x.method })),
		shipping_method: d.ship_method, delivery_date: d.ship_date || null, notes: d.notes?.replace(/^Richiesta dal sito:.*$/s, '') || null
	});
}
/** Invia il preventivo: email scritta dallo staff con il solo bottone "Apri il preventivo" (niente allegato) */
export async function sendQuote(db: DB, id: string, origin: string, o: { to?: string | null; cc?: string | null; subject: string; message: string; sender: string | null; autoRemind: boolean }): Promise<{ ok: boolean; message: string }> {
	const q = await getQuote(db, id);
	if (!q) return { ok: false, message: 'Preventivo non trovato.' };
	const email = (o.to || q.draft.customer.email || '').trim().toLowerCase();
	if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { ok: false, message: 'Indirizzo email del cliente non valido.' };
	if (!q.draft.items.some((i) => Number(i.qty) > 0)) return { ok: false, message: 'Aggiungi almeno un articolo.' };
	if (!o.subject.trim() || !o.message.trim()) return { ok: false, message: 'Oggetto e testo dell\'email sono obbligatori.' };
	const validUntil = q.valid_until ?? addDays(today(), QUOTE_VALID_DAYS);
	const mail = quoteEmail({ subject: o.subject.trim(), message: o.message.trim(), senderName: o.sender, number: q.number, validUntil: itDate(validUntil), href: `${origin}/preventivo/${q.token}` });
	const cc = (o.cc || '').split(/[,;\s]+/).map((x) => x.trim().toLowerCase()).filter((x) => /^[^@]+@[^@]+\.[^@]+$/.test(x));
	const r = await sendEmail({ to: [email, ...cc], ...mail, metadata: { quote: q.number } });
	if (!r.ok) return { ok: false, message: r.error ?? 'Email non inviata.' };
	await db.from('quotes').update({ status: 'inviato', sent_at: new Date().toISOString(), valid_until: validUntil, sent_subject: o.subject.trim(), sent_message: o.message.trim(), sender_name: o.sender, auto_remind: o.autoRemind, reminded_at: null, updated_at: new Date().toISOString() }).eq('id', id);
	if (q.request_id) await db.from('contact_requests').update({ status: 'quoted' }).eq('id', q.request_id).in('status', ['new', 'in_progress']);
	return { ok: true, message: r.skipped ? 'Postmark non configurato: email simulata.' : `Preventivo inviato a ${email}${cc.length ? ` (copia a ${cc.join(', ')})` : ''}.` };
}
export async function remindQuote(db: DB, id: string, origin: string): Promise<{ ok: boolean; message: string }> {
	const q = await getQuote(db, id);
	if (!q || q.status !== 'inviato') return { ok: false, message: 'Solo i preventivi inviati si possono sollecitare.' };
	const mail = quoteReminderEmail({ name: q.draft.customer.first_name || q.draft.customer.name, number: q.number, validUntil: itDate(q.valid_until), href: `${origin}/preventivo/${q.token}`, senderName: q.sender_name });
	const r = await sendEmail({ to: q.draft.customer.email, ...mail });
	if (!r.ok) return { ok: false, message: r.error ?? 'Email non inviata.' };
	await db.from('quotes').update({ reminded_at: new Date().toISOString() }).eq('id', id);
	return { ok: true, message: 'Sollecito inviato.' };
}
/** Sollecito automatico: inviati da QUOTE_REMIND_DAYS giorni, senza risposta ne' domande, con il promemoria attivo */
let lastAutoRemind = 0;
export async function remindDueQuotes(db: DB, origin: string, force = false): Promise<string[]> {
	if (!force && Date.now() - lastAutoRemind < 20 * 60 * 1000) return [];
	lastAutoRemind = Date.now();
	const since = new Date(Date.now() - QUOTE_REMIND_DAYS * 864e5).toISOString();
	const { data } = await db.from('quotes').select('id, number').eq('status', 'inviato').eq('auto_remind', true).is('reminded_at', null).lt('sent_at', since);
	const sent: string[] = [];
	for (const q of data ?? []) {
		const { count } = await db.from('quote_messages').select('id', { count: 'exact', head: true }).eq('quote_id', q.id).eq('direction', 'in');
		if (count) continue; // ha scritto: se ne occupa lo staff
		const r = await remindQuote(db, q.id, origin);
		if (r.ok) sent.push(q.number);
	}
	return sent;
}

/* ---------- pagina del cliente: aperture, PDF, domande ---------- */
export async function trackQuoteOpen(db: DB, q: Quote) {
	await db.from('quotes').update({ opened_count: (q.opened_count ?? 0) + 1, opened_at: new Date().toISOString() }).eq('id', q.id);
}
export async function trackQuotePdf(db: DB, id: string) { await db.from('quotes').update({ pdf_downloaded_at: new Date().toISOString() }).eq('id', id); }
export async function loadQuoteMessages(db: DB, id: string): Promise<QuoteMessage[]> {
	const { data } = await db.from('quote_messages').select('*').eq('quote_id', id).order('created_at');
	return (data ?? []) as QuoteMessage[];
}
/** Domanda del cliente dalla pagina (client di servizio): entra nel preventivo, avvisa lo staff */
export async function quoteQuestionByToken(db: DB, token: string, body: string, origin: string, kind: 'domanda' | 'aggiornamento' = 'domanda'): Promise<string | null> {
	const q = await getQuoteByToken(db, token);
	if (!q) return 'Preventivo non trovato.';
	const text = kind === 'aggiornamento' ? `Chiede un preventivo aggiornato${body.trim() ? `: ${body.trim()}` : '.'}` : body.trim();
	if (!text) return 'Scrivi la domanda.';
	await db.from('quote_messages').insert({ quote_id: q.id, direction: 'in', author: q.draft.customer.name, body: text });
	await db.from('quotes').update({ unread: true, updated_at: new Date().toISOString() }).eq('id', q.id);
	await Promise.all([
		sendEmail({ to: OWNER_EMAIL, ...ownerNotifyEmail({ title: `${q.draft.customer.name} ha scritto sul preventivo ${q.number}`, lines: [text.slice(0, 300)], href: `${origin}/dashboard/aziende/preventivi/${q.id}` }) }),
		pushStaff({ title: `Domanda sul preventivo ${q.number}`, body: text.slice(0, 120), url: `/dashboard/aziende/preventivi/${q.id}`, tag: `quote-${q.id}` })
	]);
	return null;
}
/** Risposta dello staff: messaggio + email con lo stesso link */
export async function replyQuote(db: DB, id: string, body: string, author: string | null, origin: string): Promise<string | null> {
	if (!body.trim()) return 'Scrivi la risposta.';
	const q = await getQuote(db, id);
	if (!q) return 'Preventivo non trovato.';
	await db.from('quote_messages').insert({ quote_id: id, direction: 'out', author, body: body.trim() });
	const r = await sendEmail({ to: q.draft.customer.email, ...quoteReplyEmail({ name: q.draft.customer.first_name || q.draft.customer.name, number: q.number, body: body.trim(), author, href: `${origin}/preventivo/${q.token}` }) });
	if (!r.ok) return r.error ?? 'Email non inviata.';
	await db.from('quotes').update({ unread: false, updated_at: new Date().toISOString() }).eq('id', id);
	return null;
}
export async function markQuoteRead(db: DB, id: string) { await db.from('quotes').update({ unread: false }).eq('id', id).eq('unread', true); }

/** Nuova versione: copia in bozza con lo stesso numero (rev. 2, 3…); la precedente resta in archivio */
export async function newQuoteVersion(db: DB, id: string): Promise<{ id: string | null; error?: string }> {
	const q = await getQuote(db, id);
	if (!q) return { id: null, error: 'Preventivo non trovato.' };
	const { data: last } = await db.from('quotes').select('version').eq('year', q.year).eq('seq', q.seq).order('version', { ascending: false }).limit(1).maybeSingle();
	const version = (Number(last?.version) || q.version) + 1;
	const { data, error } = await db.from('quotes').insert({ year: q.year, seq: q.seq, number: q.number, version, parent_id: q.id, request_id: q.request_id, contact_id: q.contact_id, draft: q.draft, total_net: q.total_net, total_gross: q.total_gross, valid_until: addDays(today(), QUOTE_VALID_DAYS) }).select('id').single();
	if (error) return { id: null, error: error.message };
	if (q.status === 'inviato' || q.status === 'bozza') await db.from('quotes').update({ status: q.status === 'bozza' ? 'rifiutato' : 'scaduto', rejected_reason: `Sostituito dalla rev. ${version}`, updated_at: new Date().toISOString() }).eq('id', q.id);
	return { id: data?.id ?? null };
}
export async function setQuoteStatus(db: DB, id: string, status: QuoteStatus, reason?: string | null) {
	const patch: Record<string, unknown> = { status, updated_at: new Date().toISOString() };
	if (status === 'rifiutato') patch.rejected_reason = reason ?? null;
	if (status === 'accettato') { patch.accepted_at = new Date().toISOString(); patch.accepted_by = reason ?? 'staff'; }
	const { error } = await db.from('quotes').update(patch).eq('id', id);
	if (!error) {
		const q = await getQuote(db, id);
		if (q?.request_id && status === 'rifiutato') await db.from('contact_requests').update({ status: 'lost' }).eq('id', q.request_id);
	}
	return error?.message ?? null;
}
/** Accettazione dal link pubblico (client di servizio): stato, avviso allo staff, conferma al cliente */
export async function acceptQuoteByToken(db: DB, token: string, who: string, origin: string): Promise<{ ok: boolean; message: string }> {
	const q = await getQuoteByToken(db, token);
	if (!q) return { ok: false, message: 'Preventivo non trovato.' };
	if (q.status === 'accettato' || q.status === 'ordinato') return { ok: true, message: 'Preventivo già confermato.' };
	if (q.status !== 'inviato') return { ok: false, message: 'Questo preventivo non è più valido: scrivici e te ne mandiamo uno aggiornato.' };
	await db.from('quotes').update({ status: 'accettato', accepted_at: new Date().toISOString(), accepted_by: who || q.draft.customer.email, updated_at: new Date().toISOString() }).eq('id', q.id);
	const owner = ownerNotifyEmail({ title: `Preventivo ${q.number} accettato da ${q.draft.customer.name}`, lines: [`Totale ${money(Number(q.total_gross))} IVA inclusa`, `Cliente: ${q.draft.customer.name} · ${q.draft.customer.email}`, 'Crea l’ordine dalla dashboard: Aziende › Preventivi.'], href: `${origin}/dashboard/aziende/preventivi/${q.id}` });
	await Promise.all([
		sendEmail({ to: OWNER_EMAIL, ...owner }),
		sendEmail({ to: q.draft.customer.email, ...quoteAcceptedEmail({ name: q.draft.customer.first_name || q.draft.customer.name, number: q.number, orderNumber: null }) }),
		pushStaff({ title: `Preventivo ${q.number} accettato`, body: `${q.draft.customer.name} · ${money(Number(q.total_gross))}`, url: `/dashboard/aziende/preventivi/${q.id}`, tag: `quote-${q.id}` })
	]);
	return { ok: true, message: 'Preventivo confermato.' };
}
export async function rejectQuoteByToken(db: DB, token: string, reason: string): Promise<{ ok: boolean; message: string }> {
	const q = await getQuoteByToken(db, token);
	if (!q) return { ok: false, message: 'Preventivo non trovato.' };
	if (q.status !== 'inviato') return { ok: false, message: 'Il preventivo non è più modificabile.' };
	await db.from('quotes').update({ status: 'rifiutato', rejected_reason: reason.trim() || 'Rifiutato dal cliente', updated_at: new Date().toISOString() }).eq('id', q.id);
	if (q.request_id) await db.from('contact_requests').update({ status: 'lost' }).eq('id', q.request_id);
	await sendEmail({ to: OWNER_EMAIL, ...ownerNotifyEmail({ title: `Preventivo ${q.number} rifiutato`, lines: [`Cliente: ${q.draft.customer.name}`, `Motivo: ${reason.trim() || '—'}`] }) });
	return { ok: true, message: 'Grazie, abbiamo registrato la tua risposta.' };
}
/** Da preventivo accettato a ordine manuale (entra in produzione a lavorazioni) */
export async function orderFromQuote(db: DB, id: string, sendMail: boolean): Promise<{ group: string | null; number: string | null; message: string }> {
	const q = await getQuote(db, id);
	if (!q) return { group: null, number: null, message: 'Preventivo non trovato.' };
	if (q.order_group) return { group: q.order_group, number: null, message: 'Ordine già creato.' };
	const ed = await loadEditorData(db);
	const d: OrderDraft = { ...q.draft, date: today(), notes: [`Da preventivo ${q.number}`, q.draft.notes].filter(Boolean).join(' · ') };
	const r = await saveOrderDraft(db, d, null, ed);
	if (r.error) return { group: null, number: null, message: r.error };
	await db.from('quotes').update({ status: 'ordinato', order_group: r.group, updated_at: new Date().toISOString() }).eq('id', id);
	if (q.request_id) await db.from('contact_requests').update({ status: 'won' }).eq('id', q.request_id);
	const { data: rows } = await db.from('orders').select('*').eq('checkout_group', r.group);
	await ensurePlan(db, (rows ?? []) as OrderRow[]);
	let message = 'Conferma non inviata (scelta dello staff).';
	if (sendMail) { const m = await sendOrderConfirmation(db, r.group); message = m.message; }
	return { group: r.group, number: r.numbers[0], message };
}

/** contatori del menu: richieste nuove + preventivi inviati senza risposta da QUOTE_REMIND_DAYS giorni */
export async function aziendeCounts(db: DB): Promise<{ nuove: number; daSollecitare: number }> {
	const since = new Date(Date.now() - QUOTE_REMIND_DAYS * 864e5).toISOString();
	const [{ count: nuove }, { count: sol }, { count: unread }] = await Promise.all([
		db.from('contact_requests').select('id', { count: 'exact', head: true }).eq('kind', 'aziende').eq('status', 'new'),
		db.from('quotes').select('id', { count: 'exact', head: true }).eq('status', 'inviato').lt('sent_at', since).is('reminded_at', null).eq('auto_remind', false),
		db.from('quotes').select('id', { count: 'exact', head: true }).eq('unread', true)
	]);
	return { nuove: nuove ?? 0, daSollecitare: (sol ?? 0) + (unread ?? 0) };
}
