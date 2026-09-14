import { listRequests } from '$lib/server/richieste';
import type { PageServerLoad } from './$types';

/** Coda delle richieste aziendali: nuove in cima, con l'attesa e lo stato del percorso */
export const load: PageServerLoad = async ({ locals: { supabase } }) => {
	const requests = await listRequests(supabase);
	const { data: quotes } = await supabase.from('quotes').select('id, number, status, request_id').not('request_id', 'is', null);
	const quoteByRequest: Record<string, { id: string; number: string; status: string }> = {};
	for (const q of quotes ?? []) if (q.request_id) quoteByRequest[q.request_id] = { id: q.id, number: q.number, status: q.status };
	return { requests, quoteByRequest };
};
