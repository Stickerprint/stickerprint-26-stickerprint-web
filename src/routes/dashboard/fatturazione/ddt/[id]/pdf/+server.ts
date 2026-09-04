import { error } from '@sveltejs/kit';
import { buildDdtPdf } from '$lib/server/docs';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, locals: { supabase } }) => {
	const { data: d } = await supabase.from('ddts').select('*').eq('id', params.id).maybeSingle();
	if (!d) error(404, 'DDT non trovato');
	const dd = d.data as { customer: Record<string, string>; shipping: Record<string, string>; lines: { description: string; qty: number; unit_net: number; total_net: number }[]; subtotal_net: number; vat_amount: number; total_gross: number; notes?: string | null };
	const pdf = await buildDdtPdf({ number: d.number, issued_at: d.issued_at, order_number: d.order_number, customer: dd.customer, shipping: dd.shipping, lines: dd.lines, parcels: d.parcels, weight_kg: d.weight_kg, causale: d.causale, trasporto: d.trasporto ?? '', subtotal_net: dd.subtotal_net, vat_amount: dd.vat_amount, total_gross: dd.total_gross, notes: dd.notes });
	return new Response(new Blob([pdf as BlobPart]), { headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `inline; filename="${d.number}.pdf"` } });
};
