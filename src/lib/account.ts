import { PRODUCT_ENGINES } from '$lib/pricing/engine';
import type { Lang } from '$lib/i18n';
import { t, perLingua } from '$lib/traduzioni';

export interface Order {
	id: string;
	number: string;
	checkout_group?: string | null;
	invoice_id?: string | null;
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
	/** valuta pagata (dal 21/10/2026, migrazione 0059): gli ordini dal sito USA sono in dollari senza IVA */
	currency?: string | null;
	total_paid_currency?: number | null;
	vat_rate?: number | null;
}
export interface Invoice { id: string; order_id: string | null; number: string; issued_at: string; amount_gross: number; pdf_path: string | null }
export interface CreditTx { id: string; amount: number; kind: 'earn' | 'spend' | 'expire' | 'adjust'; order_ref: string | null; note: string | null; expires_at: string | null; created_at: string }

/** Stati dell'ordine visti dal cliente: `label` in italiano (dashboard, email), `key` = chiave in `checkout.stati` per le altre lingue */
export const STATUS: Record<string, { label: string; cls: string; key: string }> = {
	attesa_pagamento: { label: 'In attesa del pagamento', cls: 'st--wait', key: 'attesa_pagamento' },
	attesa_integrazione: { label: 'Integrazione da pagare', cls: 'st--wait', key: 'attesa_integrazione' },
	in_produzione: { label: 'In produzione', cls: 'st--prod', key: 'in_produzione' },
	in_spedizione: { label: 'In spedizione', cls: 'st--ship', key: 'in_spedizione' },
	spedito: { label: 'Spedito', cls: 'st--ship', key: 'spedito' },
	in_consegna: { label: 'In consegna', cls: 'st--ship', key: 'in_consegna' },
	consegnato: { label: 'Consegnato', cls: 'st--done', key: 'consegnato' },
	annullato: { label: 'Annullato', cls: 'st--off', key: 'annullato' },
	// stati di prima (ordini vecchi)
	pronto: { label: 'In spedizione', cls: 'st--ship', key: 'in_spedizione' },
	in_attesa: { label: 'Ricevuto', cls: 'st--wait', key: 'ricevuto' },
	attesa_file: { label: 'Ricevuto', cls: 'st--wait', key: 'ricevuto' },
	attesa_prova: { label: 'Ricevuto', cls: 'st--wait', key: 'ricevuto' },
	modifiche_richieste: { label: 'Ricevuto', cls: 'st--wait', key: 'ricevuto' },
	approvazione: { label: 'Ricevuto', cls: 'st--wait', key: 'ricevuto' }
};
export const STAGE_LABEL: Record<string, string> = { stampa: 'In stampa', plastifica: 'In plastifica', taglio: 'In taglio', resinatura: 'In resinatura', controllo: 'In controllo qualità', confezionamento: 'In confezionamento' };
/** etichetta di stato/tappa nella lingua del cliente (chiavi di `checkout.stati`; in italiano resta il testo di STATUS/STAGE_LABEL) */
const statoIn = (lang: Lang, key: string, it: string) => (lang === 'it' ? it : t(perLingua(lang), `checkout.stati.${key}`));
/** Etichetta vista dal cliente: durante la produzione mostra la fase del reparto. `lang` = lingua del sito (default italiano) */
export function customerStatus(o: { status: string; prod_stage?: string | null }, lang: Lang = 'it'): { label: string; cls: string } {
	if (o.status === 'in_produzione' && o.prod_stage && STAGE_LABEL[o.prod_stage]) return { label: statoIn(lang, o.prod_stage, STAGE_LABEL[o.prod_stage]), cls: 'st--prod' };
	const st = STATUS[o.status];
	return st ? { label: statoIn(lang, st.key, st.label), cls: st.cls } : { label: o.status, cls: 'st--wait' };
}
/** Tappe del tracciamento mostrate al cliente, con quella corrente. `lang` = lingua del sito (default italiano) */
export function trackSteps(o: { status: string; prod_stage?: string | null; product_slug: string; finitura?: string | null }, lang: Lang = 'it'): { label: string; state: 'done' | 'current' | 'todo' }[] {
	const lam = o.finitura && o.finitura !== 'nessuna';
	const prod = o.product_slug === 'adesivi_resinati' ? ['stampa', 'taglio', 'resinatura', 'confezionamento'] : o.product_slug === 'adesivi_rilievo' || o.product_slug === 'vetrofanie' ? ['stampa', 'taglio', 'confezionamento'] : o.product_slug === 'campioni' ? ['confezionamento'] : lam ? ['stampa', 'plastifica', 'taglio', 'confezionamento'] : ['stampa', 'taglio', 'confezionamento'];
	const steps = ['ricevuto', ...prod, 'spedito', 'consegnato'];
	const labels: Record<string, string> = { ricevuto: 'Ricevuto', ...STAGE_LABEL, spedito: 'Spedito', consegnato: 'Consegnato' };
	let cur = 0;
	if (o.status === 'in_produzione') { const st = o.prod_stage === 'controllo' ? 'confezionamento' : (o.prod_stage ?? prod[0]); cur = Math.max(1, steps.indexOf(st)); }
	else if (['pronto', 'in_spedizione', 'spedito', 'in_consegna'].includes(o.status)) cur = steps.indexOf('spedito');
	else if (o.status === 'consegnato') cur = steps.length - 1;
	return steps.map((s, i) => ({ label: labels[s] ? statoIn(lang, s, labels[s]) : s, state: i < cur ? 'done' : i === cur ? 'current' : 'todo' }));
}
export const OPEN_STATUSES: string[] = ['in_attesa', 'attesa_file', 'attesa_prova', 'modifiche_richieste', 'approvazione', 'attesa_pagamento', 'attesa_integrazione', 'in_produzione', 'pronto', 'in_spedizione', 'spedito', 'in_consegna'];
/** nomi dei materiali in italiano (dashboard, fatture, email); per il sito in lingua: materialLabel(m, lang) */
export const MATERIAL_LABEL: Record<string, string> = { bianco: 'Vinile bianco', super: 'Bianco super adesivo', olografico: 'Olografico', glitterato: 'Glitterato', trasparente: 'Trasparente', argento: 'Argento', oro: 'Oro' };
/** nome del materiale nella lingua del sito (chiavi di `checkout.materiali`); i materiali sconosciuti tornano com'erano */
export const materialLabel = (m: string | null | undefined, lang: Lang = 'it'): string => (!m ? '' : !MATERIAL_LABEL[m] ? m : lang === 'it' ? MATERIAL_LABEL[m] : t(perLingua(lang), `checkout.materiali.${m}`));
export const productHref = (slug: string) => PRODUCT_ENGINES.find((p) => p.slug === slug)?.href ?? '/prodotti';
export const eur = (v: number) => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', useGrouping: 'always' }).format(v);
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
