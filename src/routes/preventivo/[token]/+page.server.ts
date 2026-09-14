import { error, fail } from '@sveltejs/kit';
import { adminClient } from '$lib/server/admin';
import { acceptQuoteByToken, getQuoteByToken, quotePdf, rejectQuoteByToken } from '$lib/server/richieste';
import { toB64 } from '$lib/server/richieste';
import type { Actions, PageServerLoad } from './$types';

/** Pagina pubblica del preventivo: il cliente lo vede, scarica il PDF e lo accetta con un clic */
export const load: PageServerLoad = async ({ params }) => {
	const db = adminClient();
	if (!db) error(503, 'Servizio non disponibile');
	const q = await getQuoteByToken(db, params.token);
	if (!q) error(404, 'Preventivo non trovato');
	const pdf = await quotePdf(q);
	return { q: { number: q.number, version: q.version, status: q.status, draft: q.draft, total_net: q.total_net, total_gross: q.total_gross, valid_until: q.valid_until, sent_at: q.sent_at, accepted_at: q.accepted_at }, pdf: toB64(pdf) };
};

export const actions: Actions = {
	accetta: async ({ params, request, url }) => {
		const db = adminClient();
		if (!db) return fail(503, { error: 'Servizio non disponibile.' });
		const f = await request.formData();
		const r = await acceptQuoteByToken(db, params.token, String(f.get('nome') ?? '').trim(), url.origin);
		return r.ok ? { ok: true, message: r.message } : fail(400, { error: r.message });
	},
	rifiuta: async ({ params, request }) => {
		const db = adminClient();
		if (!db) return fail(503, { error: 'Servizio non disponibile.' });
		const f = await request.formData();
		const r = await rejectQuoteByToken(db, params.token, String(f.get('motivo') ?? ''));
		return r.ok ? { ok: true, message: r.message } : fail(400, { error: r.message });
	}
};
