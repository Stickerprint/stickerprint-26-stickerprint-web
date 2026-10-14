import { caricaHome } from '$lib/server/home';
import type { PageServerLoad } from './$types';

/** Home: il riepilogo del giorno (fatturato, ordini da far partire, nuovi ordini, assistenza, margini) */
export const load: PageServerLoad = async ({ locals: { supabase } }) => caricaHome(supabase);
