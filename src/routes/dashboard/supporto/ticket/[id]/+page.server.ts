import { error, fail } from '@sveltejs/kit';
import { getTicket, listTemplates, markTicketRead, noteTicket, replyTicket, ticketContext, updateTicket, type TicketStatus } from '$lib/server/helpdesk';
import { operatorName } from '$lib/server/produzione';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals: { supabase } }) => {
	const c = await getTicket(supabase, params.id);
	if (!c) error(404, 'Richiesta non trovata');
	await markTicketRead(supabase, c.ticket.id);
	const [ctx, templates] = await Promise.all([ticketContext(supabase, c.ticket), listTemplates(supabase)]);
	// allegati: link firmati per un'ora
	const files: Record<number, string> = {};
	for (const m of c.messages) if (m.file_path) { const { data } = await supabase.storage.from('requests').createSignedUrl(m.file_path, 3600, { download: m.file_path.split('/').pop() }); if (data) files[m.id] = data.signedUrl; }
	return { ...c, ...ctx, templates, files };
};

export const actions: Actions = {
	rispondi: async ({ request, params, url, locals }) => {
		const f = await request.formData();
		const op = await operatorName(locals.supabase, locals.user);
		const e = await replyTicket(locals.supabase, params.id, String(f.get('body') ?? ''), op, url.origin, (String(f.get('next') ?? '') || 'attesa_cliente') as TicketStatus);
		return e ? fail(400, { error: e }) : { ok: true, message: 'Risposta inviata.' };
	},
	nota: async ({ request, params, locals }) => {
		const op = await operatorName(locals.supabase, locals.user);
		const e = await noteTicket(locals.supabase, params.id, String((await request.formData()).get('body') ?? ''), op);
		return e ? fail(400, { error: e }) : { ok: true, message: 'Nota salvata.' };
	},
	aggiorna: async ({ request, params, locals: { supabase } }) => {
		const f = await request.formData();
		const patch: Record<string, string | null> = {};
		for (const k of ['status', 'kind', 'complaint_reason', 'order_number', 'assigned']) if (f.has(k)) patch[k] = String(f.get(k) ?? '').trim() || null;
		const e = await updateTicket(supabase, params.id, patch as never);
		return e ? fail(400, { error: e }) : { ok: true, message: 'Aggiornato.' };
	}
};
