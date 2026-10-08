/** Le azioni comuni alle pagine marketing: cambio budget e pausa (solo admin), rigenerazione dei consigli (tutto lo staff). */
import { fail } from '@sveltejs/kit';
import type { Canale } from '$lib/marketing/ads-tipi';
import { cambiaBudget, cambiaStato } from './index';
import { generaReport } from './consigli';
import { leggiObiettivi } from './impostazioni';

type Locals = App.Locals;
async function isAdmin(locals: Locals): Promise<boolean> {
	if (!locals.user) return false;
	const { data } = await locals.supabase.from('profiles').select('role').eq('id', locals.user.id).maybeSingle();
	return data?.role === 'admin';
}
const SOLO_ADMIN = 'Solo l\'amministratore può cambiare budget e stato delle campagne.';

export const azioniCanale = (canale: Canale) => ({
	budget: async ({ request, locals }: { request: Request; locals: Locals }) => {
		if (!(await isAdmin(locals))) return fail(403, { errore: SOLO_ADMIN });
		const f = await request.formData();
		const budget = Number(f.get('budget'));
		if (!(budget >= 0)) return fail(400, { errore: 'Importo non valido.' });
		try { await cambiaBudget(canale, String(f.get('id')), Math.round(budget * 100) / 100); }
		catch (e) { return fail(400, { errore: e instanceof Error ? e.message : 'Errore' }); }
		return { ok: true, messaggio: `Budget aggiornato: ${budget.toLocaleString('it-IT')} € al giorno.` };
	},
	stato: async ({ request, locals }: { request: Request; locals: Locals }) => {
		if (!(await isAdmin(locals))) return fail(403, { errore: SOLO_ADMIN });
		const f = await request.formData();
		const on = f.get('on') === '1';
		try { await cambiaStato(canale, String(f.get('id')), on); }
		catch (e) { return fail(400, { errore: e instanceof Error ? e.message : 'Errore' }); }
		return { ok: true, messaggio: on ? 'Campagna riattivata.' : 'Campagna messa in pausa: non spende più.' };
	},
	consigli: async ({ locals, url }: { locals: Locals; url: URL }) => {
		const giorni = Math.min(90, Math.max(7, Number(url.searchParams.get('giorni')) || 30));
		const r = await generaReport(locals.supabase, canale, await leggiObiettivi(locals.supabase), giorni);
		if (!r.ok) return fail(400, { errore: r.errore });
		return { ok: true, messaggio: r.report.testo ? 'Consigli aggiornati.' : 'Verdetti aggiornati (senza testo dell\'assistente).' };
	}
});
export const azioneConsigliTutti = async ({ locals, url }: { locals: Locals; url: URL }) => {
	const giorni = Math.min(90, Math.max(7, Number(url.searchParams.get('giorni')) || 30));
	const r = await generaReport(locals.supabase, 'tutti', await leggiObiettivi(locals.supabase), giorni);
	if (!r.ok) return fail(400, { errore: r.errore });
	return { ok: true, messaggio: r.report.testo ? 'Consigli aggiornati.' : 'Verdetti aggiornati (senza testo dell\'assistente).' };
};
export const giorniDa = (url: URL) => Math.min(90, Math.max(7, Number(url.searchParams.get('giorni')) || 30));
