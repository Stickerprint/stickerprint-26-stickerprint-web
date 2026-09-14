/**
 * Helpdesk: ticket (supporto, resi, lamentele) con conversazione via email e pagina pubblica per il cliente.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { adminClient } from './admin';
import { sendEmail } from './email';
import { OWNER_EMAIL, ownerNotifyEmail, ticketReceivedEmail, ticketReplyEmail } from './email-templates';
import { pushStaff } from './push';
import { groupOrders, type OrderGroup, type OrderRow } from '$lib/dashboard/orders';

export * from '$lib/dashboard/helpdesk';
import { OPEN_TICKET, TICKET_KIND, TICKET_STATUS, type Ticket, type TicketKind, type TicketMessage, type TicketStatus, type ReplyTemplate } from '$lib/dashboard/helpdesk';
type DB = SupabaseClient;

/** Nuovo ticket dai moduli pubblici (supporto, reso): salva, avvisa il cliente con il link e lo staff */
export async function createTicket(db: DB, kind: TicketKind, f: { name?: string; email: string; phone?: string; order_number?: string; message: string; file_path?: string | null }, origin: string): Promise<{ ok: true; number: string } | { ok: false; error: string }> {
	const admin = adminClient() ?? db;
	const subject = f.message.trim().split('\n')[0].slice(0, 80);
	const row = { kind, name: f.name?.trim() || null, email: f.email.trim().toLowerCase(), phone: f.phone?.trim() || null, order_number: f.order_number?.trim() || null, subject };
	const { data: t, error } = await admin.from('tickets').insert(row).select('*').single();
	if (error || !t) {
		// senza chiave di servizio la RLS non lascia rileggere: si inserisce alla cieca
		const { error: e2 } = await db.from('tickets').insert(row);
		if (e2) return { ok: false, error: 'Richiesta non salvata, riprova tra poco.' };
		return { ok: true, number: '' };
	}
	const ticket = t as Ticket;
	await admin.from('ticket_messages').insert({ ticket_id: ticket.id, direction: 'in', author: ticket.name ?? ticket.email, body: f.message.trim(), file_path: f.file_path ?? null });
	const href = `${origin}/assistenza/${ticket.token}`;
	await Promise.all([
		sendEmail({ to: ticket.email, ...ticketReceivedEmail({ name: ticket.name, number: ticket.number, href }) }),
		sendEmail({ to: OWNER_EMAIL, ...ownerNotifyEmail({ title: `Nuova richiesta ${ticket.number} (${TICKET_KIND[kind].label})`, lines: [`${ticket.name ?? ''} · ${ticket.email}`, ticket.order_number ? `Ordine ${ticket.order_number}` : 'Nessun ordine indicato', f.message.slice(0, 300)], href: `${origin}/dashboard/supporto/ticket/${ticket.id}` }) }),
		pushStaff({ title: `Richiesta ${ticket.number}: ${TICKET_KIND[kind].label}`, body: `${ticket.name ?? ticket.email}: ${subject}`, url: `/dashboard/supporto/ticket/${ticket.id}`, tag: `ticket-${ticket.id}` })
	]);
	return { ok: true, number: ticket.number };
}

export async function listTickets(db: DB): Promise<Ticket[]> {
	const { data } = await db.from('tickets').select('*').order('last_message_at', { ascending: false }).limit(500);
	return (data ?? []) as Ticket[];
}
export async function getTicket(db: DB, id: string): Promise<{ ticket: Ticket; messages: TicketMessage[] } | null> {
	const { data: t } = await db.from('tickets').select('*').eq('id', id).maybeSingle();
	if (!t) return null;
	const { data: m } = await db.from('ticket_messages').select('*').eq('ticket_id', id).order('created_at');
	return { ticket: t as Ticket, messages: (m ?? []) as TicketMessage[] };
}
export async function getTicketByToken(db: DB, token: string): Promise<{ ticket: Ticket; messages: TicketMessage[] } | null> {
	if (!/^[0-9a-f-]{36}$/.test(token)) return null;
	const { data: t } = await db.from('tickets').select('*').eq('token', token).maybeSingle();
	if (!t) return null;
	const { data: m } = await db.from('ticket_messages').select('*').eq('ticket_id', t.id).neq('direction', 'note').order('created_at');
	return { ticket: t as Ticket, messages: (m ?? []) as TicketMessage[] };
}
export async function markTicketRead(db: DB, id: string) { await db.from('tickets').update({ unread: false }).eq('id', id).eq('unread', true); }

