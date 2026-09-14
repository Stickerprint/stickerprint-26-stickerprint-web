import { error, fail, redirect } from '@sveltejs/kit';
import { draftFromRequest, getQuote, getRequest, linkRequestContact, markRequestRead, saveQuote, setRequestNotes, setRequestStatus } from '$lib/server/richieste';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals: { supabase } }) => {
	const r = await getRequest(supabase, params.id);
	if (!r || r.kind !== 'aziende') error(404, 'Richiesta non trovata');
	await markRequestRead(supabase, r.id);
	let file: string | null = null;
	if (r.file_path) { const { data } = await supabase.storage.from('requests').createSignedUrl(r.file_path, 3600, { download: r.file_path.split('/').pop() }); file = data?.signedUrl ?? null; }
	const { data: quotes } = await supabase.from('quotes').select('id, number, version, status, total_gross, created_at, order_group').eq('request_id', r.id).order('created_at', { ascending: false });
	const { data: contact } = r.contact_id ? await supabase.from('contacts').select('id, name, email, phone, city').eq('id', r.contact_id).maybeSingle() : { data: null };
	// altre richieste e ticket dello stesso indirizzo
	const { data: others } = await supabase.from('contact_requests').select('id, created_at, status, message').eq('kind', 'aziende').eq('email', r.email).neq('id', r.id).order('created_at', { ascending: false }).limit(5);
	return { r, file, quotes: quotes ?? [], contact, others: others ?? [] };
};

export const actions: Actions = {
	stato: async ({ request, params, locals: { supabase } }) => {
		const e = await setRequestStatus(supabase, params.id, String((await request.formData()).get('status')));
		return e ? fail(400, { error: e }) : { ok: true, message: 'Stato aggiornato.' };
	},
	note: async ({ request, params, locals: { supabase } }) => {
		const e = await setRequestNotes(supabase, params.id, String((await request.formData()).get('notes') ?? ''));
		return e ? fail(400, { error: e }) : { ok: true, message: 'Note salvate.' };
	},
	anagrafica: async ({ params, locals: { supabase } }) => {
		const r = await getRequest(supabase, params.id);
		if (!r) return fail(404, { error: 'Richiesta non trovata.' });
		const res = await linkRequestContact(supabase, r);
		return res.error ? fail(400, { error: res.error }) : { ok: true, message: 'Cliente salvato in anagrafica.' };
	},
	/** Nuovo preventivo precompilato dalla richiesta → editor */
	preventivo: async ({ params, locals: { supabase } }) => {
		const r = await getRequest(supabase, params.id);
		if (!r) return fail(404, { error: 'Richiesta non trovata.' });
		if (!r.contact_id) await linkRequestContact(supabase, r);
		const fresh = (await getRequest(supabase, params.id)) ?? r;
		const q = await saveQuote(supabase, draftFromRequest(fresh), null, { request_id: r.id });
		if (q.error) return fail(400, { error: q.error });
		const created = await getQuote(supabase, q.id);
		redirect(303, `/dashboard/aziende/preventivi/${created?.id ?? q.id}`);
	}
};
