import { error } from '@sveltejs/kit';
import { groupOrders, type OrderRow } from '$lib/dashboard/orders';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals: { supabase } }) => {
	const [{ data: p }, { data: loyalty }, { data: orders }, { data: invoices }, { data: addresses }] = await Promise.all([
		supabase.from('profiles').select('*').eq('id', params.id).maybeSingle(),
		supabase.from('loyalty').select('*, loyalty_levels(name, credit_rate)').eq('user_id', params.id).maybeSingle(),
		supabase.from('orders').select('*').eq('user_id', params.id).order('created_at', { ascending: false }),
		supabase.from('invoices').select('id, number, issued_at, amount_gross').eq('user_id', params.id).order('issued_at', { ascending: false }),
		supabase.from('addresses').select('*').eq('user_id', params.id)
	]);
	if (!p) error(404, 'Cliente non trovato');
	const groups = groupOrders((orders ?? []) as OrderRow[]);
	const spent = groups.filter((g) => g.status !== 'annullato').reduce((s, g) => s + g.net, 0);
	return { p, loyalty, groups, invoices: invoices ?? [], addresses: addresses ?? [], spent, avg: groups.length ? spent / groups.length : 0 };
};
