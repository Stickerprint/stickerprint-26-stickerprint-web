import { fail } from '@sveltejs/kit';
import type { Order } from '$lib/account';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals: { supabase, user } }) => {
	const [{ data: orders }, { data: reviews }] = await Promise.all([
		supabase.from('orders').select('*').eq('user_id', user!.id).eq('status', 'consegnato').order('created_at', { ascending: false }),
		supabase.from('reviews').select('id, order_id, rating, title, comment, created_at').eq('user_id', user!.id)
	]);
	const done = new Map((reviews ?? []).map((r) => [r.order_id, r]));
	const all = (orders ?? []) as Order[];
	return { toReview: all.filter((o) => !done.has(o.id)), reviewed: all.filter((o) => done.has(o.id)).map((o) => ({ order: o, review: done.get(o.id)! })) };
};

export const actions: Actions = {
	default: async ({ request, locals: { supabase, user } }) => {
		const f = await request.formData();
		const rating = Number(f.get('rating'));
		if (!(rating >= 1 && rating <= 5)) return fail(400, { error: 'Scegli da 1 a 5 stelle.' });
		const { error } = await supabase.from('reviews').insert({ user_id: user!.id, order_id: String(f.get('order_id')), rating, title: String(f.get('title') ?? '').trim() || null, comment: String(f.get('comment') ?? '').trim() || null });
		if (error) return fail(400, { error: error.message });
		return { ok: true };
	}
};
