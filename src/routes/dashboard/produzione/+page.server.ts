import { fail } from '@sveltejs/kit';
import { MATERIAL_LABEL } from '$lib/account';
import { thumbOf, type OrderRow } from '$lib/dashboard/orders';
import { isWorkingDay, todayIso } from '$lib/production/calendar';
import { loadSetup } from '$lib/server/produzione';
import { cambiaStato } from '$lib/server/ordini-gruppo';
import { studioOrderHref } from '$lib/studio/products';
import type { Actions, PageServerLoad } from './$types';

/** Da fare oggi: un giorno di margine, quindi oggi si preparano gli ordini che partono il prossimo giorno lavorativo
 *  (più quelli già in ritardo o che partono oggi e non sono ancora pronti). Divisi per prodotto e plastifica. */
const PRODOTTO: Record<string, string> = { adesivi_personalizzati: 'Adesivi personalizzati', adesivi_resinati: 'Adesivi resinati', adesivi_rilievo: 'Adesivi in rilievo', etichette: 'Etichette in fogli', fogli_adesivi: 'Fogli di adesivi', vetrofanie: 'Vetrofanie', kit_adesivi: 'Kit di adesivi', campioni: 'Kit campioni' };
const ORDINE_BLOCCHI = ['adesivi_resinati', 'adesivi_personalizzati', 'adesivi_rilievo', 'etichette', 'fogli_adesivi', 'vetrofanie', 'kit_adesivi', 'campioni'];
/* la plastifica fa blocco a sé solo dove si plastifica davvero (resinati, rilievo e vetrofanie non si plastificano) */
const CON_PLASTIFICA = new Set(['adesivi_personalizzati', 'etichette', 'fogli_adesivi', 'kit_adesivi']);

function plastifica(r: OrderRow): 'lucida' | 'opaca' | null {
	const f = (r.finitura ?? r.lamination ?? '').toLowerCase();
	if (f.includes('opac')) return 'opaca';
	if (f.includes('lucid') || f.includes('gloss')) return 'lucida';
	return null;
}
export type Articolo = { id: string; group: string; number: string; customer: string; thumb: string | null; product: string; size: string; material: string; forma: string | null; qty: number; express: boolean; shipBy: string | null; status: string; studio: string | null; notes: string | null; manual: boolean };
export type Blocco = { key: string; title: string; items: Articolo[]; pezzi: number };

export const load: PageServerLoad = async ({ locals: { supabase } }) => {
	const { calendar } = await loadSetup(supabase);
	const today = todayIso(calendar);
	// prossimo giorno lavorativo (salta weekend, festivi e chiusure del calendario)
	const next = new Date(today + 'T12:00:00Z');
	let target = today;
	for (let i = 0; i < 15; i++) { next.setUTCDate(next.getUTCDate() + 1); target = next.toISOString().slice(0, 10); if (isWorkingDay(target, calendar)) break; }
	const { data } = await supabase.from('orders').select('*').eq('status', 'in_produzione').or(`ship_by.lte.${target},ship_by.is.null`).order('ship_by', { ascending: true, nullsFirst: false }).order('created_at', { ascending: true });
	const rows = (data ?? []) as OrderRow[];
	const blocchi = new Map<string, Blocco>();
	for (const r of rows) {
		const slug = r.product_slug ?? 'altro';
		const pl = CON_PLASTIFICA.has(slug) ? plastifica(r) : null;
		const key = pl ? `${slug}:${pl}` : slug;
		const title = `${PRODOTTO[slug] ?? r.product_name}${pl ? ` con plastifica ${pl}` : ''}`;
		const b = blocchi.get(key) ?? { key, title, items: [], pezzi: 0 };
		const size = r.width_mm && r.height_mm ? `${r.width_mm}×${r.height_mm} mm` : (r.description ?? '').match(/\d+\s*[x×]\s*\d+\s*(mm|cm)/i)?.[0].replace(/\s+/g, '').replace('x', '×') ?? '—';
		const mat = r.materiale ? (MATERIAL_LABEL[r.materiale] ?? r.materiale) : (r.description ?? '').split(',')[1]?.trim() || '—';
		b.items.push({ id: r.id, group: r.checkout_group ?? r.id, number: r.number, customer: r.customer_name ?? r.email ?? '', thumb: thumbOf(r), product: r.product_name, size, material: mat, forma: r.forma, qty: r.qty, express: !!r.express, shipBy: r.ship_by ?? null, status: r.status, studio: studioOrderHref(r.product_slug, r.id), notes: r.notes ?? null, manual: r.channel === 'manuale' });
		b.pezzi += r.qty;
		blocchi.set(key, b);
	}
	const ordine = (k: string) => { const i = ORDINE_BLOCCHI.indexOf(k.split(':')[0]); return i < 0 ? 99 : i * 3 + (k.endsWith(':lucida') ? 1 : k.endsWith(':opaca') ? 2 : 0); };
	return { today, target, blocchi: [...blocchi.values()].sort((a, b) => ordine(a.key) - ordine(b.key)), totale: rows.length };
};

export const actions: Actions = {
	stato: async ({ request, locals: { supabase, user } }) => {
		const f = await request.formData();
		const r = await cambiaStato(supabase, user, String(f.get('group') ?? ''), String(f.get('status') ?? ''));
		return r.ok ? { ok: true, message: r.message } : fail(r.code, { error: r.error });
	}
};
