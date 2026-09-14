import { error, fail } from '@sveltejs/kit';
import { adminClient } from '$lib/server/admin';
import { customerReply, getTicketByToken } from '$lib/server/helpdesk';
import type { Actions, PageServerLoad } from './$types';

/** Pagina pubblica della richiesta: il cliente vede la conversazione e risponde (anche con un allegato) */
export const load: PageServerLoad = async ({ params }) => {
	const db = adminClient();
	if (!db) error(503, 'Servizio non disponibile');
	const c = await getTicketByToken(db, params.token);
	if (!c) error(404, 'Richiesta non trovata');
	const files: Record<number, string> = {};
	for (const m of c.messages) if (m.file_path) { const { data } = await db.storage.from('requests').createSignedUrl(m.file_path, 3600); if (data) files[m.id] = data.signedUrl; }
	return { ticket: { number: c.ticket.number, status: c.ticket.status, name: c.ticket.name, order_number: c.ticket.order_number, created_at: c.ticket.created_at }, messages: c.messages, files };
};

export const actions: Actions = {
	default: async ({ params, request, url }) => {
		const db = adminClient();
		if (!db) return fail(503, { error: 'Servizio non disponibile.' });
		const f = await request.formData();
		let filePath: string | null = null;
		const file = f.get('file');
		if (file instanceof File && file.size > 0) {
			if (file.size > 25 * 1024 * 1024) return fail(400, { error: 'Il file supera i 25 MB.' });
			const ext = (file.name.split('.').pop() ?? 'bin').toLowerCase().replace(/[^a-z0-9]/g, '') || 'bin';
			filePath = `support/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ext}`;
			const { error: e } = await db.storage.from('requests').upload(filePath, file, { contentType: file.type || undefined });
			if (e) return fail(400, { error: `Allegato non caricato: ${e.message}` });
		}
		const e = await customerReply(db, params.token, String(f.get('body') ?? ''), filePath, url.origin);
		return e ? fail(400, { error: e }) : { ok: true };
	}
};
