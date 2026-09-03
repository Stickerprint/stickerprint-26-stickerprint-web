import { loadOrders } from '$lib/server/account';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals: { supabase, user } }) => loadOrders(supabase, user!.id);
