import type { PageServerLoad } from './$types';

/**
 * Bozza dashboard cliente: per ora mostra i dati base dell'utente
 * e conta gli ordini esistenti nel database attuale (tabella `orders`).
 * Le sezioni complete (ordini, prove, fatture, credito) arrivano nello step successivo.
 */
export const load: PageServerLoad = async ({ locals: { supabase, user } }) => {
	let ordersCount = 0;
	try {
		const { count } = await supabase
			.from('orders')
			.select('id', { count: 'exact', head: true })
			.eq('user_id', user!.id);
		ordersCount = count ?? 0;
	} catch {
		/* la tabella potrebbe non essere accessibile dal nuovo progetto: non è un errore bloccante */
	}
	return { ordersCount };
};