/** Risposta dello staff: messaggio in uscita + email al cliente con il link alla conversazione */
export async function replyTicket(db: DB, id: string, body: string, author: string | null, origin: string, nextStatus: TicketStatus = 'attesa_cliente'): Promise<string | null> {
	if (!body.trim()) return 'Scrivi la risposta.';
	const c = await getTicket(db, id);
	if (!c) return 'Ticket non trovato.';
	await db.from('ticket_messages').insert({ ticket_id: id, direction: 'out', author, body: body.trim() });
	const r = await sendEmail({ to: c.ticket.email, ...ticketReplyEmail({ name: c.ticket.name, number: c.ticket.number, body: body.trim(), author, href: `${origin}/assistenza/${c.ticket.token}` }) });
	if (!r.ok) return r.error ?? 'Email non inviata.';
	await db.from('tickets').update({ status: nextStatus, unread: false, last_message_at: new Date().toISOString(), updated_at: new Date().toISOString(), assigned: c.ticket.assigned ?? author, closed_at: nextStatus === 'chiuso' ? new Date().toISOString() : null }).eq('id', id);
	return null;
}
export async function noteTicket(db: DB, id: string, body: string, author: string | null): Promise<string | null> {
	if (!body.trim()) return 'Nota vuota.';
	const { error } = await db.from('ticket_messages').insert({ ticket_id: id, direction: 'note', author, body: body.trim() });
	return error?.message ?? null;
}
export async function updateTicket(db: DB, id: string, patch: Partial<Pick<Ticket, 'status' | 'kind' | 'complaint_reason' | 'order_number' | 'assigned'>>): Promise<string | null> {
	if (patch.status && !(patch.status in TICKET_STATUS)) return 'Stato non valido.';
	if (patch.kind && !(patch.kind in TICKET_KIND)) return 'Tipo non valido.';
	const p: Record<string, unknown> = { ...patch, updated_at: new Date().toISOString() };
	if (patch.status === 'chiuso' || patch.status === 'risolto') p.closed_at = new Date().toISOString();
	if (patch.status && !['chiuso', 'risolto'].includes(patch.status)) p.closed_at = null;
	const { error } = await db.from('tickets').update(p).eq('id', id);
	return error?.message ?? null;
}
/** Risposta del cliente dalla pagina pubblica (client di servizio): il ticket torna a noi */
export async function customerReply(db: DB, token: string, body: string, filePath: string | null, origin: string): Promise<string | null> {
	if (!body.trim() && !filePath) return 'Scrivi un messaggio.';
	const c = await getTicketByToken(db, token);
	if (!c) return 'Richiesta non trovata.';
	await db.from('ticket_messages').insert({ ticket_id: c.ticket.id, direction: 'in', author: c.ticket.name ?? c.ticket.email, body: body.trim() || '(allegato)', file_path: filePath });
	const status: TicketStatus = c.ticket.status === 'chiuso' || c.ticket.status === 'risolto' || c.ticket.status === 'attesa_cliente' ? 'in_carico' : c.ticket.status;
	await db.from('tickets').update({ status, unread: true, last_message_at: new Date().toISOString(), updated_at: new Date().toISOString(), closed_at: null }).eq('id', c.ticket.id);
	await Promise.all([
		sendEmail({ to: OWNER_EMAIL, ...ownerNotifyEmail({ title: `${c.ticket.name ?? c.ticket.email} ha risposto sulla richiesta ${c.ticket.number}`, lines: [body.trim().slice(0, 300) || 'Allegato'], href: `${origin}/dashboard/supporto/ticket/${c.ticket.id}` }) }),
		pushStaff({ title: `Risposta su ${c.ticket.number}`, body: body.trim().slice(0, 120) || 'Allegato', url: `/dashboard/supporto/ticket/${c.ticket.id}`, tag: `ticket-${c.ticket.id}` })
	]);
	return null;
}

/** Contesto per la scheda: ordine citato (con le sue righe) e altri ticket dello stesso cliente */
export async function ticketContext(db: DB, t: Ticket): Promise<{ order: OrderGroup | null; others: Ticket[] }> {
	let order: OrderGroup | null = null;
	const num = (t.order_number ?? '').trim().toUpperCase().replace(/\s+/g, '');
	if (num) {
		const variants = [...new Set([num, num.replace('-', ''), num.replace(/^SP(\d)/, 'SP-$1')])];
		const { data } = await db.from('orders').select('*').in('number', variants);
		if (data?.length) {
			const g = groupOrders(data as OrderRow[])[0];
			const { data: all } = await db.from('orders').select('*').eq('checkout_group', g.key);
			order = groupOrders((all?.length ? all : data) as OrderRow[])[0];
		}
	}
	const { data: others } = await db.from('tickets').select('*').eq('email', t.email).neq('id', t.id).order('created_at', { ascending: false }).limit(10);
	return { order, others: (others ?? []) as Ticket[] };
}

export async function listTemplates(db: DB): Promise<ReplyTemplate[]> {
	const { data } = await db.from('reply_templates').select('*').order('sort').order('title');
	return (data ?? []) as ReplyTemplate[];
}

/** contatori del menu: ticket nuovi + ticket con una risposta del cliente non ancora letta */
export async function supportoCounts(db: DB): Promise<{ daLeggere: number; aperti: number }> {
	const { data } = await db.from('tickets').select('status, unread').in('status', OPEN_TICKET);
	let daLeggere = 0, aperti = 0;
	for (const t of data ?? []) { aperti++; if (t.status === 'nuovo' || t.unread) daLeggere++; }
	return { daLeggere, aperti };
}
