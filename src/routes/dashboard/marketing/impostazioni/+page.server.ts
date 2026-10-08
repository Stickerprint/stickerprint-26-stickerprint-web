import { fail } from '@sveltejs/kit';
import { leggiObiettivi, salvaObiettivi } from '$lib/server/ads/impostazioni';
import { canaliConfigurati } from '$lib/server/ads';
import { assistenteDisponibile } from '$lib/server/ads/consigli';
import { cpaObiettivo } from '$lib/marketing/analisi';
import { CANALI, type Canale } from '$lib/marketing/ads-tipi';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals: { supabase } }) => {
	const obiettivi = await leggiObiettivi(supabase);
	return { obiettivi, cpaCalcolato: cpaObiettivo(obiettivi), collegati: canaliConfigurati(), assistente: assistenteDisponibile() };
};
const n = (v: FormDataEntryValue | null): number | null => { const s = String(v ?? '').trim().replace(',', '.'); if (!s) return null; const x = Number(s); return Number.isFinite(x) ? x : null; };
export const actions: Actions = {
	salva: async ({ request, locals: { supabase } }) => {
		const f = await request.formData();
		const valoreOrdine = n(f.get('valore_ordine')); const roasTarget = n(f.get('roas_target'));
		if (!valoreOrdine || valoreOrdine <= 0) return fail(400, { errore: 'Scrivi il valore medio di un ordine (in euro).' });
		if (!roasTarget || roasTarget <= 0) return fail(400, { errore: 'Scrivi il ritorno minimo (es. 3 = 3 € di ordini per ogni euro speso).' });
		const quote: Partial<Record<Canale, number>> = {};
		for (const c of CANALI) { const q = n(f.get(`quota_${c}`)); if (q != null && q > 0) quote[c] = q; }
		const err = await salvaObiettivi(supabase, { budgetMese: n(f.get('budget_mese')), quote, valoreOrdine, roasTarget, cpaTarget: n(f.get('cpa_target')), note: String(f.get('note') ?? '').trim() });
		if (err) return fail(400, { errore: err });
		return { ok: true, messaggio: 'Impostazioni salvate: i prossimi consigli useranno questi obiettivi.' };
	}
};
