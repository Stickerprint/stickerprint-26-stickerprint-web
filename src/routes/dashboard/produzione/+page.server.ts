import { loadOverview } from '$lib/server/produzione-viste';
import { taskActions } from '$lib/server/produzione';
import type { Actions, PageServerLoad } from './$types';
export const load: PageServerLoad = async ({ locals: { supabase } }) => loadOverview(supabase);
export const actions: Actions = { ...taskActions };
