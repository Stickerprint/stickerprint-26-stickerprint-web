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

export interface QuoteMessage { id: number; quote_id: string; direction: 'in' | 'out'; author: string | null; body: string; created_at: string }
const itLong = (d: string | null) => (d ? new Date(d + 'T12:00:00').toLocaleDateString('it-IT', { day: 'numeric', month: 'long' }) : null);
const eur = (v: number) => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(v);
/** Email di invio proposta dallo staff: si modifica prima di mandarla (mai a freddo) */
export function defaultQuoteEmail(q: Pick<Quote, 'number' | 'draft' | 'total_gross' | 'valid_until'>, sender: string | null): { subject: string; body: string } {
	const c = q.draft.customer;
	const first = c.first_name?.trim() || c.name;
	const items = q.draft.items.filter((i) => Number(i.qty) > 0);
	const what = items.length === 1 ? `${Number(items[0].qty).toLocaleString('it-IT')} ${items[0].description}` : `${items.length} articoli`;
	const subject = `Il tuo preventivo ${q.number}: ${items[0]?.description ?? 'la tua richiesta'}`.slice(0, 120);
	const body = `Ciao ${first},\n\ngrazie per la richiesta. Ho preparato il preventivo ${q.number} per ${what}: lo trovi con tutti i dettagli dal bottone qui sotto.\n\nTotale ${eur(Number(q.total_gross))} IVA inclusa${q.valid_until ? `, valido fino al ${itLong(q.valid_until)}` : ''}. Se qualcosa non torna (quantità, materiale, tempi) rispondi a questa email e lo sistemiamo insieme.\n\nA presto,\n${sender ?? 'Stickerprint'}`;
	return { subject, body };
}
