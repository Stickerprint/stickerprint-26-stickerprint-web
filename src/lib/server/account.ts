import type { SupabaseClient } from '@supabase/supabase-js';
import { loadEngine } from '$lib/server/pricing';
import type { EngineConfig } from '$lib/pricing/engine';
import type { Order } from '$lib/account';

/** Ordini dell'utente più i listini dei prodotti coinvolti (per il popup Riordina) */
export async function loadOrders(supabase: SupabaseClient, uid: string, limit?: number): Promise<{ orders: Order[]; engines: Record<string, EngineConfig> }> {
	let q = supabase.from('orders').select('*').eq('user_id', uid).order('created_at', { ascending: false });
	if (limit) q = q.limit(limit);
	const { data } = await q;
	const orders = (data ?? []) as Order[];
	/* fattura di ogni ordine (per il bottone "Scarica fattura"): per gruppo di checkout, o per riga d'ordine */
	const { data: invs } = await supabase.from('invoices').select('id, order_id, checkout_group, pdf_path').eq('user_id', uid).not('pdf_path', 'is', null);
	for (const o of orders) { const inv = (invs ?? []).find((i) => (o.checkout_group && i.checkout_group === o.checkout_group) || i.order_id === o.id); if (inv) o.invoice_id = inv.id; }
	const slugs = [...new Set(orders.map((o) => o.product_slug))];
	const engines: Record<string, EngineConfig> = {};
	await Promise.all(slugs.map(async (s) => { engines[s] = (await loadEngine(supabase, s)).config; }));
	return { orders, engines };
}
