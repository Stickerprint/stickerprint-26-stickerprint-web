import { error } from '@sveltejs/kit';
import { buildLabelsPdf } from '$lib/server/docs';
import { groupOrders, itemMeta, type OrderRow } from '$lib/dashboard/orders';
import { labelsPdf } from '$lib/server/shipping';
import type { RequestHandler } from './$types';

/** PDF 10×15 con le etichette dei colli: ?groups=a,b&courier=GLS oppure ?ddt=<id> */
export const GET: RequestHandler = async ({ url, locals: { supabase } }) => {
	let groups = url.searchParams.get('groups')?.split(',').filter(Boolean) ?? [];
	let courier = url.searchParams.get('courier') ?? 'Corriere';
	let parcelsOverride: number | null = null;
	const ddtId = url.searchParams.get('ddt');
	if (ddtId) {
		const { data: d } = await supabase.from('ddts').select('checkout_group, parcels').eq('id', ddtId).maybeSingle();
		if (!d?.checkout_group) error(404, 'DDT non trovato');
		groups = [d.checkout_group]; courier = url.searchParams.get('courier') || 'Consegna diretta'; parcelsOverride = d.parcels;
	}
	if (!groups.length) error(400, 'Nessun ordine');
	if (url.searchParams.get('day') && !ddtId) {
		const pdf = await labelsPdf(supabase, courier, groups);
		return new Response(new Blob([pdf as BlobPart]), { headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="etichette-${courier}-${new Date().toISOString().slice(0, 10)}.pdf"` } });
	}
	const { data } = await supabase.from('orders').select('*').in('checkout_group', groups);
	const gs = groupOrders((data ?? []) as OrderRow[]);
	const pdf = await buildLabelsPdf(gs.map((g) => ({ number: g.number, customer: g.customer, shipping: g.items[0].shipping ?? {}, email: g.email, parcels: parcelsOverride ?? g.items[0].parcels ?? 1, courier, items: g.items.map((i) => ({ qty: i.qty, name: i.product_name, meta: i.description ?? itemMeta(i) })) })));
	return new Response(new Blob([pdf as BlobPart]), { headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="etichette-${gs.map((g) => g.number).join('-')}.pdf"` } });
};
