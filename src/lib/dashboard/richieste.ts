/** Costanti e tipi di richieste aziendali e preventivi (condivisi tra server e browser). */
import type { OrderDraft } from './orderDraft';

export type RequestStatus = 'new' | 'in_progress' | 'quoted' | 'won' | 'lost' | 'closed';
export const REQUEST_STATUS: Record<RequestStatus, { label: string; color: string; soft: string }> = {
	new: { label: 'Nuova', color: '#b45309', soft: '#fef3c7' },
	in_progress: { label: 'In lavorazione', color: '#1d4ed8', soft: '#dbeafe' },
	quoted: { label: 'Preventivo inviato', color: '#6d28d9', soft: '#ede9fe' },
	won: { label: 'Ordine creato', color: '#15803d', soft: '#dcfce7' },
	lost: { label: 'Non conclusa', color: '#6b7280', soft: '#e5e7eb' },
	closed: { label: 'Chiusa', color: '#6b7280', soft: '#e5e7eb' }
};
export type QuoteStatus = 'bozza' | 'inviato' | 'accettato' | 'rifiutato' | 'scaduto' | 'ordinato';
export const QUOTE_STATUS: Record<QuoteStatus, { label: string; color: string; soft: string }> = {
	bozza: { label: 'Bozza', color: '#6b7280', soft: '#eceef3' },
	inviato: { label: 'Inviato', color: '#1d4ed8', soft: '#dbeafe' },
	accettato: { label: 'Accettato', color: '#15803d', soft: '#dcfce7' },
	rifiutato: { label: 'Rifiutato', color: '#b91c1c', soft: '#fee2e2' },
	scaduto: { label: 'Scaduto', color: '#b45309', soft: '#fef3c7' },
	ordinato: { label: 'Diventato ordine', color: '#15803d', soft: '#dcfce7' }
};
/** Un preventivo si puo' trasformare in ordine a mano in qualsiasi momento (Mattia, 25/11/2026): bozza, inviato,
 *  accettato o scaduto. Non quello gia' diventato ordine, ne' quello rifiutato, ne' una versione vecchia
 *  sostituita da una revisione (l'ordine nascerebbe con i dati superati). */
export const puoDiventareOrdine = (q: { status: string; order_group?: string | null; rejected_reason?: string | null }): boolean =>
	['bozza', 'inviato', 'accettato', 'scaduto'].includes(q.status) && !q.order_group && !/^Sostituito dalla rev/i.test(q.rejected_reason ?? '');
/** la nota che entra nell'ordine nato da un preventivo */
export const notaPreventivo = (q: { number: string; version?: number | null }): string => `Collegato al preventivo ${q.number}${(q.version ?? 1) > 1 ? ` rev. ${q.version}` : ''}`;
export const QUOTE_VALID_DAYS = 30;
export const QUOTE_REMIND_DAYS = 5;

export interface ContactRequest {
	id: string; kind: 'aziende' | 'support' | 'reso'; name: string | null; company: string | null; email: string; phone: string | null; order_number: string | null;
	message: string; file_path: string | null; status: RequestStatus; created_at: string; read_at: string | null; notes: string | null; contact_id: string | null; quote_id: string | null; ticket_id: string | null;
}
export interface Quote {
	id: string; year: number; seq: number; number: string; version: number; parent_id: string | null; request_id: string | null; contact_id: string | null;
	status: QuoteStatus; draft: OrderDraft; total_net: number; total_gross: number; valid_until: string | null; sent_at: string | null; reminded_at: string | null;
	accepted_at: string | null; accepted_by: string | null; rejected_reason: string | null; order_group: string | null; token: string; created_at: string; updated_at: string;
	sent_subject?: string | null; sent_message?: string | null; sender_name?: string | null; opened_count?: number; opened_at?: string | null; pdf_downloaded_at?: string | null; auto_remind?: boolean; unread?: boolean;
}

/** Data del preventivo: quella scritta sul documento (campo data della bozza), non il giorno in cui la riga e' entrata nel gestionale.
 *  I 40 preventivi importati da Fatture in Cloud il 31/10/2026 sono di gennaio-agosto: contando `created_at` finivano tutti in ottobre. */
export const quoteDate = (q: { draft?: { date?: string | null } | null; created_at: string }): string => (q.draft?.date && /^\d{4}-\d{2}-\d{2}/.test(q.draft.date) ? q.draft.date : q.created_at);

export interface QuoteMessage { id: number; quote_id: string; direction: 'in' | 'out'; author: string | null; body: string; created_at: string }
const itLong = (d: string | null) => (d ? new Date(d + 'T12:00:00').toLocaleDateString('it-IT', { day: 'numeric', month: 'long' }) : null);
const eur = (v: number) => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', useGrouping: 'always' }).format(v);
/** Email di invio proposta dallo staff: si modifica prima di mandarla (mai a freddo) */
/** firma di tutto quello che arriva al cliente: mai il nome di chi segue (Mattia, 25/11/2026) */
export const FIRMA_STAFF = 'Stickerprint-Staff';
export function defaultQuoteEmail(q: Pick<Quote, 'number' | 'draft' | 'total_gross' | 'valid_until'>, _sender?: string | null): { subject: string; body: string } {
	const c = q.draft.customer;
	const first = c.first_name?.trim() || c.name;
	const items = q.draft.items.filter((i) => Number(i.qty) > 0);
	const subject = `Il tuo preventivo ${q.number}: ${items[0]?.description ?? 'la tua richiesta'}`.slice(0, 120);
	const body = `Ciao ${first},\n\nti abbiamo finalmente preparato il preventivo richiesto: lo trovi nel link qui sotto, con tutti i dettagli.\nSe qualcosa non torna scrivici pure.\n\nA presto,\n${FIRMA_STAFF}`;
	return { subject, body };
}
