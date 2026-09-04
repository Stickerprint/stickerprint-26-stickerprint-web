import { fail } from '@sveltejs/kit';
import { periz, perizConfigurato, agisci } from '$lib/server/periz';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	if (!perizConfigurato()) return { configurato: false as const };
	const contenuti = await periz.contenuti();
	return { configurato: true as const, contenuti };
};

/** Le azioni passano dal server del sito alla dashboard PERIZ, che manda il WhatsApp all'agenzia. */
export const actions: Actions = {
	approva: async ({ request }) => {
		const f = await request.formData();
		const r = await agisci('contenuti', 'approva', { id: String(f.get('id') ?? '') });
		if (!r.ok) return fail(400, { errore: r.errore });
		return { ok: true, messaggio: 'Contenuto approvato: PERIZ lo mette in coda per la programmazione.' };
	},
	modifiche: async ({ request }) => {
		const f = await request.formData();
		const r = await agisci('contenuti', 'modifiche', { id: String(f.get('id') ?? ''), messaggio: String(f.get('messaggio') ?? '') });
		if (!r.ok) return fail(400, { errore: r.errore });
		return { ok: true, messaggio: 'Richiesta di modifica inviata a PERIZ.' };
	}
};
