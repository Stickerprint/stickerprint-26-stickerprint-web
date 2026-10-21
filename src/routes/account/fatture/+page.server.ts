import { redirect } from '@sveltejs/kit';
import { localizePath } from '$lib/i18n';
import type { PageServerLoad } from './$types';

/** Le fatture si scaricano da "I miei ordini" (bottone sotto Riordina) */
export const load: PageServerLoad = async ({ locals }) => { redirect(301, localizePath('/account/ordini', locals.locale)); };
