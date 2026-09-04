import { error } from '@sveltejs/kit';
import { buildFatturaPaXml } from '$lib/server/fatturapa';
import { buildZip } from '$lib/server/zip';
import type { RequestHandler } from './$types';

/** XML FatturaPA delle fatture selezionate (?ids=a,b): uno zip con un XML per fattura; segna la data di generazione (da lì la fattura non si modifica più) */
export const GET: RequestHandler = async ({ url, locals: { supabase } }) => {
	const ids = (url.searchParams.get('ids') ?? '').split(',').filter(Boolean);
	if (!ids.length) error(400, 'Nessuna fattura selezionata');
	const { data } = await supabase.from('invoices').select('*').in('id', ids);
	if (!data?.length) error(404, 'Fatture non trovate');
	const files: [string, string][] = [];
	for (const inv of data) {
		const ddtIds: string[] = inv.ddt_ids?.length ? inv.ddt_ids : inv.ddt_id ? [inv.ddt_id] : [];
		const ddtDates: Record<string, string> = {};
		if (ddtIds.length) { const { data: ds } = await supabase.from('ddts').select('number, issued_at').in('id', ddtIds); for (const d of ds ?? []) ddtDates[d.number] = d.issued_at; }
		const ddtNumbers: string[] = inv.ddt_numbers?.length ? inv.ddt_numbers : inv.ddt_number ? [inv.ddt_number] : [];
		const prog = String(inv.number).replace(/\D/g, '').slice(-5) || String(files.length + 1);
		const { xml, filename } = buildFatturaPaXml({ number: inv.number, issued_at: inv.issued_at, email: inv.email, billing: inv.billing ?? {}, lines: inv.lines ?? [], discount_net: Number(inv.discount_net ?? 0), express_net: Number(inv.express_net ?? 0), credit_used: Number(inv.credit_used ?? 0), vat_amount: Number(inv.vat_amount ?? 0), amount_gross: Number(inv.amount_gross), payment_method: inv.payment_method, ddt_number: inv.ddt_number, ddt_numbers: ddtNumbers, ddt_dates: ddtDates, order_numbers: inv.order_numbers, payment_terms: inv.payment_terms }, prog);
		files.push([filename, xml]);
	}
	await supabase.from('invoices').update({ xml_generated_at: new Date().toISOString() }).in('id', ids);
	if (files.length === 1) return new Response(files[0][1], { headers: { 'Content-Type': 'application/xml', 'Content-Disposition': `attachment; filename="${files[0][0]}"` } });
	return new Response(new Blob([buildZip(files) as BlobPart]), { headers: { 'Content-Type': 'application/zip', 'Content-Disposition': `attachment; filename="fatture-xml-${new Date().toISOString().slice(0, 10)}.zip"` } });
};
