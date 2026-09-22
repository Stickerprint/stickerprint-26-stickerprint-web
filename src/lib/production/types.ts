/**
 * Produzione v2: tipi condivisi tra motore (routing + pianificatore), server e pagine.
 * Nessuna dipendenza dal database: i moduli in questa cartella sono puri e si testano da soli.
 */

/* ---------- lavorazioni e macchinari ---------- */
/** cosa una macchina (o una postazione) sa fare */
export type Capability = 'stampa_ecosolvente' | 'stampa_uv' | 'laminazione' | 'taglio' | 'resinatura' | 'controllo' | 'confezionamento';
/** tipologie iniziali: la tabella accetta stringhe nuove, questo elenco serve solo alle tendine */
export const MACHINE_TYPES: Record<string, { label: string; department: Department; capabilities: Capability[] }> = {
	stampante_ecosolvente: { label: 'Stampante eco-solvente', department: 'stampa', capabilities: ['stampa_ecosolvente'] },
	stampante_uv: { label: 'Stampante UV', department: 'stampa', capabilities: ['stampa_uv'] },
	laminatrice: { label: 'Laminatrice', department: 'laminazione', capabilities: ['laminazione'] },
	plotter_taglio: { label: 'Plotter da taglio', department: 'taglio', capabilities: ['taglio'] },
	resinatrice: { label: 'Resinatrice automatica', department: 'resinatura', capabilities: ['resinatura'] }
};
export type Department = 'stampa' | 'laminazione' | 'taglio' | 'resinatura' | 'controllo' | 'confezionamento';
export const DEPARTMENTS: Record<Department, { label: string; icon: string; station: boolean }> = {
	stampa: { label: 'Stampa', icon: '🖨️', station: false },
	laminazione: { label: 'Laminazione', icon: '🧴', station: false },
	taglio: { label: 'Taglio', icon: '✂️', station: false },
	resinatura: { label: 'Resinatura', icon: '💧', station: false },
	controllo: { label: 'Controllo qualità', icon: '🔍', station: true },      // postazione, non macchinario
	confezionamento: { label: 'Confezionamento', icon: '📦', station: true }  // postazione, non macchinario
};
export const CAPABILITY_LABEL: Record<Capability, string> = {
	stampa_ecosolvente: 'Stampa eco-solvente', stampa_uv: 'Stampa UV', laminazione: 'Laminazione', taglio: 'Taglio', resinatura: 'Resinatura', controllo: 'Controllo qualità', confezionamento: 'Confezionamento'
};

export interface Machine {
	id: string; code: string; name: string; brand: string | null; model: string | null;
	machine_type: string; department: Department; usable_width_mm: number | null;
	is_active: boolean; archived_at: string | null;
	setup_minutes: number | null; sqm_per_hour: number | null; minutes_per_sqm: number | null;
	pieces_per_hour: number | null; minutes_per_piece: number | null; cleanup_minutes: number | null;
	passive_minutes: number | null; waste_coefficient: number | null;
	capabilities: Capability[]; notes: string | null; sort: number;
}
export interface MachineProfile {
	id: string; machine_id: string; name: string; product_slug: string | null; quality: string | null; material: string | null; capability: string | null;
	sqm_per_hour: number | null; minutes_per_sqm: number | null; minutes_per_piece: number | null; setup_minutes: number | null; coefficient: number | null; is_active: boolean;
}
/** macchina usabile per lavori nuovi */
export const usable = (m: Machine) => m.is_active && !m.archived_at;

/* ---------- calendario ---------- */
export interface Calendar {
	timezone: string; working_days: number[]; open_time: string; close_time: string; break_start: string | null; break_end: string | null;
	ship_cutoff: string; ship_margin_minutes: number; orange_threshold_minutes: number; holidays: string[]; closures: { from: string; to: string; label?: string }[];
}
export const DEFAULT_CALENDAR: Calendar = {
	timezone: 'Europe/Rome', working_days: [1, 2, 3, 4, 5], open_time: '08:30', close_time: '17:30', break_start: null, break_end: null,
	ship_cutoff: '17:00', ship_margin_minutes: 60, orange_threshold_minutes: 240, holidays: [], closures: []
};

