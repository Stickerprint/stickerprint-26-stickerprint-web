import { error, fail, redirect } from '@sveltejs/kit';
import { groupOrders, type OrderRow } from '$lib/dashboard/orders';
import { upsertContact } from '$lib/server/orders';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals: { supabase } }) => {
	const { data: p } = await supabase.from('profiles').select('*').eq('id', params.id).maybeSingle();
	if (p) {
		const [{ data: loyalty }, { data: orders }, { data: invoices }, { data: addresses }] = await Promise.all([
			supabase.from('loyalty').select('*, loyalty_levels(name, credit_rate)').eq('user_id', params.id).maybeSingle(),
			supabase.from('orders').select('*').eq('user_id', params.id).order('created_at', { ascending: false }),
			supabase.from('invoices').select('id, number, issued_at, amount_gross').eq('user_id', params.id).order('issued_at', { ascending: false }),
			supabase.from('addresses').select('*').eq('user_id', params.id)
		]);
		const groups = groupOrders((orders ?? []) as OrderRow[]);
		const spent = groups.filter((g) => g.status !== 'annullato').reduce((s, g) => s + g.net, 0);
		return { kind: 'profile' as const, p, contact: null, loyalty, groups, invoices: invoices ?? [], addresses: addresses ?? [], spent, avg: groups.length ? spent / groups.length : 0 };
	}
	const { data: c } = await supabase.from('contacts').select('*').eq('id', params.id).maybeSingle();
	if (!c) error(404, 'Cliente non trovato');
	const email = (c.email ?? '').toLowerCase();
	const [{ data: orders }, { data: invoices }] = await Promise.all([
		email ? supabase.from('orders').select('*').or(`contact_id.eq.${c.id},email.ilike.${email}`).order('created_at', { ascending: false }) : supabase.from('orders').select('*').eq('contact_id', c.id).order('created_at', { ascending: false }),
		email ? supabase.from('invoices').select('id, number, issued_at, amount_gross').ilike('email', email).order('issued_at', { ascending: false }) : Promise.resolve({ data: [] })
	]);
	const groups = groupOrders((orders ?? []) as OrderRow[]);
	const spent = groups.filter((g) => g.status !== 'annullato').reduce((s, g) => s + g.net, 0);
	return { kind: 'contact' as const, p: null, contact: c, loyalty: null, groups, invoices: invoices ?? [], addresses: [], spent, avg: groups.length ? spent / groups.length : 0 };
};

export const actions: Actions = {
	update: async ({ request, params, locals: { supabase } }) => {
		const f = await request.formData();
		const s = (k: string) => String(f.get(k) ?? '').trim();
		const r = await upsertContact(supabase, { name: s('name'), first_name: s('first_name'), last_name: s('last_name'), address: s('address'), city: s('city'), cap: s('cap'), province: s('province'), country: s('country') || 'IT', piva: s('piva'), cf: s('cf'), sdi: s('sdi'), pec: s('pec'), email: s('email'), phone: s('phone') }, params.id);
		if (r.error) return fail(400, { error: r.error });
		await supabase.from('contacts').update({ notes: s('notes') || null }).eq('id', params.id);
		return { ok: true };
	},
	delete: async ({ params, locals: { supabase } }) => {
		const { error: e } = await supabase.from('contacts').delete().eq('id', params.id);
		if (e) return fail(400, { error: e.message });
		redirect(303, '/dashboard/anagrafica/clienti');
	}
};
