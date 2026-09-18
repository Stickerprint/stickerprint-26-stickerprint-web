import { fail } from '@sveltejs/kit';
import { removeCard, savedCardsFor, savedCardsOn } from '$lib/server/saved-cards';
import type { Actions, PageServerLoad } from './$types';

/** Carte salvate dell'account: marca, ultime 4 cifre e scadenza lette da Stripe (il numero intero non esiste sul sito) */
export const load: PageServerLoad = async ({ locals: { user } }) => {
	const on = savedCardsOn();
	return { on, cards: on && user ? await savedCardsFor(user.id) : [] };
};

export const actions: Actions = {
	remove: async ({ request, locals: { user } }) => {
		if (!user) return fail(401, { error: 'Accedi per gestire le carte.' });
		const id = String((await request.formData()).get('id') ?? '');
		if (!/^pm_[A-Za-z0-9]+$/.test(id)) return fail(400, { error: 'Carta non valida.' });
		try {
			const ok = await removeCard(user.id, id);
			return ok ? { ok: true } : fail(404, { error: 'Carta non trovata.' });
		} catch (e) { return fail(400, { error: `Carta non rimossa: ${e instanceof Error ? e.message : 'errore'}` }); }
	}
};
