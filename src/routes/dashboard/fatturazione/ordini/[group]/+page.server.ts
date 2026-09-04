import { error, fail, redirect } from '@sveltejs/kit';
import { groupOrders, ORDER_STATUS, type OrderRow } from '$lib/dashboard/orders';
import { loadEditorData, parseDraft, saveOrderDraft, sendOrderConfirmation, upsertContact } from '$lib/server/orders';
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
	const [{ data: invoices }, { data: ddts }, editor] = await Promise.all([
		supabase.from('invoices').select('id, number, issued_at, amount_gross').eq('checkout_group', group.key),
		supabase.from('ddts').select('id, number, issued_at').eq('checkout_group', group.key),
		loadEditorData(supabase)
	]);
	return { group, files, invoices: invoices ?? [], ddts: ddts ?? [], created: url.searchParams.get('creato'), mail: url.searchParams.get('mail'), ...editor };
};

export const actions: Actions = {
	save: async ({ request, params, locals: { supabase } }) => {
		const f = await request.formData();
		const d = parseDraft(f.get('payload'));
		if (!d) return fail(400, { error: 'Dati non leggibili.' });
		const ed = await loadEditorData(supabase);
		const r = await saveOrderDraft(supabase, d, params.group, ed);
		if (r.error) return fail(400, { error: r.error });
		return { ok: true, saved: true, message: 'Ordine salvato.' };
	},
	confirm: async ({ request, params, locals: { supabase } }) => {
		const f = await request.formData();
		const d = parseDraft(f.get('payload'));
		if (d) {
			const ed = await loadEditorData(supabase);
			const r = await saveOrderDraft(supabase, d, params.group, ed);
			if (r.error) return fail(400, { error: r.error });
		}
		const m = await sendOrderConfirmation(supabase, params.group);
		if (!m.ok) return fail(400, { error: m.message });
		return { ok: true, saved: !!d, message: m.message };
	},
	contact: async ({ request, locals: { supabase } }) => {
		const f = await request.formData();
		const d = parseDraft(f.get('payload'));
		if (!d) return fail(400, { error: 'Dati non leggibili.' });
		const r = await upsertContact(supabase, d.customer, d.contact_id);
		if (r.error) return fail(400, { error: r.error });
		return { ok: true, contactId: r.id, contactMsg: 'Cliente salvato in anagrafica.' };
	},
	status: async ({ request, params, locals: { supabase } }) => {
		const f = await request.formData();
		const status = String(f.get('status'));
		if (!ORDER_STATUS[status]) return fail(400, { error: 'Stato non valido.' });
		const stage = String(f.get('prod_stage') ?? '') || null;
		const q = f.get('item') ? supabase.from('orders').update({ status, prod_stage: stage }).eq('id', String(f.get('item'))) : supabase.from('orders').update({ status, prod_stage: stage }).eq('checkout_group', params.group);
		const { error: e } = await q;
		if (e) return fail(400, { error: e.message });
		return { ok: true, message: 'Stato aggiornato.' };
	},
	tracking: async ({ request, params, locals: { supabase } }) => {
		const f = await request.formData();
		const { error: e } = await supabase.from('orders').update({ tracking_url: String(f.get('tracking') ?? '').trim() || null }).eq('checkout_group', params.group);
		if (e) return fail(400, { error: e.message });
		return { ok: true, message: 'Tracking salvato.' };
	},
	delete: async ({ params, locals: { supabase } }) => {
		const { error: e } = await supabase.from('orders').delete().eq('checkout_group', params.group);
		if (e) return fail(400, { error: e.message });
		redirect(303, '/dashboard/fatturazione/ordini');
	}
};
