/** Costanti e tipi dell'helpdesk (condivisi tra server e browser). */

export type TicketKind = 'domanda' | 'problema' | 'lamentela' | 'reso' | 'altro';
export type TicketStatus = 'nuovo' | 'in_carico' | 'attesa_cliente' | 'risolto' | 'chiuso';
export const TICKET_KIND: Record<TicketKind, { label: string; icon: string }> = {
	domanda: { label: 'Domanda', icon: '💬' }, problema: { label: 'Problema sull’ordine', icon: '⚠️' }, lamentela: { label: 'Lamentela', icon: '😠' }, reso: { label: 'Reso', icon: '↩️' }, altro: { label: 'Altro', icon: '📎' }
};
export const TICKET_STATUS: Record<TicketStatus, { label: string; color: string; soft: string }> = {
	nuovo: { label: 'Nuovo', color: '#b45309', soft: '#fef3c7' },
	in_carico: { label: 'Preso in carico', color: '#1d4ed8', soft: '#dbeafe' },
	attesa_cliente: { label: 'In attesa del cliente', color: '#6d28d9', soft: '#ede9fe' },
	risolto: { label: 'Risolto', color: '#15803d', soft: '#dcfce7' },
	chiuso: { label: 'Chiuso', color: '#6b7280', soft: '#e5e7eb' }
};
export const COMPLAINT_REASONS = ['Qualità di stampa', 'Taglio o misura', 'Ritardo di consegna', 'Pacco danneggiato', 'Ordine incompleto', 'Comunicazione', 'Altro'];
export const OPEN_TICKET = ['nuovo', 'in_carico', 'attesa_cliente', 'risolto'];
export const SLA_HOURS = 24;

export interface Ticket {
	id: string; number: string; kind: TicketKind; status: TicketStatus; name: string | null; email: string; phone: string | null; order_number: string | null;
	subject: string | null; complaint_reason: string | null; contact_id: string | null; request_id: string | null; token: string; unread: boolean; assigned: string | null;
	last_message_at: string; closed_at: string | null; created_at: string; updated_at: string;
}
export interface TicketMessage { id: number; ticket_id: string; direction: 'in' | 'out' | 'note'; author: string | null; body: string; file_path: string | null; created_at: string }
export interface ReplyTemplate { id: string; title: string; body: string; sort: number }

/** ore di attesa del cliente: dall'ultimo messaggio in entrata senza risposta */
export function waitingHours(t: Ticket, now = Date.now()): number | null {
	if (!(t.status === 'nuovo' || t.unread)) return null;
	return Math.round((now - new Date(t.last_message_at).getTime()) / 36e5);
}
