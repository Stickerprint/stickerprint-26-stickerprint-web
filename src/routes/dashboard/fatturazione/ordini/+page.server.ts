import { fail } from '@sveltejs/kit';
import { groupOrders, type OrderRow } from '$lib/dashboard/orders';
import { ensurePlan, operatorName } from '$lib/server/produzione';
import { inviaRichiestaRecensione } from '$lib/server/recensioni';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url, locals: { supabase } }) => {
	// anno di riferimento: si può tornare indietro agli anni precedenti
	const year = Number(url.searchParams.get('anno')) || new Date().getFullYear();
	/* gli ordini e-commerce compaiono solo a pagamento riuscito: quelli fermi al passo del pagamento (carrelli abbandonati su Stripe/PayPal) restano fuori dall'elenco */
	const { data } = await supabase.from('orders').select('*').gte('created_at', `${year}-01-01`).lt('created_at', `${year + 1}-01-01`).or('channel.neq.ecommerce,status.neq.attesa_pagamento').order('created_at', { ascending: false }).limit(2000);
	const { data: first } = await supabase.from('orders').select('created_at').order('created_at', { ascending: true }).limit(1).maybeSingle();
	const firstYear = first ? new Date(first.created_at).getFullYear() : year;
	return { groups: groupOrders((data ?? []) as OrderRow[]), year, years: Array.from({ length: Math.max(1, new Date().getFullYear() - Math.min(firstYear, new Date().getFullYear() - 2) + 1) }, (_, i) => new Date().getFullYear() - i) };
};

/* La "chiave" di un ordine e' il checkout_group, ma gli ordini che non ce l'hanno (manuali e quelli
   vecchi) sono identificati dall'id della riga: le azioni devono cercare in tutti e due i modi,
   altrimenti rispondono "ordine non trovato". */
const UUID = /^[0-9a-f-]{36}$/i;
async function righeDelGruppo(supabase: App.Locals['supabase'], key: string): Promise<OrderRow[]> {
	const { data } = await supabase.from('orders').select('*').eq('checkout_group', key);
	if (data?.length) return data as OrderRow[];
	if (!UUID.test(key)) return [];
	const { data: uno } = await supabase.from('orders').select('*').eq('id', key);
	return (uno ?? []) as OrderRow[];
}
/** aggiorna tutte le righe dell'ordine, qualunque sia la chiave */
async function aggiornaGruppo(supabase: App.Locals['supabase'], key: string, patch: Record<string, unknown>, rows: OrderRow[]) {
	const ids = rows.map((r) => r.id);
	return supabase.from('orders').update(patch).in('id', ids);
}

export const actions: Actions = {
	/** "Inizia produzione": l'ordine entra nella coda (stato in produzione, prima lavorazione stampa, piano delle lavorazioni creato) */
	produzione: async ({ request, locals: { supabase, user } }) => {
		const f = await request.formData();
		const key = String(f.get('group') ?? '');
		const rows = await righeDelGruppo(supabase, key);
		if (!rows.length) return fail(404, { error: 'Ordine non trovato.' });
		const daFare = rows.filter((r) => r.status !== 'annullato');
		const { error } = await aggiornaGruppo(supabase, key, { status: 'in_produzione', prod_stage: 'stampa' }, daFare);
		if (error) return fail(400, { error: error.message });
		await ensurePlan(supabase, (await righeDelGruppo(supabase, key)) as OrderRow[], await operatorName(supabase, user));
		return { ok: true, started: groupOrders(rows)[0].number };
	},
	/** manda a mano la richiesta di recensione di un ordine consegnato */
	recensione: async ({ request, url, locals: { supabase } }) => {
		const f = await request.formData();
		const rows = await righeDelGruppo(supabase, String(f.get('group') ?? ''));
		if (!rows.length) return fail(404, { error: 'Ordine non trovato.' });
		if (rows[0].status !== 'consegnato') return fail(400, { error: 'La recensione si chiede solo sugli ordini consegnati.' });
		const r = await inviaRichiestaRecensione(supabase, rows as never, url.origin);
		return r.ok ? { ok: true, message: r.message } : fail(400, { error: r.message });
	},
	star: async ({ request, locals: { supabase } }) => {
		const f = await request.formData();
		const key = String(f.get('group') ?? '');
		const rows = await righeDelGruppo(supabase, key);
		if (!rows.length) return fail(404, { error: 'Ordine non trovato.' });
		const { error } = await aggiornaGruppo(supabase, key, { starred: f.get('on') === '1' }, rows);
		if (error) return fail(400, { error: error.message });
		return { ok: true };
	},
	delete: async ({ request, locals: { supabase } }) => {
		const f = await request.formData();
		const rows = await righeDelGruppo(supabase, String(f.get('group') ?? ''));
		if (!rows.length) return fail(404, { error: 'Ordine non trovato.' });
		const { error } = await supabase.from('orders').delete().in('id', rows.map((r) => r.id));
		if (error) return fail(400, { error: error.message });
		return { ok: true };
	}
};