/* ---------- commesse e fasi ---------- */
export type JobStatus = 'READY_TO_START' | 'IN_PROGRESS' | 'WAITING_PASSIVE_TIME' | 'READY_FOR_PACKAGING' | 'PACKAGING' | 'COMPLETED' | 'CANCELLED';
export type RiskStatus = 'ON_TRACK' | 'TIGHT' | 'AT_RISK' | 'LATE';
/** stati delle fasi nel database (italiano) e loro nome nel modello */
export type PhaseStatus = 'da_fare' | 'pronto' | 'in_corso' | 'bloccato' | 'completato' | 'in_attesa' | 'saltata';
export const PHASE_MODEL: Record<PhaseStatus, 'LOCKED' | 'READY' | 'IN_PROGRESS' | 'BLOCKED' | 'COMPLETED' | 'WAITING' | 'SKIPPED'> = {
	da_fare: 'LOCKED', pronto: 'READY', in_corso: 'IN_PROGRESS', bloccato: 'BLOCKED', completato: 'COMPLETED', in_attesa: 'WAITING', saltata: 'SKIPPED'
};
export const PHASE_LABEL: Record<PhaseStatus, string> = { da_fare: 'In arrivo', pronto: 'Pronta', in_corso: 'In corso', bloccato: 'Bloccata', completato: 'Completata', in_attesa: 'In attesa (tempo passivo)', saltata: 'Saltata' };
export const JOB_LABEL: Record<JobStatus, string> = {
	READY_TO_START: 'Da avviare', IN_PROGRESS: 'In corso', WAITING_PASSIVE_TIME: 'In attesa (maturazione)', READY_FOR_PACKAGING: 'Da confezionare', PACKAGING: 'In confezionamento', COMPLETED: 'Completata', CANCELLED: 'Annullata'
};
export const RISK: Record<RiskStatus, { label: string; hex: string; soft: string; icon: string }> = {
	ON_TRACK: { label: 'In tempo', hex: '#16a34a', soft: '#dcfce7', icon: '🟢' },
	TIGHT: { label: 'Margine ridotto', hex: '#ea580c', soft: '#ffedd5', icon: '🟠' },
	AT_RISK: { label: 'A rischio', hex: '#dc2626', soft: '#fee2e2', icon: '🔴' },
	LATE: { label: 'In ritardo', hex: '#7f1d1d', soft: '#fecaca', icon: '⛔' }
};

export interface Phase {
	id: string; job_id: string | null; order_id: string; seq: number; stage: Department; label: string;
	capability: Capability | null; machine_type: string | null; machine_id: string | null; machine: string | null;
	minutes: number; wait_minutes: number; passive: boolean; manual_minutes: boolean; machine_locked: boolean; complexity: string | null;
	status: PhaseStatus; due_at: string | null; latest_start_at: string | null; planned_start_at: string | null; planned_end_at: string | null;
	started_at: string | null; completed_at: string | null; operator: string | null; block_reason: string | null; notes: string | null;
}
export interface Job {
	id: string; checkout_group: string; order_number: string; promised_ship_date: string; status: JobStatus;
	paid_at: string | null; started_at: string | null; completed_at: string | null; cancelled_at: string | null; cancel_reason: string | null;
	latest_start_at: string | null; estimated_packaging_at: string | null; total_minutes: number; slack_minutes: number | null; predicted_delay_minutes: number; risk_status: RiskStatus;
	created_at: string; updated_at: string;
}

/* ---------- routing: input e output ---------- */
export interface RoutingInput {
	product_slug: string;                 // adesivi_personalizzati, etichette, kit_adesivi, fogli_adesivi, vetrofanie, adesivi_resinati, adesivi_rilievo, campioni
	laminated: boolean;                   // il cliente ha scelto una lamina protettiva
	protection: string | null;            // 'nessuna' | 'lucida' | 'opaca' | ... (informativo)
	print_tech?: 'ecosolvente' | 'uv' | null;  // richiesta esplicita (null = decide la regola)
	needs_cut?: boolean | null;           // null = decide la regola del prodotto
	needs_resin?: boolean | null;
	qty: number;
	width_mm: number | null; height_mm: number | null;
	material?: string | null;
	complexity?: 'semplice' | 'standard' | 'complesso' | null;   // taglio
	imposed_sqm?: number | null;          // area dell'imposizione di stampa, se il sistema la conosce (vince sull'area netta)
}
export interface RoutedPhase {
	seq: number; stage: Department; label: string; capability: Capability;
	machine_types: string[];              // tipologie compatibili (vuoto = postazione)
	machine_id: string | null;            // scelta dal pianificatore
	minutes: number;                      // lavoro attivo
	wait_minutes: number;                 // tempo passivo (calendario)
	passive: boolean;
	estimated: boolean;                   // false = durata di riserva perche' la macchina non e' configurata
	complexity?: string | null;
}
export const COMPLEXITY: Record<string, { label: string; coefficient: number }> = { semplice: { label: 'Semplice', coefficient: 0.7 }, standard: { label: 'Standard', coefficient: 1 }, complesso: { label: 'Complesso', coefficient: 1.6 } };
