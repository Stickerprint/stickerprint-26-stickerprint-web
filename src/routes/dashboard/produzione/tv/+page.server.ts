import { loadOverview } from '$lib/server/produzione-viste';
import type { PageServerLoad } from './$types';
export const load: PageServerLoad = async ({ locals: { supabase } }) => loadOverview(supabase);
