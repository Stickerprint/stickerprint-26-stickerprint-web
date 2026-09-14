import { error, fail, redirect } from '@sveltejs/kit';
import { loadEditorData, parseDraft, upsertContact } from '$lib/server/orders';
import { getQuote, loadQuoteMessages, markQuoteRead, newQuoteVersion, orderFromQuote, quotePdf, remindQuote, replyQuote, saveQuote, sendQuote, setQuoteStatus, setQuoteValidity, toB64 } from '$lib/server/richieste';
import { listTemplates } from '$lib/server/helpdesk';
import { operatorName } from '$lib/server/produzione';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, url, locals: { supabase, user } }) => {
	const q = await getQuote(supabase, params.id);
	if (!q) error(404, 'Preventivo non trovato');
	await markQuoteRead(supabase, q.id);
	const [editor, messages, templates, sender, { data: versions }, { data: req }] = await Promise.all([
		loadEditorData(supabase),
		loadQuoteMessages(supabase, q.id),
		listTemplates(supabase),
		operatorName(supabase, user),
		supabase.from('quotes').select('id, version, status, total_gross, created_at').eq('year', q.year).eq('seq', q.seq).order('version'),
		q.request_id ? supabase.from('contact_requests').select('id, company, name, message').eq('id', q.request_id).maybeSingle() : Promise.resolve({ data: null })
	]);
	return { q, messages, templates: templates.filter((t) => t.kind === 'preventivo'), sender, versions: versions ?? [], req, created: url.searchParams.get('creato'), openSend: url.searchParams.get('invia') === '1', ...editor };
};

export const actions: Actions = {
	save: async ({ request, params, locals: { supabase } }) => {
		const d = parseDraft((await request.formData()).get('payload'));
		if (!d) return fail(400, { error: 'Dati non leggibili.' });
		const r = await saveQuote(supabase, d, params.id);
		return r.error ? fail(400, { error: r.error }) : { ok: true, saved: true, message: 'Preventivo salvato.' };
	},
	/** Dal popup: salva la bozza corrente e manda l'email scritta dallo staff */
	invia: async ({ request, params, url, locals }) => {
		const f = await request.formData();
		const d = parseDraft(f.get('payload'));
		if (d) { const r = await saveQuote(locals.supabase, d, params.id); if (r.error) return fail(400, { error: r.error }); }
		const sender = String(f.get('sender') ?? '').trim() || (await operatorName(locals.supabase, locals.user));
		if (f.get('save_template') === 'on' && String(f.get('template_title') ?? '').trim()) {
			await locals.supabase.from('reply_templates').insert({ kind: 'preventivo', title: String(f.get('template_title')).trim(), subject: String(f.get('subject') ?? ''), body: String(f.get('message') ?? '') });
		}
		const m = await sendQuote(locals.supabase, params.id, url.origin, { to: String(f.get('to') ?? ''), cc: String(f.get('cc') ?? ''), subject: String(f.get('subject') ?? ''), message: String(f.get('message') ?? ''), sender, autoRemind: f.get('auto_remind') === 'on' });
		return m.ok ? { ok: true, sent: true, message: m.message } : fail(400, { error: m.message, sendError: true });
	},
	rispondi: async ({ request, params, url, locals }) => {
		const op = await operatorName(locals.supabase, locals.user);
		const e = await replyQuote(locals.supabase, params.id, String((await request.formData()).get('body') ?? ''), op, url.origin);
		return e ? fail(400, { error: e }) : { ok: true, message: 'Risposta inviata.' };
	},
	contact: async ({ request, locals: { supabase } }) => {
		const d = parseDraft((await request.formData()).get('payload'));
		if (!d) return fail(400, { error: 'Dati non leggibili.' });
		const r = await upsertContact(supabase, d.customer, d.contact_id);
		return r.error ? fail(400, { error: r.error }) : { ok: true, contactId: r.id, contactMsg: 'Cliente salvato in anagrafica.' };
	},
	validita: async ({ request, params, locals: { supabase } }) => {
		const e = await setQuoteValidity(supabase, params.id, String((await request.formData()).get('valid_until') ?? ''));
		return e ? fail(400, { error: e }) : { ok: true, message: 'Validità aggiornata.' };
	},
	sollecita: async ({ params, url, locals: { supabase } }) => {
		const r = await remindQuote(supabase, params.id, url.origin);
		return r.ok ? { ok: true, message: r.message } : fail(400, { error: r.message });
	},
	stato: async ({ request, params, locals: { supabase } }) => {
		const f = await request.formData();
		const e = await setQuoteStatus(supabase, params.id, String(f.get('status')) as never, String(f.get('motivo') ?? '') || null);
		return e ? fail(400, { error: e }) : { ok: true, message: 'Stato aggiornato.' };
	},
	versione: async ({ params, locals: { supabase } }) => {
		const r = await newQuoteVersion(supabase, params.id);
		if (r.error || !r.id) return fail(400, { error: r.error ?? 'Versione non creata.' });
		redirect(303, `/dashboard/aziende/preventivi/${r.id}`);
	},
	ordine: async ({ request, params, locals: { supabase } }) => {
		const f = await request.formData();
		const r = await orderFromQuote(supabase, params.id, f.get('mail') === 'on');
		if (!r.group) return fail(400, { error: r.message });
		redirect(303, `/dashboard/fatturazione/ordini/${r.group}?creato=${r.number ?? ''}&mail=${encodeURIComponent(r.message)}`);
	},
	pdf: async ({ params, locals: { supabase } }) => {
		const q = await getQuote(supabase, params.id);
		if (!q) return fail(404, { error: 'Preventivo non trovato.' });
		const pdf = await quotePdf(q);
		return { ok: true, pdf: toB64(pdf), pdfName: `Preventivo-${q.number}.pdf` };
	}
};
