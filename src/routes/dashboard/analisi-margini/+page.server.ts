import { groupOrders, type OrderRow } from '$lib/dashboard/orders';
import { contestoMargini, indiceFatture, margineOrdine, COLONNE_FATTURA, type FatturaMargine } from '$lib/server/margini';
import { PARAMETRI, COSTO_SPEDIZIONE_NETTO } from '$lib/margini/costi';
import { spesaAnno } from '$lib/server/ads/spesa';
import { assistenteRating, generaRating, oggiItalia, ratingAnno } from '$lib/server/margini-rating';
import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import type { Config } from '@sveltejs/adapter-vercel';

/* il report del rating lo scrive l'assistente: puo' servire fino a un minuto (60 s e' il massimo anche del piano Vercel piu' piccolo) */
export const config: Config = { maxDuration: 60 };

export const load: PageServerLoad = async ({ url, locals: { supabase } }) => {
	const year = Number(url.searchParams.get('anno')) || new Date().getFullYear();
	/* stessi ordini della lista Ordini (e-commerce solo se pagati), senza gli annullati: non si produce niente */
	const [{ data }, { data: first }, { data: fatture }, ctx, rating] = await Promise.all([
		supabase.from('orders').select('*').gte('created_at', `${year}-01-01`).lt('created_at', `${year + 1}-01-01`).or('channel.neq.ecommerce,status.neq.attesa_pagamento').neq('status', 'annullato').order('created_at', { ascending: false }).limit(3000),
		supabase.from('orders').select('created_at').order('created_at', { ascending: true }).limit(1).maybeSingle(),
		/* spedizione addebitata ed express stanno solo in fattura */
		supabase.from('invoices').select(COLONNE_FATTURA).gte('issued_at', `${year - 1}-12-01`).lt('issued_at', `${year + 1}-02-01`).limit(5000),
		contestoMargini(supabase),
		ratingAnno(supabase, year).catch((): Awaited<ReturnType<typeof ratingAnno>> => ({ perMese: {}, storico: {} }))
	]);
	const fatturaDi = indiceFatture((fatture ?? []) as FatturaMargine[]);
	const ordini = groupOrders((data ?? []) as OrderRow[]).map((g) => margineOrdine(g, ctx, fatturaDi(g)));
	const firstYear = first ? new Date(first.created_at).getFullYear() : year;
	const now = new Date().getFullYear();
	const years = Array.from({ length: Math.max(1, now - Math.min(firstYear, now - 2) + 1) }, (_, i) => now - i);
	/* la spesa pubblicitaria arriva dopo (le piattaforme sono lente): la pagina si apre subito con gli ordini */
	const ads = spesaAnno(supabase, year).catch(() => null);
	return { year, years, ordini, ads, rating, oggi: oggiItalia(), assistente: assistenteRating(), parametri: { bobina: PARAMETRI.bobina.width, scarto: PARAMETRI.scarto, spedizione: COSTO_SPEDIZIONE_NETTO } };
};

export const actions: Actions = {
	/** "Aggiorna adesso": rating provvisorio del mese in corso, oppure il definitivo di un mese chiuso che non ce l'ha */
	rating: async ({ request, locals: { supabase } }) => {
		const f = await request.formData();
		const mese = String(f.get('mese') ?? '');
		if (!/^\d{4}-\d{2}$/.test(mese)) return fail(400, { ratingErrore: 'Mese non valido.' });
		const oggi = oggiItalia();
		if (mese > oggi.mese) return fail(400, { ratingErrore: 'Il mese non è ancora iniziato.' });
		const r = await generaRating(supabase, mese, mese < oggi.mese);
		if (!r.ok) return fail(400, { ratingErrore: r.errore });
		return { ratingOk: `Rating di ${mese}: ${r.riga.lettera}${r.riga.definitivo ? ' (definitivo)' : ' (provvisorio)'}.` };
	}
};
