import { fail } from '@sveltejs/kit';
import { periz, perizConfigurato, agisci } from '$lib/server/periz';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	if (!perizConfigurato()) return { configurato: false as const };
	const [social, campagne, contenuti, report] = await Promise.all([periz.social(), periz.campagne(), periz.contenuti(), periz.report()]);
	return { configurato: true as const, social, campagne, contenuti, report };
};

export const actions: Actions = {
	/** Un report nell'archivio della dashboard: quello che dichiara di contenere, sul periodo scelto. */
	report: async ({ request }) => {
		const f = await request.formData();
		const r = await agisci('report', 'crea', {
			tipo: String(f.get('tipo') ?? 'completa'),
			piattaforme: f.getAll('piattaforme').map(String),
			sezioni: f.getAll('sezioni').map(String),
			da: String(f.get('da') ?? ''),
			a: String(f.get('a') ?? '')
		});
		if (!r.ok) return fail(400, { errore: r.errore });
		return { ok: true, messaggio: 'Report salvato nell\'archivio.' };
	}
};
