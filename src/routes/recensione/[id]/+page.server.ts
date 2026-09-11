import { error, fail } from '@sveltejs/kit';
import { createClient } from '@supabase/supabase-js';
import { env } from '$env/dynamic/private';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';
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
	const { data: existing } = await db.from('reviews').select('id, rating').eq('order_id', o.id).maybeSingle();
	return { number: o.number, name: o.shipping?.first_name ?? '', items: (items ?? []).map((i) => `${i.qty} × ${i.product_name}`), done: !!existing };
};

export const actions: Actions = {
	default: async ({ request, params }) => {
		const db = admin();
		if (!db || !UUID.test(params.id)) return fail(400, { error: 'Ordine non trovato.' });
		const f = await request.formData();
		const rating = Math.max(1, Math.min(5, Number(f.get('rating') ?? 5)));
		const { data: found } = await db.from('orders').select('id, user_id, email, shipping').or(`id.eq.${params.id},checkout_group.eq.${params.id}`).order('created_at').limit(1);
		const o = found?.[0];
		if (!o) return fail(404, { error: 'Ordine non trovato.' });
		const author = [o.shipping?.first_name, o.shipping?.last_name].filter(Boolean).join(' ') || null;
		const { error: e } = await db.from('reviews').insert({ user_id: o.user_id ?? null, order_id: o.id, rating, title: String(f.get('title') ?? '').trim().slice(0, 120) || null, comment: String(f.get('comment') ?? '').trim().slice(0, 2000) || null, author, email: o.email ?? null });
		if (e) return fail(400, { error: /duplicate|unique/i.test(e.message) ? 'Hai già lasciato una recensione per questo ordine, grazie!' : e.message });
		return { ok: true };
	}
};
