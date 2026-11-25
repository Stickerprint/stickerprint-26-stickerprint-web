/**
 * Metodo di pagamento abituale del cliente (anagrafica, solo aziende): migrazione 0064, Mattia 25/11/2026.
 * Qui la lettura per la fattura creata dai DDT; la regola sta in $lib/dashboard/payments (metodoAbituale, scadenzeFattura).
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { metodoAbituale, type PaymentMethod } from '$lib/dashboard/payments';

/** L'anagrafica del cliente di un ordine: quella collegata all'ordine, altrimenti quella con la stessa partita IVA */
async function anagraficaDi(db: SupabaseClient, group: string | null, vat: string | null | undefined) {
	if (group) {
		const { data: righe } = await db.from('orders').select('contact_id').eq('checkout_group', group).not('contact_id', 'is', null).limit(1);
		const id = righe?.[0]?.contact_id as string | undefined;
		if (id) { const { data } = await db.from('contacts').select('*').eq('id', id).maybeSingle(); if (data) return data; }
	}
	const piva = String(vat ?? '').trim();
	if (!piva) return null;
	/* la partita IVA puo' essere scritta con o senza IT davanti */
	const senza = piva.replace(/^IT/i, '');
	const { data } = await db.from('contacts').select('*').in('vat', [...new Set([piva, senza, `IT${senza}`])]).limit(1);
	return data?.[0] ?? null;
}

/** Il metodo abituale del cliente di quell'ordine, e se l'ordine risulta gia' pagato (allora le scadenze non si toccano) */
export async function metodoDelCliente(db: SupabaseClient, group: string | null, vat: string | null | undefined): Promise<{ metodo: PaymentMethod | null; pagato: boolean }> {
	const [c, { data: methods }, { data: righe }] = await Promise.all([
		anagraficaDi(db, group, vat),
		db.from('payment_methods').select('*').eq('active', true),
		group ? db.from('orders').select('payment_status, status').eq('checkout_group', group) : Promise.resolve({ data: [] as { payment_status: string | null; status: string }[] })
	]);
	const vive = (righe ?? []).filter((r) => r.status !== 'annullato');
	return { metodo: metodoAbituale(c, (methods ?? []) as PaymentMethod[]), pagato: vive.length > 0 && vive.every((r) => r.payment_status === 'paid') };
}
