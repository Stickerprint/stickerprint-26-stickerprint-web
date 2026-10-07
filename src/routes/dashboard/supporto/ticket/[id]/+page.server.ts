import { error, fail } from '@sveltejs/kit';
import { getTicket, markTicketRead, noteTicket, replyTicket, signedFiles, ticketContext, updateTicket, uploadStaffFiles, type TicketStatus } from '$lib/server/helpdesk';
import { operatorName } from '$lib/server/produzione';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals: { supabase } }) => {
	const c = await getTicket(supabase, params.id);
	if (!c) error(404, 'Richiesta non trovata');
	await markTicketRead(supabase, c.ticket.id);
	const ctx = await ticketContext(supabase, c.ticket);
	// allegati: link firmati per un'ora
	const files = await signedFiles(supabase, c.messages, 3600, true);
	return { ...c, ...ctx, files };
};

export const actions: Actions = {
	rispondi: async ({ request, params, url, locals }) => {
		const f = await request.formData();
		const op = await operatorName(locals.supabase, locals.user);
		const up = await uploadStaffFiles(locals.supabase, params.id, f.getAll('files').filter((x): x is File => x instanceof File));
		if (!up.ok) return fail(400, { error: up.error });
		const e = await replyTicket(locals.supabase, params.id, String(f.get('body') ?? ''), op, url.origin, (String(f.get('next') ?? '') || 'attesa_cliente') as TicketStatus, up.files);
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
