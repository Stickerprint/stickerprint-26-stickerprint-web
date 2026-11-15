/**
 * Letture oltre le 1.000 righe.
 *
 * Supabase restituisce al massimo 1.000 righe per lettura, qualunque `limit` si scriva: oltre, le righe in
 * fondo all'ordinamento spariscono senza errore. Il 15/11/2026 la Home perdeva cosi' gli ultimi ordini del mese
 * (5.125 € invece di 5.559 €) e la pagina Ordini i primi dell'anno.
 * `leggiTutto` chiede le righe a pagine finche' non le ha tutte.
 *
 * La lettura va scritta con un ordinamento che non cambia fra una pagina e l'altra (di solito la data e poi
 * l'id) e con `{ count: 'exact' }` nella select: il totale dice quando fermarsi anche se il tetto del server cambia.
 */
export const PAGINA = 1000;

interface Risposta<T> { data: T[] | null; error: { message: string } | null; count?: number | null }

export async function leggiTutto<T>(pagina: (da: number, a: number) => PromiseLike<Risposta<T>>, massimo = 50000): Promise<{ data: T[]; error: { message: string } | null }> {
	const out: T[] = [];
	while (out.length < massimo) {
		const { data, error, count } = await pagina(out.length, out.length + PAGINA - 1);
		if (error) return { data: out, error };
		const righe = data ?? [];
		out.push(...righe);
		if (!righe.length) break;
		/* con il totale ci si ferma quando ci sono tutte; senza, quando una pagina arriva non piena */
		if (count != null ? out.length >= count : righe.length < PAGINA) break;
	}
	return { data: out, error: null };
}
