import { fail } from '@sveltejs/kit';
import { groupOrders, type OrderRow } from '$lib/dashboard/orders';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals: { supabase } }) => {
	const { data } = await supabase.from('orders').select('*').order('created_at', { ascending: false }).limit(1000);
	return { groups: groupOrders((data ?? []) as OrderRow[]) };
};

export const actions: Actions = {
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
