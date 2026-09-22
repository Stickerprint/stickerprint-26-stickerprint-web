import { fail, redirect } from '@sveltejs/kit';
import { loadEditorData, parseDraft, saveOrderDraft, upsertContact } from '$lib/server/orders';
import { groupOrders, type OrderRow } from '$lib/dashboard/orders';
import { draftFromGroup, today, type OrderDraft } from '$lib/dashboard/orderDraft';
import type { Actions, PageServerLoad } from './$types';

/** Duplica: ?da=<gruppo> apre l'editor gia' compilato con cliente, articoli e condizioni di quell'ordine.
    Si salva come ordine NUOVO (numero nuovo, data di oggi, nessun collegamento all'originale). */
export const load: PageServerLoad = async ({ url, locals: { supabase } }) => {
	const ed = await loadEditorData(supabase);
	const da = url.searchParams.get('da');
	let draft: OrderDraft | null = null, from: string | null = null;
	if (da) {
		const { data } = await supabase.from('orders').select('*').eq('checkout_group', da);
		if (data?.length) {
			const g = groupOrders(data as OrderRow[])[0];
			draft = draftFromGroup(g, ed.methods);
			draft.date = today(); draft.ship_date = ''; draft.contact_id = draft.contact_id ?? null;
			draft.items = draft.items.map((i) => ({ ...i, id: null, number: null }));
			draft.terms = [];   // le scadenze si ricalcolano sulla nuova data
			from = g.number;
		}
	}
	return { ...ed, draft, from };
};

export const actions: Actions = {
	save: async ({ request, locals: { supabase } }) => {
		const f = await request.formData();
		const d = parseDraft(f.get('payload'));
		if (!d) return fail(400, { error: 'Dati non leggibili.' });
		const ed = await loadEditorData(supabase);
		const r = await saveOrderDraft(supabase, d, null, ed);
		if (r.error) return fail(400, { error: r.error });
		redirect(303, `/dashboard/fatturazione/ordini/${r.group}?creato=${r.numbers[0]}`);
	},
	confirm: async ({ request, locals: { supabase } }) => {
		const f = await request.formData();
		const d = parseDraft(f.get('payload'));
		if (!d) return fail(400, { error: 'Dati non leggibili.' });
		const ed = await loadEditorData(supabase);
		const r = await saveOrderDraft(supabase, d, null, ed);
		if (r.error) return fail(400, { error: r.error });
		redirect(303, `/dashboard/fatturazione/ordini/${r.group}?creato=${r.numbers[0]}&invia=1`);
	},
	contact: async ({ request, locals: { supabase } }) => {
		const f = await request.formData();
		const d = parseDraft(f.get('payload'));
		if (!d) return fail(400, { error: 'Dati non leggibili.' });
		const r = await upsertContact(supabase, d.customer, d.contact_id);
		if (r.error) return fail(400, { error: r.error });
		return { ok: true, contactId: r.id, contactMsg: 'Cliente salvato in anagrafica.' };
	}
};
