import { fail, redirect } from '@sveltejs/kit';
import { loadEditorData, parseDraft, upsertContact } from '$lib/server/orders';
import { getQuote, saveQuote } from '$lib/server/richieste';
import { today, type OrderDraft } from '$lib/dashboard/orderDraft';
import type { Actions, PageServerLoad } from './$types';

/** Duplica: ?da=<id> apre l'editor con la bozza di quel preventivo; si salva come preventivo NUOVO (numero nuovo) */
export const load: PageServerLoad = async ({ url, locals: { supabase } }) => {
	const ed = await loadEditorData(supabase);
	const da = url.searchParams.get('da');
	let draft: OrderDraft | null = null, from: string | null = null;
	if (da && /^[0-9a-f-]{36}$/.test(da)) {
		const q = await getQuote(supabase, da);
		if (q) { draft = { ...(q.draft as OrderDraft), date: today() }; draft.items = (draft.items ?? []).map((i) => ({ ...i, id: null, number: null })); from = q.number + (q.version > 1 ? ` rev. ${q.version}` : ''); }
	}
	return { ...ed, draft, from };
};

export const actions: Actions = {
	save: async ({ request, locals: { supabase } }) => {
		const d = parseDraft((await request.formData()).get('payload'));
		if (!d) return fail(400, { error: 'Dati non leggibili.' });
		const r = await saveQuote(supabase, d, null);
		if (r.error) return fail(400, { error: r.error });
		redirect(303, `/dashboard/aziende/preventivi/${r.id}?creato=${r.number}`);
	},
	confirm: async ({ request, locals: { supabase } }) => {
		const d = parseDraft((await request.formData()).get('payload'));
		if (!d) return fail(400, { error: 'Dati non leggibili.' });
		const r = await saveQuote(supabase, d, null);
		if (r.error) return fail(400, { error: r.error });
		redirect(303, `/dashboard/aziende/preventivi/${r.id}?creato=${r.number}&invia=1`);
	},
	contact: async ({ request, locals: { supabase } }) => {
		const d = parseDraft((await request.formData()).get('payload'));
		if (!d) return fail(400, { error: 'Dati non leggibili.' });
		const r = await upsertContact(supabase, d.customer, d.contact_id);
		if (r.error) return fail(400, { error: r.error });
		return { ok: true, contactId: r.id, contactMsg: 'Cliente salvato in anagrafica.' };
	}
};
