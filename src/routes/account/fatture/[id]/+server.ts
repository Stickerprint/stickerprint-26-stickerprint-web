import { error, redirect } from '@sveltejs/kit';
import { adminClient } from '$lib/server/admin';
import { pdfFattura, type InvoiceRow } from '$lib/server/fatture';
import { t } from '$lib/traduzioni';
import type { RequestHandler } from './$types';

/**
 * PDF della fattura dall'area personale, solo per il suo intestatario. E' la copia DEL CLIENTE, rigenerata dai dati
 * registrati: nella sua lingua e, se ha pagato in dollari, in dollari (regola di Mattia, 26/11/2026). Prima si scaricava
 * il file salvato, che per chi ha ordinato dal sito USA era in euro. Se la rigenerazione non riesce resta il file salvato.
 */
export const GET: RequestHandler = async ({ params, locals: { supabase, user, locale } }) => {
	/* la riga si legge con i permessi del cliente: se non e' sua non esce */
	const { data } = await supabase.from('invoices').select('*').eq('id', params.id).eq('user_id', user!.id).maybeSingle();
	if (!data) error(404, t(locale, 'account.errori.fatturaNonDisponibile'));
	const inv = data as InvoiceRow;
	try {
		const { bytes, nome } = await pdfFattura(adminClient() ?? supabase, inv);
		return new Response(bytes as unknown as BodyInit, { headers: { 'content-type': 'application/pdf', 'content-disposition': `attachment; filename="${nome}"`, 'cache-control': 'no-store' } });
	} catch (e) {
		console.error('[account] pdf fattura', inv.number, e);
	}
	if (!inv.pdf_path) error(404, t(locale, 'account.errori.fatturaNonDisponibile'));
	const { data: signed, error: e } = await supabase.storage.from('invoices').createSignedUrl(inv.pdf_path, 300, { download: true });
	if (e || !signed) error(500, t(locale, 'account.errori.pdfNonDisponibile'));
	redirect(302, signed.signedUrl);
};
