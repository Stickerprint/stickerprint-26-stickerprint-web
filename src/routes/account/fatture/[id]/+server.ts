import { error, redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

/** Link temporaneo (5 minuti) al PDF della fattura, solo per il suo intestatario. */
export const GET: RequestHandler = async ({ params, locals: { supabase, user } }) => {
	const { data } = await supabase.from('invoices').select('pdf_path').eq('id', params.id).eq('user_id', user!.id).maybeSingle();
	if (!data?.pdf_path) error(404, 'Fattura non disponibile');
	const { data: signed, error: e } = await supabase.storage.from('invoices').createSignedUrl(data.pdf_path, 300, { download: true });
	if (e || !signed) error(500, 'PDF non disponibile in questo momento');
	redirect(302, signed.signedUrl);
};
