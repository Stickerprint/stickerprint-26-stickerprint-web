import { fail } from '@sveltejs/kit';
import { periz, perizConfigurato, caricamento } from '$lib/server/periz';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	if (!perizConfigurato()) return { configurato: false as const };
	const contenuti = await periz.contenuti();
	return { configurato: true as const, contenuti };
};

/**
 * Caricamento di un contenuto nostro nella coda di PERIZ, in due fasi come
 * vuole la dashboard: il file non passa da questo server (un video non entra
 * nel corpo di una richiesta), va dritto allo storage della dashboard con un
 * permesso a tempo che vale per quel solo percorso.
 */
export const actions: Actions = {
	inizio: async ({ request }) => {
		const f = await request.formData();
		const r = await caricamento<{ path: string; token: string; url: string }>({ fase: 'inizio', nome_file: String(f.get('nome_file') ?? 'file') });
		if (!r.ok) return fail(400, { errore: r.errore });
		return { fase: 'inizio' as const, path: r.path, url: r.url };
	},
	fine: async ({ request }) => {
		const f = await request.formData();
		const r = await caricamento({
			fase: 'fine',
			path: String(f.get('path') ?? ''),
			titolo: String(f.get('titolo') ?? ''),
			tipo: String(f.get('tipo') ?? 'Altro'),
			piattaforme: f.getAll('piattaforme').map(String)
		});
		if (!r.ok) return fail(400, { errore: r.errore });
		return { ok: true, messaggio: 'Contenuto caricato: è nella coda, pronto da programmare. PERIZ ha ricevuto una notifica.' };
	}
};
