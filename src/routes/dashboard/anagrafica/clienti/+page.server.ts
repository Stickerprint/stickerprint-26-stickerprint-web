import { loadCustomers } from '$lib/server/customers';
import type { PageServerLoad } from './$types';
export const load: PageServerLoad = async ({ locals: { supabase } }) => ({ customers: await loadCustomers(supabase) });
