import { error } from '@sveltejs/kit';
import { orderPdfForGroup } from '$lib/server/orders';
import type { RequestHandler } from './$types';

/** PDF di conferma d'ordine con riepilogo e scadenze */
export const GET: RequestHandler = async ({ params, locals: { supabase } }) => {
	const doc = await orderPdfForGroup(supabase, params.group);
	if (!doc) error(404, 'Ordine non trovato');
	return new Response(new Blob([doc.pdf as BlobPart]), { headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `inline; filename="Conferma-ordine-${doc.number}.pdf"` } });
};
