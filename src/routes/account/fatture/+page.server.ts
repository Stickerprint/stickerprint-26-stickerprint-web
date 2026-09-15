import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

/** Le fatture si scaricano da "I miei ordini" (bottone sotto Riordina) */
export const load: PageServerLoad = async () => { redirect(301, '/account/ordini'); };
