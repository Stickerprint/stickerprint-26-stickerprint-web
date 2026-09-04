import { groupOrders, type OrderRow } from '$lib/dashboard/orders';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals: { supabase } }) => {
	const { data } = await supabase.from('orders').select('*').in('status', ['attesa_prova', 'in_attesa', 'modifiche_richieste', 'approvazione', 'in_produzione', 'pronto', 'in_spedizione']).order('created_at', { ascending: true });
	const rows = (data ?? []) as OrderRow[];
	const byStage: Record<string, OrderRow[]> = { prove: [], stampa: [], plastifica: [], taglio: [], resinatura: [], confezionamento: [], spedizione: [] };
	for (const r of rows) {
		if (['attesa_prova', 'in_attesa', 'modifiche_richieste', 'approvazione'].includes(r.status)) byStage.prove.push(r);
		else if (r.status === 'in_produzione' && r.prod_stage && byStage[r.prod_stage]) byStage[r.prod_stage].push(r);
		else if (r.status === 'pronto' || r.status === 'in_spedizione') byStage.spedizione.push(r);
	}
	return { byStage, groups: groupOrders(rows) };
};
