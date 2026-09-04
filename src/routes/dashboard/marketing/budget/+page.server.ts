import { fail } from '@sveltejs/kit';
import { periz, perizConfigurato, agisci } from '$lib/server/periz';
import { getTiktok, tiktokConfigured } from '$lib/server/tiktok';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	if (!perizConfigurato()) return { configurato: false as const };
	const [budget, contenuti, campagne, tiktok] = await Promise.all([periz.budget(), periz.contenuti(), periz.campagne(), tiktokConfigured() ? getTiktok(30).then((t) => ({ ok: true as const, spesaMese: t.spesaMese, spesa30: t.kpi.spesa })).catch((e: unknown) => ({ ok: false as const, errore: e instanceof Error ? e.message : 'Errore' })) : Promise.resolve({ ok: false as const, errore: 'TikTok Ads non collegato (Marketing → TikTok Ads).' })]);
	return { configurato: true as const, budget, contenuti, campagne, tiktok };
};

export const actions: Actions = {
	/** Le quote mensili per piattaforma. Il tetto del brand, se c'è, lo fa rispettare il database della dashboard. */
	mensile: async ({ request }) => {
		const f = await request.formData();
		const google = f.get('google');
		const r = await agisci('budget', 'mensile', { meta: Number(f.get('meta') ?? 0), tiktok: Number(f.get('tiktok') ?? 0), ...(google !== null && google !== '' ? { google: Number(google) } : {}) });
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
	/** Più o meno budget su un post con un clic: importo ± passo, stessa divisione e obiettivo */
	passo: async ({ request }) => {
		const f = await request.formData();
		const attuale = Number(f.get('attuale') ?? 0);
		const nuovo = Math.max(0, Math.round((attuale + Number(f.get('delta') ?? 0)) * 100) / 100);
		let split: Record<string, number> | null = null;
		try { split = JSON.parse(String(f.get('split') ?? 'null')); } catch { split = null; }
		const r = nuovo === 0
			? await agisci('contenuti', 'rimuovi_budget', { id: String(f.get('id') ?? '') })
			: await agisci('contenuti', 'budget', { id: String(f.get('id') ?? ''), budget: nuovo, split: split && Object.keys(split).length ? split : null, obiettivo: String(f.get('obiettivo') ?? 'traffico') });
		if (!r.ok) return fail(400, { errore: r.errore });
		return { ok: true, messaggio: nuovo === 0 ? 'Budget azzerato e tolto dal contenuto.' : `Budget portato a ${nuovo.toFixed(0)} €.` };
	},
	rimuovi: async ({ request }) => {
		const f = await request.formData();
		const r = await agisci('contenuti', 'rimuovi_budget', { id: String(f.get('id') ?? '') });
		if (!r.ok) return fail(400, { errore: r.errore });
		return { ok: true, messaggio: 'Budget rimosso dal contenuto.' };
	}
};
