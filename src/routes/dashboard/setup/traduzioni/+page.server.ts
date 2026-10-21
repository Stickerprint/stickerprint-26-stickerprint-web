import { fail } from '@sveltejs/kit';
import { adminClient } from '$lib/server/admin';
import { daTradurre, traduciContenuti, traduttoreAttivo } from '$lib/server/traduttore-contenuti';
import { invalidateFaq } from '$lib/server/faq';
import { invalidatePromos } from '$lib/server/promos';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals: { supabase } }) => {
	const db = adminClient() ?? supabase;
	const stato = await daTradurre(db);
	return { attivo: traduttoreAttivo(), restano: stato.lavori.length, totale: stato.totale, errore: stato.errore ?? null, elenco: stato.lavori.slice(0, 40).map((l) => ({ tabella: l.tabella, id: l.id, testo: String(Object.values(l.italiano)[0] ?? '').slice(0, 90) })) };
};

export const actions: Actions = {
	traduci: async ({ locals: { supabase } }) => {
		const db = adminClient() ?? supabase;
		if (!traduttoreAttivo()) return fail(400, { error: 'Manca ANTHROPIC_API_KEY su Vercel: il traduttore automatico non e’ attivo.' });
		/* lotto breve per restare dentro il tempo di una richiesta: si preme di nuovo finche' "restano" e' zero */
		const r = await traduciContenuti(db, 45_000);
		if (r.fatte) { invalidateFaq(); invalidatePromos(); }
		if (r.errore) return fail(500, { error: r.errore, fatte: r.fatte, restano: r.restano });
		return { ok: true, fatte: r.fatte, restano: r.restano };
	}
};
