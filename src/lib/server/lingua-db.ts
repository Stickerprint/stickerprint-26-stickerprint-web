/**
 * Lingua del cliente quando non c'e' un ordine davanti: ticket di assistenza e richieste dal sito.
 * Si usa la lingua salvata sulla riga (colonna `lang`, migrazione 0065: e' la lingua del modulo da cui ha scritto);
 * se manca (righe vecchie, colonna non ancora creata) quella del suo ultimo ordine; se non ha ordini, l'italiano.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { daLingua, isLang, linguaOrdine, type LinguaCliente } from '$lib/lingua-cliente';

export async function linguaDaEmail(db: SupabaseClient, email: string | null | undefined): Promise<LinguaCliente> {
	const e = (email ?? '').trim().toLowerCase();
	if (!e) return daLingua('it');
	const { data, error } = await db.from('orders').select('locale, channel, billing, shipping').ilike('email', e).order('created_at', { ascending: false }).limit(1);
	if (error || !data?.length) return daLingua('it');
	return linguaOrdine(data[0] as Parameters<typeof linguaOrdine>[0]);
}
/** lingua di un ticket o di una richiesta: quella salvata, altrimenti quella dell'ultimo ordine di quell'email */
export async function linguaContatto(db: SupabaseClient, r: { lang?: string | null; email?: string | null }): Promise<LinguaCliente> {
	return isLang(r.lang) ? daLingua(r.lang) : linguaDaEmail(db, r.email);
}
