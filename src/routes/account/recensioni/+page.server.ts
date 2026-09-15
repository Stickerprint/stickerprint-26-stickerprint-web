import { fail } from '@sveltejs/kit';
import type { Order } from '$lib/account';
import { markReviewRequestClicked, submitReview } from '$lib/server/recensioni';
import { adminClient } from '$lib/server/admin';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url, locals: { supabase, user } }) => {
	{ const a = adminClient(); if (a) await markReviewRequestClicked(a, url.searchParams.get('r')); }
	const [{ data: orders }, { data: reviews }] = await Promise.all([
		supabase.from('orders').select('*').eq('user_id', user!.id).eq('status', 'consegnato').order('created_at', { ascending: false }),
		supabase.from('reviews').select('id, order_id, rating, title, comment, created_at, status, coupon_code').eq('user_id', user!.id)
	]);
	const done = new Map((reviews ?? []).map((r) => [r.order_id, r]));
	const all = (orders ?? []) as Order[];
	return { toReview: all.filter((o) => !done.has(o.id)), reviewed: all.filter((o) => done.has(o.id)).map((o) => ({ order: o, review: done.get(o.id)! })) };
};

export const actions: Actions = {
	default: async ({ request, url, locals: { supabase, user } }) => {
		const f = await request.formData();
		const rating = Number(f.get('rating'));
		if (!(rating >= 1 && rating <= 5)) return fail(400, { error: 'Scegli da 1 a 5 stelle.' });
		const { data: o } = await supabase.from('orders').select('id, number, email, shipping, product_slug').eq('id', String(f.get('order_id'))).eq('user_id', user!.id).maybeSingle();
		if (!o) return fail(404, { error: 'Ordine non trovato.' });
		const author = [o.shipping?.first_name, o.shipping?.last_name].filter(Boolean).join(' ') || null;
		const r = await submitReview(supabase, { orderId: o.id, userId: user!.id, email: user!.email ?? o.email ?? null, author, productSlug: o.product_slug ?? null, rating, title: String(f.get('title') ?? '').trim() || null, comment: String(f.get('comment') ?? '').trim() || null, number: o.number, origin: url.origin });
		if (!r.ok) return fail(400, { error: r.error });
		return { ok: true, code: r.code };
	}
};
