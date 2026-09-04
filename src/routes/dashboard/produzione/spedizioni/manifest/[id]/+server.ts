import { error } from '@sveltejs/kit';
import { manifestPdf } from '$lib/server/shipping';
import type { RequestHandler } from './$types';

/** Manifest (borderò) da consegnare al corriere al ritiro */
export const GET: RequestHandler = async ({ params, locals: { supabase } }) => {
	const m = await manifestPdf(supabase, params.id);
	if (!m) error(404, 'Manifest non trovato');
	return new Response(new Blob([m.pdf as BlobPart]), { headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="MANIFEST-${m.number}.pdf"` } });
};
