import { error, fail } from '@sveltejs/kit';
import { createClient } from '@supabase/supabase-js';
import { env } from '$env/dynamic/private';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';
import { submitReview } from '$lib/server/recensioni';
import type { Actions, PageServerLoad } from './$types';

/** Recensione da link email (anche ospiti): l'id ordine fa da chiave, una recensione per ordine */
const admin = () => (env.SUPABASE_SERVICE_ROLE_KEY ? createClient(PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } }) : null);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const load: PageServerLoad = async ({ params }) => {
	const db = admin();
	if (!db || !UUID.test(params.id)) error(404, 'Ordine non trovato');
	/* il link puo' portare l'id della riga (un prodotto) o l'id dell'ordine intero (checkout_group) */
	const { data: found } = await db.from('orders').select('id, number, checkout_group, user_id, shipping, product_name, qty, status').or(`id.eq.${params.id},checkout_group.eq.${params.id}`).order('created_at').limit(1);
	const o = found?.[0];
	if (!o) error(404, 'Ordine non trovato');
	const { data: items } = await db.from('orders').select('product_name, qty').eq(o.checkout_group ? 'checkout_group' : 'id', o.checkout_group ?? o.id);
	const { data: existing } = await db.from('reviews').select('id, rating, coupon_code').eq('order_id', o.id).maybeSingle();
	return { number: o.number, name: o.shipping?.first_name ?? '', items: (items ?? []).map((i) => `${i.qty} × ${i.product_name}`), done: !!existing, code: existing?.coupon_code ?? null };
};

export const actions: Actions = {
	default: async ({ request, params, url }) => {
		const db = admin();
		if (!db || !UUID.test(params.id)) return fail(400, { error: 'Ordine non trovato.' });
		const f = await request.formData();
		const { data: found } = await db.from('orders').select('id, number, user_id, email, shipping, product_slug').or(`id.eq.${params.id},checkout_group.eq.${params.id}`).order('created_at').limit(1);
		const o = found?.[0];
		if (!o) return fail(404, { error: 'Ordine non trovato.' });
		const author = [o.shipping?.first_name, o.shipping?.last_name].filter(Boolean).join(' ') || null;
		const r = await submitReview(db, { orderId: o.id, userId: o.user_id ?? null, email: o.email ?? null, author, productSlug: o.product_slug ?? null, rating: Number(f.get('rating') ?? 5), title: String(f.get('title') ?? '').trim() || null, comment: String(f.get('comment') ?? '').trim() || null, number: o.number, origin: url.origin });
		if (!r.ok) return fail(400, { error: r.error });
		return { ok: true, code: r.code };
	}
};
