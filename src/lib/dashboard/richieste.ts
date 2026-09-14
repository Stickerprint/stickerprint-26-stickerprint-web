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
}
