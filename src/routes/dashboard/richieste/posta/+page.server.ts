import { fail } from '@sveltejs/kit';
import { adminClient } from '$lib/server/admin';
import { elaboraPosta } from '$lib/server/posta/elabora';
import { assistentePosta } from '$lib/server/posta/estrai';
import type { PostaRiga } from '$lib/server/posta/tipi';
import type { Actions, PageServerLoad } from './$types';

/** Posta in arrivo: cosa e' arrivato, cosa ne ha fatto l'assistente (ordine, richiesta, niente) e i punti da controllare. */
export const load: PageServerLoad = async ({ url, locals: { supabase } }) => {
	const stato = url.searchParams.get('stato') ?? 'tutte';
	let q = supabase.from('posta_in').select('*').order('data_mail', { ascending: false, nullsFirst: false }).limit(150);
	if (stato !== 'tutte') q = q.eq('stato', stato);
	const [{ data }, { data: tutte }, { data: conferme }] = await Promise.all([
		q,
		supabase.from('posta_in').select('stato'),
		supabase.from('posta_in').select('id, data_mail, esito').eq('note', 'Conferma dell’inoltro Gmail').order('ricevuta_il', { ascending: false }).limit(1)
	]);
	const conteggi: Record<string, number> = {};
	for (const r of tutte ?? []) conteggi[r.stato] = (conteggi[r.stato] ?? 0) + 1;
	const c = conferme?.[0] as { id: string; data_mail: string | null; esito: { conferma?: { codice: string | null; link: string | null } } } | undefined;
	return { mail: (data ?? []) as PostaRiga[], stato, conteggi, totale: tutte?.length ?? 0, assistente: assistentePosta(), conferma: c?.esito?.conferma ? { ...c.esito.conferma, quando: c.data_mail } : null };
};

export const actions: Actions = {
	/** rielabora una mail (anche gia' fatta: l'ordine precedente resta, va cancellato a mano se doppio) */
	rielabora: async ({ request, locals: { supabase } }) => {
		const id = String((await request.formData()).get('id') ?? '');
		if (!id) return fail(400, { errore: 'Mail non indicata.' });
		const db = adminClient() ?? supabase;
		const { data: m } = await supabase.from('posta_in').select('stato, esito').eq('id', id).maybeSingle();
		if (!m) return fail(404, { errore: 'Mail non trovata.' });
		await supabase.from('posta_in').update({ stato: 'nuova', errore: null }).eq('id', id);
		const r = await elaboraPosta(db, { id });
		return { ok: true, messaggio: r.ordini ? 'Ordine inserito.' : r.preventivi ? 'Richiesta inserita.' : r.errori ? 'Non elaborata: vedi il motivo nella riga.' : 'Letta: nessun ordine dentro.', avviso: m.esito && 'ordine' in (m.esito as object) ? 'Attenzione: la mail aveva già un ordine, controlla i doppioni.' : null };
	},
	ignora: async ({ request, locals: { supabase } }) => {
		const id = String((await request.formData()).get('id') ?? '');
		await supabase.from('posta_in').update({ stato: 'ignorata', note: 'Ignorata a mano' }).eq('id', id);
		return { ok: true, messaggio: 'Mail ignorata.' };
	},
	/** elabora adesso tutte le nuove, senza aspettare le 9 o le 15 */
	tutte: async ({ locals: { supabase } }) => {
		const db = adminClient() ?? supabase;
		const r = await elaboraPosta(db, { max: 25 });
		return { ok: true, messaggio: `Elaborate ${r.fatte} mail: ${r.ordini} ordini, ${r.preventivi} richieste, ${r.errori} con problemi.` };
	}
};
