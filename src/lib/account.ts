import { PRODUCT_ENGINES } from '$lib/pricing/engine';

export interface Order {
	id: string;
	number: string;
	product_slug: string;
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
	status: 'in_attesa' | 'in_produzione' | 'spedito' | 'consegnato' | 'annullato';
	preview_url: string | null;
	file_path?: string | null;
	tracking_url: string | null;
	created_at: string;
}
export interface Invoice { id: string; order_id: string | null; number: string; issued_at: string; amount_gross: number; pdf_path: string | null }
export interface CreditTx { id: string; amount: number; kind: 'earn' | 'spend' | 'expire' | 'adjust'; order_ref: string | null; note: string | null; expires_at: string | null; created_at: string }

export const STATUS: Record<Order['status'], { label: string; cls: string }> = {
	in_attesa: { label: 'In attesa', cls: 'st--wait' },
	in_produzione: { label: 'In produzione', cls: 'st--prod' },
	spedito: { label: 'Spedito', cls: 'st--ship' },
	consegnato: { label: 'Consegnato', cls: 'st--done' },
	annullato: { label: 'Annullato', cls: 'st--off' }
};
export const OPEN_STATUSES: Order['status'][] = ['in_attesa', 'in_produzione', 'spedito'];
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
