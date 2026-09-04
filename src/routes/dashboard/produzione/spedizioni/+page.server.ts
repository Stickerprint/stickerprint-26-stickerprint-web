import { fail } from '@sveltejs/kit';
import { groupOrders, itemMeta, type OrderRow } from '$lib/dashboard/orders';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals: { supabase } }) => {
	const { data } = await supabase.from('orders').select('*').in('status', ['pronto', 'in_spedizione', 'spedito', 'in_consegna']).order('created_at', { ascending: false });
	return { groups: groupOrders((data ?? []) as OrderRow[]) };
};
const r2 = (v: number) => Math.round(v * 100) / 100;

export const actions: Actions = {
	/** Crea la spedizione con il corriere scelto per gli ordini selezionati (le etichette si scaricano subito dopo) */
	ship: async ({ request, locals: { supabase } }) => {
		const f = await request.formData();
		const groups = String(f.get('groups') ?? '').split(',').filter(Boolean);
		const courier = String(f.get('courier') ?? '');
		const parcels = Math.max(1, Number(f.get('parcels') ?? 1));
		if (!groups.length || !['GLS', 'FedEx', 'TNT'].includes(courier)) return fail(400, { error: 'Seleziona gli ordini e il corriere.' });
		const { error } = await supabase.from('orders').update({ status: 'in_spedizione', courier, parcels, shipped_at: new Date().toISOString() }).in('checkout_group', groups);
		if (error) return fail(400, { error: error.message });
		return { ok: true, labels: `/dashboard/produzione/spedizioni/etichette?groups=${groups.join(',')}&courier=${courier}` };
	},
	/** Ordini manuali: SEMPRE con DDT (consegna diretta o corriere). Le quantità possono cambiare rispetto all'ordine. */
	ddt: async ({ request, locals: { supabase } }) => {
		const f = await request.formData();
		const group = String(f.get('group') ?? '');
		const parcels = Math.max(1, Number(f.get('parcels') ?? 1));
		const weight = Number(f.get('weight') ?? 0) || null;
		const courierChoice = String(f.get('courier') ?? '');
		let qtys: Record<string, number> = {};
		try { qtys = JSON.parse(String(f.get('qtys') ?? '{}')); } catch { qtys = {}; }
		const { data } = await supabase.from('orders').select('*').eq('checkout_group', group);
		if (!data?.length) return fail(404, { error: 'Ordine non trovato.' });
		// quantità effettivamente consegnate (es. 1000 ordinate, 1200 prodotte): si aggiornano ordine e importi
		for (const it of data as OrderRow[]) {
			const q = Math.max(1, Math.round(Number(qtys[it.id] ?? it.qty)));
			if (q !== it.qty) {
				const unit = Number(it.unit_net ?? Number(it.total_net) / it.qty);
				const net = r2(unit * q);
				await supabase.from('orders').update({ qty: q, total_net: net, total_gross: r2(net * 1.22) }).eq('id', it.id);
				it.qty = q; it.total_net = net; it.total_gross = r2(net * 1.22);
			}
		}
		const g = groupOrders(data as OrderRow[])[0];
		const first = g.items[0];
		const direct = /diretta/i.test(g.shipping_method ?? '') || !courierChoice;
		const { data: num } = await supabase.rpc('next_ddt_number');
		const lines = g.items.map((i) => ({ description: `${i.product_name}${i.description ? ' · ' + i.description : ''}${itemMeta(i) && !i.description ? ' · ' + itemMeta(i) : ''}`, qty: i.qty, unit_net: r2(Number(i.unit_net ?? Number(i.total_net) / i.qty)), total_net: r2(Number(i.total_net)) }));
		const subtotal = r2(lines.reduce((s, l) => s + l.total_net, 0));
		const ddt = { number: num as string, checkout_group: group, order_number: g.number, issued_at: new Date().toISOString().slice(0, 10), parcels, weight_kg: weight, causale: 'Vendita', trasporto: g.shipping_method ?? 'Consegna diretta Stickerprint', customer_name: g.customer, email: g.email || null,
			data: { customer: first.billing ?? first.shipping ?? {}, shipping: first.shipping ?? {}, lines, subtotal_net: subtotal, vat_amount: r2(subtotal * 0.22), total_gross: r2(subtotal * 1.22), order_numbers: g.numbers, notes: first.internal_notes ?? null, payment_method: g.payment_method, payment_terms: first.payment_terms ?? null } };
		const { data: row, error } = await supabase.from('ddts').insert(ddt).select('id').single();
		if (error) return fail(400, { error: `DDT non creato: ${error.message}` });
		await supabase.from('orders').update({ status: direct ? 'spedito' : 'in_spedizione', courier: direct ? 'Consegna diretta' : courierChoice, parcels, weight_kg: weight, shipped_at: new Date().toISOString(), ddt_id: row.id }).eq('checkout_group', group);
		return { ok: true, labels: `/dashboard/produzione/spedizioni/etichette?ddt=${row.id}${direct ? '' : `&courier=${encodeURIComponent(courierChoice)}`}`, ddt: ddt.number };
	},
	status: async ({ request, locals: { supabase } }) => {
		const f = await request.formData();
		const status = String(f.get('status'));
		const patch: Record<string, string | null> = { status };
		if (f.has('tracking')) patch.tracking_url = String(f.get('tracking')).trim() || null;
		if (status === 'consegnato') patch.delivered_at = new Date().toISOString();
		const { error } = await supabase.from('orders').update(patch).eq('checkout_group', String(f.get('group')));
		if (error) return fail(400, { error: error.message });
		return { ok: true };
	}
};
