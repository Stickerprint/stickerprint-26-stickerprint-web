import { fail } from '@sveltejs/kit';
import { periz, perizConfigurato, agisci } from '$lib/server/periz';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	if (!perizConfigurato()) return { configurato: false as const };
	const [budget, contenuti, campagne] = await Promise.all([periz.budget(), periz.contenuti(), periz.campagne()]);
	return { configurato: true as const, budget, contenuti, campagne };
};

export const actions: Actions = {
	/** Le quote mensili per piattaforma. Il tetto del brand, se c'è, lo fa rispettare il database della dashboard. */
	mensile: async ({ request }) => {
		const f = await request.formData();
		const r = await agisci('budget', 'mensile', { meta: Number(f.get('meta') ?? 0), tiktok: Number(f.get('tiktok') ?? 0) });
		if (!r.ok) return fail(400, { errore: r.errore });
		return { ok: true, messaggio: 'Budget mensile aggiornato.' };
	},
	/** Budget ADV su un contenuto, con la divisione fra le piattaforme e l'obiettivo della campagna. */
	assegna: async ({ request }) => {
		const f = await request.formData();
		const split: Record<string, number> = {};
		for (const p of ['instagram', 'tiktok', 'facebook']) {
			const v = f.get(`split_${p}`);
			if (v !== null && v !== '') split[p] = Number(v);
		}
		const budget = String(f.get('budget') ?? '');
		const r = await agisci('contenuti', 'budget', {
			id: String(f.get('id') ?? ''),
			budget: budget === '' ? null : Number(budget),
			split: Object.keys(split).length ? split : null,
			obiettivo: String(f.get('obiettivo') ?? 'traffico')
		});
		if (!r.ok) return fail(400, { errore: r.errore });
		const avviso = (r as { avviso?: string | null }).avviso;
		return { ok: true, messaggio: avviso ?? 'Budget assegnato: PERIZ lo vede nella sua dashboard.' };
	},
	rimuovi: async ({ request }) => {
		const f = await request.formData();
		const r = await agisci('contenuti', 'rimuovi_budget', { id: String(f.get('id') ?? '') });
		if (!r.ok) return fail(400, { errore: r.errore });
		return { ok: true, messaggio: 'Budget rimosso dal contenuto.' };
	}
};
