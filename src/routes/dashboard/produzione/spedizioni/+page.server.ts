import { fail } from '@sveltejs/kit';
import { groupOrders, type OrderRow } from '$lib/dashboard/orders';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals: { supabase } }) => {
	const { data } = await supabase.from('orders').select('*').in('status', ['pronto', 'in_spedizione', 'spedito', 'in_consegna']).order('created_at', { ascending: true });
	return { groups: groupOrders((data ?? []) as OrderRow[]) };
};
export const actions: Actions = {
	status: async ({ request, locals: { supabase } }) => {
		const f = await request.formData();
		const patch: Record<string, string | null> = { status: String(f.get('status')) };
		if (f.has('tracking')) patch.tracking_url = String(f.get('tracking')).trim() || null;
		const { error } = await supabase.from('orders').update(patch).eq('checkout_group', String(f.get('group')));
		if (error) return fail(400, { error: error.message });
		return { ok: true };
	}
};
