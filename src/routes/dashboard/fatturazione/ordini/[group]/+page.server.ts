import { error, fail, redirect } from '@sveltejs/kit';
import { groupOrders, ORDER_STATUS, type OrderRow } from '$lib/dashboard/orders';
import { loadEditorData, parseDraft, saveOrderDraft, upsertContact } from '$lib/server/orders';
import { ensurePlan, operatorName } from '$lib/server/produzione';
import { getConfirmation, loadMessages, markConfirmationRead, remindPayment, replyCustomer, sendConfirmation, setPaymentStatus, syncPayments } from '$lib/server/conferme';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, url, locals: { supabase, user } }) => {
	let { data } = await supabase.from('orders').select('*').eq('checkout_group', params.group);
	if (!data?.length) ({ data } = await supabase.from('orders').select('*').eq('id', params.group));
	if (!data?.length) error(404, 'Ordine non trovato');
	const group = groupOrders(data as OrderRow[])[0];
	// file del cliente: link temporanei (1 ora)
	const files: Record<string, string> = {};
	/* kit di adesivi: file_path e' una cartella (cavallotto + adesivo-1..6), si elencano tutti i file */
	const fileLists: Record<string, { name: string; url: string }[]> = {};
	for (const it of group.items) {
		if (!it.file_path) continue;
		if (it.file_path.endsWith('/')) {
			const dir = it.file_path.replace(/\/$/, '');
			const { data: list } = await supabase.storage.from('order-files').list(dir, { limit: 50 });
			const out: { name: string; url: string }[] = [];
			for (const f of list ?? []) {
				const { data: s } = await supabase.storage.from('order-files').createSignedUrl(`${dir}/${f.name}`, 3600, { download: f.name });
				if (s) out.push({ name: f.name, url: s.signedUrl });
			}
			out.sort((a, b) => (a.name.startsWith('cavallotto') ? -1 : b.name.startsWith('cavallotto') ? 1 : a.name.localeCompare(b.name, 'it', { numeric: true })));
			fileLists[it.id] = out;
		} else {
			const { data: s } = await supabase.storage.from('order-files').createSignedUrl(it.file_path, 3600);
			if (s) files[it.id] = s.signedUrl;
		}
	}
	const [{ data: invoices }, { data: ddts }, editor] = await Promise.all([
		supabase.from('invoices').select('id, number, issued_at, amount_gross').eq('checkout_group', group.key),
		supabase.from('ddts').select('id, number, issued_at').eq('checkout_group', group.key),
		loadEditorData(supabase)
	]);
	// conferma d'ordine come pagina del cliente: scadenze, invio, domande
	await markConfirmationRead(supabase, group.key);
	const [conf, payments, messages, sender] = await Promise.all([getConfirmation(supabase, group.key), syncPayments(supabase, group.key), loadMessages(supabase, group.key), operatorName(supabase, user)]);
	return { group, files, fileLists, invoices: invoices ?? [], ddts: ddts ?? [], created: url.searchParams.get('creato'), mail: url.searchParams.get('mail'), openSend: url.searchParams.get('invia') === '1', conf, payments, messages, sender, ...editor };
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
		// dall'editor: si salva e si apre il popup dell'email (niente invio a freddo)
		redirect(303, `/dashboard/fatturazione/ordini/${params.group}?invia=1`);
	},
	/** Dal popup: email scritta dallo staff con il bottone "Apri la conferma d'ordine" */
	invia: async ({ request, params, url, locals }) => {
		const f = await request.formData();
		const sender = String(f.get('sender') ?? '').trim() || (await operatorName(locals.supabase, locals.user));
		const m = await sendConfirmation(locals.supabase, params.group, url.origin, { to: String(f.get('to') ?? ''), cc: String(f.get('cc') ?? ''), subject: String(f.get('subject') ?? ''), message: String(f.get('message') ?? ''), sender });
		return m.ok ? { ok: true, sent: true, message: m.message } : fail(400, { error: m.message, sendError: true });
	},
	pagamento: async ({ request, params, locals }) => {
		const f = await request.formData();
		const op = await operatorName(locals.supabase, locals.user);
		const e = await setPaymentStatus(locals.supabase, params.group, Number(f.get('seq')), f.get('stato') === 'pagato' ? 'pagato' : 'da_pagare', op, String(f.get('rif') ?? ''));
		return e ? fail(400, { error: e }) : { ok: true, message: 'Scadenza aggiornata.' };
	},
	rispondi: async ({ request, params, url, locals }) => {
		const op = await operatorName(locals.supabase, locals.user);
		const e = await replyCustomer(locals.supabase, params.group, String((await request.formData()).get('body') ?? ''), op, url.origin);
		return e ? fail(400, { error: e }) : { ok: true, message: 'Risposta inviata.' };
	},
	promemoria: async ({ params, url, locals: { supabase } }) => {
		const r = await remindPayment(supabase, params.group, url.origin);
		return r.ok ? { ok: true, message: r.message } : fail(400, { error: r.message });
	},
	contact: async ({ request, locals: { supabase } }) => {
		const f = await request.formData();
		const d = parseDraft(f.get('payload'));
		if (!d) return fail(400, { error: 'Dati non leggibili.' });
		const r = await upsertContact(supabase, d.customer, d.contact_id);
		if (r.error) return fail(400, { error: r.error });
		return { ok: true, contactId: r.id, contactMsg: 'Cliente salvato in anagrafica.' };
	},
	status: async ({ request, params, locals }) => {
		const { supabase } = locals;
		const f = await request.formData();
		const status = String(f.get('status'));
		if (!ORDER_STATUS[status]) return fail(400, { error: 'Stato non valido.' });
		const stage = String(f.get('prod_stage') ?? '') || null;
		const patch: Record<string, unknown> = { status, prod_stage: stage };
		if (status === 'approvazione') patch.proof_sent_at = new Date().toISOString(); // da qui partono i tempi di attesa del cliente
		const q = f.get('item') ? supabase.from('orders').update(patch).eq('id', String(f.get('item'))) : supabase.from('orders').update(patch).eq('checkout_group', params.group);
		const { error: e } = await q;
		if (e) return fail(400, { error: e.message });
		// la produzione a lavorazioni si allinea al nuovo stato (commessa pianificata o attivata)
		const { data: rows } = await supabase.from('orders').select('*').eq('checkout_group', params.group);
		await ensurePlan(supabase, (rows ?? []) as OrderRow[], await operatorName(supabase, locals.user));
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
