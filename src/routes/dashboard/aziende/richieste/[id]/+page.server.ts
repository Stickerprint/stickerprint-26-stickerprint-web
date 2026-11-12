import { error, fail, redirect } from '@sveltejs/kit';
import { deleteRequest, draftFromRequest, getQuote, getRequest, linkRequestContact, listRequestMessages, markRequestRead, replyRequest, saveQuote, signedRequestFiles, type RequestFile, setRequestNotes, setRequestStatus } from '$lib/server/richieste';
import { operatorName } from '$lib/server/produzione';
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
	const messages = await listRequestMessages(supabase, r.id);
	const files = await signedRequestFiles(supabase, messages);
	return { r, file, quotes: quotes ?? [], contact, others: others ?? [], messages, files };
};

export const actions: Actions = {
	/** Risposta al cliente direttamente dal sito (Mattia, 7/11/2026), come nelle richieste di aiuto */
	rispondi: async ({ request, params, locals }) => {
		const f = await request.formData();
		/* allegati: il browser li ha gia' caricati nel bucket requests (cartella di questa richiesta) e qui arriva solo l'elenco */
		let files: RequestFile[] = [];
		try {
			const raw: unknown = JSON.parse(String(f.get('files') ?? '[]'));
			const dentro = new RegExp(`^aziende/out/${params.id}/[a-z0-9-]+\\.[a-z0-9]{1,8}$`);
			if (Array.isArray(raw)) files = raw.filter((x): x is RequestFile => !!x && typeof x.path === 'string' && dentro.test(x.path) && typeof x.name === 'string' && !!x.name.trim())
				.slice(0, 5).map((x) => ({ path: x.path, name: x.name.trim().slice(0, 120), size: Number(x.size) || 0, type: typeof x.type === 'string' ? x.type.slice(0, 100) : undefined }));
		} catch { return fail(400, { error: 'Elenco degli allegati non valido.' }); }
		const res = await replyRequest(locals.supabase, params.id, String(f.get('body') ?? ''), await operatorName(locals.supabase, locals.user), files);
		return res.ok ? { ok: true, message: `Risposta inviata a ${res.email}${files.length ? ` con ${files.length === 1 ? 'un allegato' : files.length + ' allegati'}` : ''}.` } : fail(400, { error: res.error });
	},
	/** Elimina la richiesta (risposte e allegati compresi) e torna all'elenco */
	elimina: async ({ params, locals: { supabase } }) => {
		const res = await deleteRequest(supabase, params.id);
		if (!res.ok) return fail(400, { error: res.error });
		redirect(303, `/dashboard/aziende/richieste?eliminata=${encodeURIComponent(res.name)}${res.quotes ? `&preventivi=${res.quotes}` : ''}`);
	},
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
