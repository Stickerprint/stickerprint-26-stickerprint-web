import { groupOrders, type OrderRow } from '$lib/dashboard/orders';
import { contestoMargini, indiceFatture, margineOrdine, COLONNE_FATTURA, type FatturaMargine } from '$lib/server/margini';
import { PARAMETRI, COSTO_SPEDIZIONE_NETTO } from '$lib/margini/costi';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url, locals: { supabase } }) => {
	const year = Number(url.searchParams.get('anno')) || new Date().getFullYear();
	/* stessi ordini della lista Ordini (e-commerce solo se pagati), senza gli annullati: non si produce niente */
	const [{ data }, { data: first }, { data: fatture }, ctx] = await Promise.all([
		supabase.from('orders').select('*').gte('created_at', `${year}-01-01`).lt('created_at', `${year + 1}-01-01`).or('channel.neq.ecommerce,status.neq.attesa_pagamento').neq('status', 'annullato').order('created_at', { ascending: false }).limit(3000),
		supabase.from('orders').select('created_at').order('created_at', { ascending: true }).limit(1).maybeSingle(),
		/* spedizione addebitata ed express stanno solo in fattura */
		supabase.from('invoices').select(COLONNE_FATTURA).gte('issued_at', `${year - 1}-12-01`).lt('issued_at', `${year + 1}-02-01`).limit(5000),
		contestoMargini(supabase)
	]);
	const fatturaDi = indiceFatture((fatture ?? []) as FatturaMargine[]);
	const ordini = groupOrders((data ?? []) as OrderRow[]).map((g) => margineOrdine(g, ctx, fatturaDi(g)));
	const firstYear = first ? new Date(first.created_at).getFullYear() : year;
	const now = new Date().getFullYear();
	const years = Array.from({ length: Math.max(1, now - Math.min(firstYear, now - 2) + 1) }, (_, i) => now - i);
	return { year, years, ordini, parametri: { bobina: PARAMETRI.bobina.width, scarto: PARAMETRI.scarto, spedizione: COSTO_SPEDIZIONE_NETTO } };
};
