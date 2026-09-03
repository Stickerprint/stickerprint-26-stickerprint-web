import { redirect } from '@sveltejs/kit';
import { LOCALE_COOKIE } from '$lib/i18n';
import type { PageServerLoad } from './$types';

/** Percorso /en: imposta lingua e valuta e mostra il sito (traduzioni in arrivo) */
export const load: PageServerLoad = ({ cookies }) => {
	cookies.set(LOCALE_COOKIE, 'en', { path: '/', maxAge: 60 * 60 * 24 * 365, sameSite: 'lax' });
	redirect(303, '/');
};
