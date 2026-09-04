import { fail } from '@sveltejs/kit';
import { periz, perizConfigurato, agisci } from '$lib/server/periz';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	if (!perizConfigurato()) return { configurato: false as const };
	const notifiche = await periz.notifiche(100);
	return { configurato: true as const, notifiche };
};

export const actions: Actions = {
	letta: async ({ request }) => {
		const f = await request.formData();
		const r = await agisci('notifiche', 'letta', { id: String(f.get('id') ?? '') });
		if (!r.ok) return fail(400, { errore: r.errore });
		return { ok: true };
	},
	tutte: async () => {
		const r = await agisci('notifiche', 'tutte_lette');
		if (!r.ok) return fail(400, { errore: r.errore });
		return { ok: true, messaggio: 'Tutte le notifiche sono segnate come lette.' };
	},
	/** Il numero su cui PERIZ manda le notifiche WhatsApp. Il prefisso internazionale lo aggiunge la dashboard. */
	whatsapp: async ({ request }) => {
		const f = await request.formData();
		const r = await agisci('notifiche', 'whatsapp', { numero: String(f.get('numero') ?? ''), attivo: f.get('attivo') === 'on' });
		if (!r.ok) return fail(400, { errore: r.errore });
		return { ok: true, messaggio: 'Numero WhatsApp salvato.' };
	}
};
