import { error } from '@sveltejs/kit';
import { buildDistintaPdf, type DistintaRow } from '$lib/server/docs';
import type { RequestHandler } from './$types';

/** Distinta per la banca: PDF con le fatture selezionate (intestatario, P.IVA, importo, scadenza), una riga per scadenza. */
export const GET: RequestHandler = async ({ url, locals: { supabase } }) => {
	const ids = (url.searchParams.get('ids') ?? '').split(',').filter((x) => /^[0-9a-f-]{36}$/i.test(x));
	if (!ids.length) error(400, 'Nessuna fattura selezionata');
	const { data } = await supabase.from('invoices').select('id, number, issued_at, amount_gross, billing, payment_method, payment_terms').in('id', ids);
	if (!data?.length) error(404, 'Fatture non trovate');
	const dmy = (s: string | null | undefined) => (s ? new Date(s).toLocaleDateString('it-IT') : '—');
	const rows: DistintaRow[] = [];
	for (const inv of data) {
		const b = (inv.billing ?? {}) as Record<string, string>;
		const cliente = b.company || [b.first_name, b.last_name].filter(Boolean).join(' ') || '—';
		const piva = b.vat ? `P.IVA ${String(b.vat).replace(/^IT/i, '')}` : b.fiscal_code ? `C.F. ${b.fiscal_code}` : '';
		const terms = (inv.payment_terms ?? []) as { due: string; amount: number; method: string }[];
		if (terms.length) for (const t of terms) rows.push({ cliente, piva, numero: inv.number, data: dmy(inv.issued_at), scadenza: dmy(t.due), importo: Number(t.amount), metodo: t.method || inv.payment_method });
		else rows.push({ cliente, piva, numero: inv.number, data: dmy(inv.issued_at), scadenza: '—', importo: Number(inv.amount_gross), metodo: inv.payment_method });
	}
	// per scadenza, poi per numero: come le vuole la banca
	const key = (s: string) => (s === '—' ? '9999' : s.split('/').reverse().join(''));
	rows.sort((a, b) => key(a.scadenza).localeCompare(key(b.scadenza)) || a.numero.localeCompare(b.numero));
	const today = new Date().toISOString().slice(0, 10);
	const pdf = await buildDistintaPdf({ date: today, rows });
	return new Response(new Blob([pdf as BlobPart]), { headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `inline; filename="distinta-banca-${today}.pdf"` } });
};
