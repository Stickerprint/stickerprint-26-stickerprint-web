import { fail } from '@sveltejs/kit';
import { periz, perizConfigurato, agisci } from '$lib/server/periz';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	if (!perizConfigurato()) return { configurato: false as const };
	const contenuti = await periz.contenuti();
	return { configurato: true as const, contenuti };
};

export const actions: Actions = {
	/** "Salva come bozza" tiene il contenuto in coda con tutto pronto; "Conferma" lo programma e fa partire la pubblicazione automatica. */
	programma: async ({ request }) => {
		const f = await request.formData();
		const r = await agisci('contenuti', 'programma', {
			id: String(f.get('id') ?? ''),
			data: String(f.get('data') ?? ''),
			ora: String(f.get('ora') ?? '') || null,
			didascalia: String(f.get('didascalia') ?? ''),
			piattaforme: f.getAll('piattaforme').map(String),
			conferma: f.get('conferma') === '1'
		});
		if (!r.ok) return fail(400, { errore: r.errore });
		const avviso = (r as { avviso?: string | null }).avviso;
		return { ok: true, messaggio: avviso ?? (f.get('conferma') === '1' ? 'Programmazione confermata: alla data e ora scelte la dashboard pubblica da sola.' : 'Bozza salvata in coda.') };
	},
	annulla: async ({ request }) => {
		const f = await request.formData();
		const r = await agisci('contenuti', 'annulla_programmazione', { id: String(f.get('id') ?? '') });
		if (!r.ok) return fail(400, { errore: r.errore });
		return { ok: true, messaggio: 'Programmazione annullata: il contenuto è tornato in coda.' };
	}
};
