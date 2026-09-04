import { fail } from '@sveltejs/kit';
import { getTiktok, setCampaignBudget, setCampaignStatus, tiktokConfigured, tiktokMissing } from '$lib/server/tiktok';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	if (!tiktokConfigured()) return { configurato: false as const, mancanti: tiktokMissing() };
	try { return { configurato: true as const, mancanti: [], tt: await getTiktok(30), errore: null }; }
	catch (e) { return { configurato: true as const, mancanti: [], tt: null, errore: e instanceof Error ? e.message : 'Errore' }; }
};
export const actions: Actions = {
	/** Aumenta, diminuisce o imposta il budget di una campagna */
	budget: async ({ request }) => {
		const f = await request.formData();
		const budget = Number(f.get('budget'));
		if (!(budget >= 0)) return fail(400, { errore: 'Importo non valido.' });
		try { await setCampaignBudget(String(f.get('id')), Math.round(budget * 100) / 100, f.get('mode') === 'totale' ? 'totale' : 'giornaliero'); }
		catch (e) { return fail(400, { errore: e instanceof Error ? e.message : 'Errore' }); }
		return { ok: true, messaggio: 'Budget aggiornato su TikTok Ads.' };
	},
	stato: async ({ request }) => {
		const f = await request.formData();
		try { await setCampaignStatus(String(f.get('id')), f.get('on') === '1'); }
		catch (e) { return fail(400, { errore: e instanceof Error ? e.message : 'Errore' }); }
		return { ok: true, messaggio: f.get('on') === '1' ? 'Campagna riattivata.' : 'Campagna messa in pausa: non spende più.' };
	}
};
