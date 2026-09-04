import { fail } from '@sveltejs/kit';
import { periz, perizConfigurato, agisci } from '$lib/server/periz';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	if (!perizConfigurato()) return { configurato: false as const };
	const appuntamenti = await periz.appuntamenti();
	return { configurato: true as const, appuntamenti };
};

export const actions: Actions = {
	/** La richiesta arriva a PERIZ (riga in dashboard + WhatsApp), che la conferma dal suo calendario. */
	richiedi: async ({ request }) => {
		const f = await request.formData();
		const r = await agisci('appuntamenti', 'richiedi', {
			tipo: String(f.get('tipo') ?? 'riprese'),
			data: String(f.get('data') ?? ''),
			fascia: String(f.get('fascia') ?? 'indifferente'),
			note: String(f.get('note') ?? '')
		});
		if (!r.ok) return fail(400, { errore: r.errore });
		return { ok: true, messaggio: 'Richiesta inviata: PERIZ la conferma e ricevi una notifica.' };
	}
};
