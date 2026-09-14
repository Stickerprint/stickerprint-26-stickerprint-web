import { listTickets } from '$lib/server/helpdesk';
import type { PageServerLoad } from './$types';

/** Casella dell'helpdesk: prima chi aspetta noi (nuovi e risposte del cliente), poi il resto */
export const load: PageServerLoad = async ({ locals: { supabase } }) => ({ tickets: await listTickets(supabase) });
