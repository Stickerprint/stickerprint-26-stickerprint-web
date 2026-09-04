import { PRODUCT_ENGINES } from '$lib/pricing/engine';

export interface Order {
	id: string;
	number: string;
	product_name: string;
	forma: string | null;
	materiale: string | null;
	finitura: string | null;
	width_mm: number | null;
	height_mm: number | null;
	qty: number;
	total_net: number;
	total_gross: number;
	credit_earned: number;
	status: string;
	prod_stage?: string | null;
	product_slug: string;
	preview_url: string | null;
	file_path?: string | null;
	tracking_url: string | null;
	created_at: string;
}
export interface Invoice { id: string; order_id: string | null; number: string; issued_at: string; amount_gross: number; pdf_path: string | null }
export interface CreditTx { id: string; amount: number; kind: 'earn' | 'spend' | 'expire' | 'adjust'; order_ref: string | null; note: string | null; expires_at: string | null; created_at: string }

export const STATUS: Record<string, { label: string; cls: string }> = {
	in_attesa: { label: 'Ricevuto', cls: 'st--wait' },
	attesa_file: { label: 'In attesa del file', cls: 'st--wait' },
	attesa_prova: { label: 'Prova di stampa in preparazione', cls: 'st--wait' },
	modifiche_richieste: { label: 'Modifiche in corso', cls: 'st--wait' },
	approvazione: { label: 'In attesa della tua approvazione', cls: 'st--wait' },
	in_produzione: { label: 'In produzione', cls: 'st--prod' },
	pronto: { label: 'Pronto per il corriere', cls: 'st--ship' },
	in_spedizione: { label: 'Affidato al corriere', cls: 'st--ship' },
	spedito: { label: 'In transito', cls: 'st--ship' },
	in_consegna: { label: 'In consegna', cls: 'st--ship' },
	consegnato: { label: 'Consegnato', cls: 'st--done' },
	annullato: { label: 'Annullato', cls: 'st--off' }
};
export const STAGE_LABEL: Record<string, string> = { stampa: 'In stampa', plastifica: 'In plastifica', taglio: 'In taglio', resinatura: 'In resinatura', confezionamento: 'In confezionamento' };
/** Etichetta vista dal cliente: durante la produzione mostra la fase del reparto */
export function customerStatus(o: { status: string; prod_stage?: string | null }): { label: string; cls: string } {
	if (o.status === 'in_produzione' && o.prod_stage && STAGE_LABEL[o.prod_stage]) return { label: STAGE_LABEL[o.prod_stage], cls: 'st--prod' };
	return STATUS[o.status] ?? { label: o.status, cls: 'st--wait' };
}
/** Tappe del tracciamento mostrate al cliente, con quella corrente */
export function trackSteps(o: { status: string; prod_stage?: string | null; product_slug: string; finitura?: string | null }): { label: string; state: 'done' | 'current' | 'todo' }[] {
	const lam = o.finitura && o.finitura !== 'nessuna';
	const prod = o.product_slug === 'adesivi_resinati' ? ['stampa', 'taglio', 'resinatura', 'confezionamento'] : o.product_slug === 'adesivi_rilievo' || o.product_slug === 'vetrofanie' ? ['stampa', 'taglio', 'confezionamento'] : o.product_slug === 'campioni' ? ['confezionamento'] : lam ? ['stampa', 'plastifica', 'taglio', 'confezionamento'] : ['stampa', 'taglio', 'confezionamento'];
	const steps = ['ricevuto', ...prod, 'spedito', 'consegnato'];
	const labels: Record<string, string> = { ricevuto: 'Ricevuto', ...STAGE_LABEL, spedito: 'Spedito', consegnato: 'Consegnato' };
	let cur = 0;
	if (o.status === 'in_produzione') cur = Math.max(1, steps.indexOf(o.prod_stage ?? prod[0]));
	else if (['pronto', 'in_spedizione', 'spedito', 'in_consegna'].includes(o.status)) cur = steps.indexOf('spedito');
	else if (o.status === 'consegnato') cur = steps.length - 1;
	return steps.map((s, i) => ({ label: labels[s] ?? s, state: i < cur ? 'done' : i === cur ? 'current' : 'todo' }));
}
export const OPEN_STATUSES: string[] = ['in_attesa', 'attesa_file', 'attesa_prova', 'modifiche_richieste', 'approvazione', 'in_produzione', 'pronto', 'in_spedizione', 'spedito', 'in_consegna'];
export const MATERIAL_LABEL: Record<string, string> = { bianco: 'Vinile bianco', super: 'Bianco super adesivo', olografico: 'Olografico', glitterato: 'Glitterato', trasparente: 'Trasparente', argento: 'Argento', oro: 'Oro' };
export const productHref = (slug: string) => PRODUCT_ENGINES.find((p) => p.slug === slug)?.href ?? '/prodotti';
export const eur = (v: number) => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(v);
export const dateIt = (d: string, long = false) => new Intl.DateTimeFormat('it-IT', long ? { day: 'numeric', month: 'long', year: 'numeric' } : { day: 'numeric', month: 'short' }).format(new Date(d));
export const fmtMm = (v: number | null) => (v == null ? '' : Number.isInteger(+v) ? String(+v) : (+v).toFixed(1).replace('.', ','));

export interface LoyaltyLevel { level: string; name: string; rank: number; credit_rate: number; img: string; next_points: number | null; keep_points: number }
export interface Loyalty {
	level: string; name: string; rank: number; credit_rate: number; img: string;
	period_points: number; lifetime_points: number; level_since: string; expires_at: string; keep_points: number;
	next: { level: string; name: string; points: number; credit_rate: number; img: string } | null;
	levels: LoyaltyLevel[];
}
export const pct = (rate: number) => `${Math.round(rate * 100)}%`;
