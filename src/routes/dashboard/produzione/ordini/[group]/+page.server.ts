import { error, fail, redirect } from '@sveltejs/kit';
import { groupOrders, ORDER_STATUS, type OrderRow } from '$lib/dashboard/orders';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, url, locals: { supabase } }) => {
	let { data } = await supabase.from('orders').select('*').eq('checkout_group', params.group);
	if (!data?.length) ({ data } = await supabase.from('orders').select('*').eq('id', params.group));
	if (!data?.length) error(404, 'Ordine non trovato');
	const group = groupOrders(data as OrderRow[])[0];
	// file del cliente: link temporanei (1 ora)
	const files: Record<string, string> = {};
	for (const it of group.items) {
		if (it.file_path) {
			const { data: s } = await supabase.storage.from('order-files').createSignedUrl(it.file_path, 3600);
			if (s) files[it.id] = s.signedUrl;
		}
	}
	const { data: invoices } = await supabase.from('invoices').select('id, number, issued_at, amount_gross, pdf_path').eq('checkout_group', group.key);
	return { group, files, invoices: invoices ?? [], created: url.searchParams.get('creato') };
};

export const actions: Actions = {
	status: async ({ request, params, locals: { supabase } }) => {
		const f = await request.formData();
		const status = String(f.get('status'));
		if (!ORDER_STATUS[status]) return fail(400, { error: 'Stato non valido.' });
		const stage = String(f.get('prod_stage') ?? '') || null;
		const q = f.get('item') ? supabase.from('orders').update({ status, prod_stage: stage }).eq('id', String(f.get('item'))) : supabase.from('orders').update({ status, prod_stage: stage }).eq('checkout_group', params.group);
		const { error: e } = await q;
		if (e) return fail(400, { error: e.message });
		return { ok: true };
	},
	tracking: async ({ request, params, locals: { supabase } }) => {
		const f = await request.formData();
		const { error: e } = await supabase.from('orders').update({ tracking_url: String(f.get('tracking') ?? '').trim() || null, delivery_date: String(f.get('delivery_date') ?? '') || null, internal_notes: String(f.get('internal_notes') ?? '').trim() || null }).eq('checkout_group', params.group);
		if (e) return fail(400, { error: e.message });
		return { ok: true };
	},
	delete: async ({ params, locals: { supabase } }) => {
		const { error: e } = await supabase.from('orders').delete().eq('checkout_group', params.group);
		if (e) return fail(400, { error: e.message });
		redirect(303, '/dashboard/produzione/ordini');
	}
};
