import { fail } from '@sveltejs/kit';
import { groupOrders, itemMeta, deliveryMode, COURIERS, type OrderRow } from '$lib/dashboard/orders';
import { courierDay, generateLabels, transmitShipments } from '$lib/server/shipping';
import { courierStatus } from '$lib/server/couriers';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals: { supabase } }) => {
	const { data } = await supabase.from('orders').select('*').in('status', ['pronto', 'in_spedizione', 'spedito', 'in_consegna']).order('created_at', { ascending: false });
	const groups = groupOrders((data ?? []) as OrderRow[]);
	// le tre colonne corriere: spedizioni di oggi, da generare, da trasmettere
	const status = Object.fromEntries(courierStatus().map((c) => [c.id, c.configured]));
	const couriers = Object.keys(COURIERS).map((c) => ({ id: c, ...courierDay(groups, c), configured: !!status[c] }));
	return { groups, couriers };
};
const r2 = (v: number) => Math.round(v * 100) / 100;

export const actions: Actions = {
	/** Scelta del corriere dalla tendina (ordini e-commerce e manuali con nostro corriere) */
	courier: async ({ request, locals: { supabase } }) => {
		const f = await request.formData();
		const courier = String(f.get('courier') ?? '');
		if (!COURIERS[courier]) return fail(400, { error: 'Corriere non valido.' });
		const { error } = await supabase.from('orders').update({ courier, transmitted_at: null }).eq('checkout_group', String(f.get('group')));
		if (error) return fail(400, { error: error.message });
		return { ok: true };
	},
	/** Genera spedizioni: crea le spedizioni presso il corriere (se collegato) e scarica il PDF unico delle etichette */
	labels: async ({ request, locals: { supabase } }) => {
		const f = await request.formData();
		const courier = String(f.get('courier') ?? '');
		if (!COURIERS[courier]) return fail(400, { error: 'Corriere non valido.' });
		const { data } = await supabase.from('orders').select('*').eq('status', 'pronto').eq('courier', courier).is('labels_generated_at', null).is('transmitted_at', null);
		const keys = groupOrders((data ?? []) as OrderRow[]).filter((g) => deliveryMode(g) === 'ours').map((g) => g.key);
		if (!keys.length) return fail(400, { error: `Nessuna spedizione ${courier} da generare.` });
		try {
			const r = await generateLabels(supabase, courier, keys);
			return { ok: true, generated: courier, count: r.count, warnings: r.warnings, labels: `/dashboard/produzione/spedizioni/etichette?groups=${keys.join(',')}&courier=${courier}&day=1` };
		} catch (e) { return fail(400, { error: e instanceof Error ? e.message : 'Errore' }); }
	},
	/** Trasmetti spedizioni: invio al corriere e manifest da consegnare all'autista */
	transmit: async ({ request, locals: { supabase } }) => {
		const f = await request.formData();
		const courier = String(f.get('courier') ?? '');
		if (!COURIERS[courier]) return fail(400, { error: 'Corriere non valido.' });
		const { data } = await supabase.from('orders').select('*').eq('status', 'pronto').eq('courier', courier).not('labels_generated_at', 'is', null).is('transmitted_at', null);
		const keys = groupOrders((data ?? []) as OrderRow[]).filter((g) => deliveryMode(g) === 'ours').map((g) => g.key);
		if (!keys.length) return fail(400, { error: `Nessuna spedizione ${courier} da trasmettere: prima genera le spedizioni.` });
		try {
			const r = await transmitShipments(supabase, courier, keys);
			return { ok: true, transmitted: courier, count: r.count, warnings: r.warnings, manifest: r.number, labels: `/dashboard/produzione/spedizioni/manifest/${r.manifestId}` };
		} catch (e) { return fail(400, { error: e instanceof Error ? e.message : 'Errore' }); }
	},
	/** Concludi: DDT ed etichette dei colli per qualsiasi ordine (consegna diretta, corriere del cliente o nostro corriere già trasmesso). Le quantità possono cambiare rispetto all'ordine. */
	ddt: async ({ request, locals: { supabase } }) => {
		const f = await request.formData();
		const group = String(f.get('group') ?? '');
		const parcels = Math.max(1, Number(f.get('parcels') ?? 1));
		const weight = Number(f.get('weight') ?? 0) || null;
		let qtys: Record<string, number> = {};
		try { qtys = JSON.parse(String(f.get('qtys') ?? '{}')); } catch { qtys = {}; }
		const { data } = await supabase.from('orders').select('*').eq('checkout_group', group);
		if (!data?.length) return fail(404, { error: 'Ordine non trovato.' });
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
		// se le quantità sono cambiate, le scadenze di pagamento seguono il nuovo totale (in proporzione)
		const oldTerms = first.payment_terms ?? [];
		const oldSum = r2(oldTerms.reduce((s, t) => s + Number(t.amount), 0));
		if (oldTerms.length && oldSum > 0 && Math.abs(oldSum - g.gross) > 0.01) {
			const k = g.gross / oldSum;
			const terms = oldTerms.map((t) => ({ ...t, amount: r2(Number(t.amount) * k) }));
			terms[terms.length - 1].amount = r2(terms[terms.length - 1].amount + g.gross - terms.reduce((s, t) => s + t.amount, 0));
			await supabase.from('orders').update({ payment_terms: terms }).eq('checkout_group', group);
			for (const it of g.items) it.payment_terms = terms;
		}
		const mode = deliveryMode(g);
		if (mode === 'ours' && !(first.courier && first.transmitted_at)) return fail(400, { error: 'Scegli il corriere e trasmetti la spedizione prima di concludere.' });
		const courier = mode === 'direct' ? 'Consegna diretta' : mode === 'customer' ? 'Corriere del destinatario' : first.courier!;
		const trasporto = mode === 'direct' ? 'Consegna diretta Stickerprint' : mode === 'customer' ? 'Corriere a carico del destinatario' : `Corriere a carico del mittente (${courier})`;
		const { data: num } = await supabase.rpc('next_ddt_number');
		const lines = g.items.map((i) => ({ description: `${i.product_name}${itemMeta(i) ? ' · ' + itemMeta(i) : ''}`, qty: i.qty, unit_net: r2(Number(i.unit_net ?? Number(i.total_net) / i.qty)), total_net: r2(Number(i.total_net)) }));
		const subtotal = r2(lines.reduce((s, l) => s + l.total_net, 0));
		// ordini e-commerce: la fattura esiste già, il DDT resta collegato e non è da fatturare
		const { data: inv } = g.channel === 'manuale' ? { data: null } : await supabase.from('invoices').select('id').eq('checkout_group', group).limit(1).maybeSingle();
		const ddt = { number: num as string, checkout_group: group, order_number: g.number, issued_at: new Date().toISOString().slice(0, 10), parcels, weight_kg: weight, causale: 'Vendita', trasporto, customer_name: g.customer, email: g.email || null, invoice_id: inv?.id ?? null,
			data: { customer: first.billing ?? first.shipping ?? {}, shipping: first.shipping ?? {}, lines, subtotal_net: subtotal, vat_amount: r2(subtotal * 0.22), total_gross: r2(subtotal * 1.22), order_numbers: g.numbers, notes: first.internal_notes ?? null, payment_method: g.payment_method, payment_terms: first.payment_terms ?? null } };
		const { data: row, error } = await supabase.from('ddts').insert(ddt).select('id').single();
		if (error) return fail(400, { error: `DDT non creato: ${error.message}` });
		await supabase.from('orders').update({ status: mode === 'ours' ? 'in_spedizione' : 'spedito', courier, parcels, weight_kg: weight, shipped_at: new Date().toISOString(), ddt_id: row.id }).eq('checkout_group', group);
		return { ok: true, labels: `/dashboard/produzione/spedizioni/etichette?ddt=${row.id}&courier=${encodeURIComponent(courier)}`, ddt: ddt.number };
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
