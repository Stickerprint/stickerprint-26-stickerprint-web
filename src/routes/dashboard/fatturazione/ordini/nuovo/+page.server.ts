import { fail, redirect } from '@sveltejs/kit';
import { loadEditorData, parseDraft, saveOrderDraft, sendOrderConfirmation, upsertContact } from '$lib/server/orders';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals: { supabase } }) => loadEditorData(supabase);

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
		const m = await sendOrderConfirmation(supabase, r.group);
		redirect(303, `/dashboard/fatturazione/ordini/${r.group}?creato=${r.numbers[0]}&mail=${encodeURIComponent(m.message)}`);
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
