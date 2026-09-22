import { fail } from '@sveltejs/kit';
import { groupOrders, type OrderRow } from '$lib/dashboard/orders';
import { ensurePlan, operatorName } from '$lib/server/produzione';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url, locals: { supabase } }) => {
	// anno di riferimento: si può tornare indietro agli anni precedenti
	const year = Number(url.searchParams.get('anno')) || new Date().getFullYear();
	const { data } = await supabase.from('orders').select('*').gte('created_at', `${year}-01-01`).lt('created_at', `${year + 1}-01-01`).order('created_at', { ascending: false }).limit(2000);
	const { data: first } = await supabase.from('orders').select('created_at').order('created_at', { ascending: true }).limit(1).maybeSingle();
	const firstYear = first ? new Date(first.created_at).getFullYear() : year;
	return { groups: groupOrders((data ?? []) as OrderRow[]), year, years: Array.from({ length: Math.max(1, new Date().getFullYear() - Math.min(firstYear, new Date().getFullYear() - 2) + 1) }, (_, i) => new Date().getFullYear() - i) };
};

export const actions: Actions = {
	/** "Inizia produzione": l'ordine entra nella coda (stato in produzione, prima lavorazione stampa, piano delle lavorazioni creato) */
	produzione: async ({ request, locals: { supabase, user } }) => {
		const f = await request.formData();
		const group = String(f.get('group') ?? '');
		const { data } = await supabase.from('orders').select('*').eq('checkout_group', group);
		if (!data?.length) return fail(404, { error: 'Ordine non trovato.' });
		const { error } = await supabase.from('orders').update({ status: 'in_produzione', prod_stage: 'stampa' }).eq('checkout_group', group).neq('status', 'annullato');
		if (error) return fail(400, { error: error.message });
		const { data: rows } = await supabase.from('orders').select('*').eq('checkout_group', group);
		await ensurePlan(supabase, (rows ?? []) as OrderRow[], await operatorName(supabase, user));
		return { ok: true, started: groupOrders(data as OrderRow[])[0].number };
	},
	star: async ({ request, locals: { supabase } }) => {
		const f = await request.formData();
		const { error } = await supabase.from('orders').update({ starred: f.get('on') === '1' }).eq('checkout_group', String(f.get('group')));
		if (error) return fail(400, { error: error.message });
		return { ok: true };
	},
	delete: async ({ request, locals: { supabase } }) => {
		const f = await request.formData();
		const { error } = await supabase.from('orders').delete().eq('checkout_group', String(f.get('group')));
		if (error) return fail(400, { error: error.message });
		return { ok: true };
	}
};
