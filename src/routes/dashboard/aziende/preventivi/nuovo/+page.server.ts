import { fail, redirect } from '@sveltejs/kit';
import { loadEditorData, parseDraft, upsertContact } from '$lib/server/orders';
import { saveQuote, sendQuote } from '$lib/server/richieste';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals: { supabase } }) => loadEditorData(supabase);

export const actions: Actions = {
	save: async ({ request, locals: { supabase } }) => {
		const d = parseDraft((await request.formData()).get('payload'));
		if (!d) return fail(400, { error: 'Dati non leggibili.' });
		const r = await saveQuote(supabase, d, null);
		if (r.error) return fail(400, { error: r.error });
		redirect(303, `/dashboard/aziende/preventivi/${r.id}?creato=${r.number}`);
	},
	confirm: async ({ request, url, locals: { supabase } }) => {
		const d = parseDraft((await request.formData()).get('payload'));
		if (!d) return fail(400, { error: 'Dati non leggibili.' });
		const r = await saveQuote(supabase, d, null);
		if (r.error) return fail(400, { error: r.error });
		const m = await sendQuote(supabase, r.id, url.origin, null);
		redirect(303, `/dashboard/aziende/preventivi/${r.id}?creato=${r.number}&mail=${encodeURIComponent(m.message)}`);
	},
	contact: async ({ request, locals: { supabase } }) => {
		const d = parseDraft((await request.formData()).get('payload'));
		if (!d) return fail(400, { error: 'Dati non leggibili.' });
		const r = await upsertContact(supabase, d.customer, d.contact_id);
		if (r.error) return fail(400, { error: r.error });
		return { ok: true, contactId: r.id, contactMsg: 'Cliente salvato in anagrafica.' };
	}
};
