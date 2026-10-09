/** Righe di un ordine per chiave (checkout_group o id) e cambio stato a mano, condivisi da Ordini e Da fare oggi. */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { User } from '@supabase/supabase-js';
import { groupOrders, ORDER_STATUS, type OrderRow } from '$lib/dashboard/orders';
import { ensurePlan, operatorName } from './produzione';

const UUID = /^[0-9a-f-]{36}$/i;
/** le righe dell'ordine: per checkout_group, altrimenti per id della riga (ordini vecchi senza gruppo) */
export async function righeDelGruppo(supabase: SupabaseClient, key: string): Promise<OrderRow[]> {
	const { data } = await supabase.from('orders').select('*').eq('checkout_group', key);
	if (data?.length) return data as OrderRow[];
	if (!UUID.test(key)) return [];
	const { data: uno } = await supabase.from('orders').select('*').eq('id', key);
	return (uno ?? []) as OrderRow[];
}
/** aggiorna tutte le righe dell'ordine, qualunque sia la chiave */
export async function aggiornaGruppo(supabase: SupabaseClient, key: string, patch: Record<string, unknown>, rows: OrderRow[]) {
	return supabase.from('orders').update(patch).in('id', rows.map((r) => r.id));
}
/** cambio stato dalla tendina: in produzione riparte dalla stampa, spedito/consegnato segnano la data */
export async function cambiaStato(supabase: SupabaseClient, user: User | null, key: string, status: string): Promise<{ ok: true; message: string } | { ok: false; error: string; code: number }> {
	if (!ORDER_STATUS[status]) return { ok: false, error: 'Stato non valido.', code: 400 };
	const rows = await righeDelGruppo(supabase, key);
	if (!rows.length) return { ok: false, error: 'Ordine non trovato.', code: 404 };
	const patch: Record<string, unknown> = { status, prod_stage: status === 'in_produzione' ? 'stampa' : null };
	if (status === 'consegnato') patch.delivered_at = new Date().toISOString();
	if (status === 'spedito') patch.shipped_at = new Date().toISOString();
	const { error } = await aggiornaGruppo(supabase, key, patch, rows);
	if (error) return { ok: false, error: error.message, code: 400 };
	await ensurePlan(supabase, (await righeDelGruppo(supabase, key)) as OrderRow[], await operatorName(supabase, user));
	return { ok: true, message: `${groupOrders(rows)[0].number}: stato aggiornato a "${ORDER_STATUS[status].label}".` };
}
