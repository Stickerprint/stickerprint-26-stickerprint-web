import { fail } from '@sveltejs/kit';
import type { PaymentMethod } from '$lib/dashboard/payments';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals: { supabase } }) => {
	const { data } = await supabase.from('payment_methods').select('*').order('sort').order('name');
	return { methods: (data ?? []) as PaymentMethod[] };
};
export const actions: Actions = {
	save: async ({ request, locals: { supabase } }) => {
		const f = await request.formData();
		const s = (k: string) => String(f.get(k) ?? '').trim();
		const row = { name: s('name').slice(0, 80), xml_code: s('xml_code') || 'MP05', days: Number(f.get('days') ?? 0), end_of_month: f.get('end_of_month') === 'on', installments: Math.max(1, Number(f.get('installments') ?? 1)), paid_upfront: f.get('paid_upfront') === 'on', custom: f.get('custom') === 'on', active: f.get('active') !== 'off', sort: Number(f.get('sort') ?? 0) };
		if (!row.name) return fail(400, { error: 'Il nome è obbligatorio.' });
		const id = s('id');
		const { error } = id ? await supabase.from('payment_methods').update(row).eq('id', id) : await supabase.from('payment_methods').insert(row);
		if (error) return fail(400, { error: error.code === '23505' ? 'Esiste già un metodo con questo nome.' : error.message });
		return { ok: true };
	},
	delete: async ({ request, locals: { supabase } }) => {
		const f = await request.formData();
		const { error } = await supabase.from('payment_methods').delete().eq('id', String(f.get('id')));
		if (error) return fail(400, { error: error.message });
		return { ok: true };
	}
};
