import { error } from '@sveltejs/kit';
import { pdfFattura, type InvoiceRow } from '$lib/server/fatture';
import type { RequestHandler } from './$types';

/**
 * PDF della fattura dalla dashboard, rigenerato dai dati registrati.
 * Senza parametri e' la NOSTRA copia: in italiano e in euro, come la fattura elettronica mandata allo SDI.
 * Con `?cliente=1` e' quella che riceve il cliente: nella sua lingua e, se ha pagato in dollari, in dollari.
 * Per i clienti italiani le due copie sono identiche. Non tocca il file salvato e non registra il download.
 */
export const GET: RequestHandler = async ({ params, url, locals: { supabase } }) => {
	const { data } = await supabase.from('invoices').select('*').eq('id', params.id).maybeSingle();
	if (!data) error(404, 'Fattura non trovata');
	const inv = data as InvoiceRow;
	const delCliente = url.searchParams.get('cliente') === '1';
	const { bytes, nome } = await pdfFattura(supabase, inv, {}, { interna: !delCliente });
	return new Response(bytes as unknown as BodyInit, { headers: { 'content-type': 'application/pdf', 'content-disposition': `inline; filename="${delCliente ? nome : `Fattura-${inv.number}.pdf`}"`, 'cache-control': 'no-store' } });
};
