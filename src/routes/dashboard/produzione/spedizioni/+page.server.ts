import { fail } from '@sveltejs/kit';
import { groupOrders, itemMeta, deliveryMode, type OrderRow } from '$lib/dashboard/orders';
import { generateLabels } from '$lib/server/shipping';
import { sendEmail } from '$lib/server/email';
import { shippingUpdateEmail } from '$lib/server/email-templates';
import { env } from '$env/dynamic/private';

/* stati Qapla': oltre al webhook, quando lo staff apre questa pagina si rileggono le spedizioni in viaggio
   (al massimo ogni 20 minuti). Il cron di Vercel gira solo una volta al giorno sul piano attuale. */
let lastSync = 0;
function syncQapla(origin: string) {
	if (!env.QAPLA_API_KEY || !env.INTERNAL_API_KEY || Date.now() - lastSync < 20 * 60 * 1000) return;
	lastSync = Date.now();
	fetch(`${origin}/api/qapla/sync`, { headers: { 'x-internal-key': env.INTERNAL_API_KEY } }).catch(() => {});
}
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals: { supabase }, url }) => {
	syncQapla(url.origin);
	const { data } = await supabase.from('orders').select('*').in('status', ['pronto', 'in_spedizione', 'spedito', 'in_consegna']).order('created_at', { ascending: false });
	const groups = groupOrders((data ?? []) as OrderRow[]);
	return { groups, qaplaOk: !!env.QAPLA_API_KEY };
};
const r2 = (v: number) => Math.round(v * 100) / 100;

export const actions: Actions = {
	/** Tendina "Spedizione": Qapla (nostro corriere via Qapla'), consegna diretta o corriere del cliente */
	mode: async ({ request, locals: { supabase } }) => {
		const f = await request.formData();
		const mode = String(f.get('mode') ?? '');
		const map: Record<string, { courier: string | null; shipping_method: string }> = {
			qapla: { courier: 'Qapla', shipping_method: 'Corriere a carico del mittente' },
			direct: { courier: null, shipping_method: 'Consegna diretta Stickerprint' },
			customer: { courier: null, shipping_method: 'Corriere a carico del destinatario' }
		};
		if (!map[mode]) return fail(400, { error: 'Scelta non valida.' });
		// cambiando modalita' si ricomincia: invio a Qapla' e tracking precedenti non valgono piu'
		const { error } = await supabase.from('orders').update({ ...map[mode], transmitted_at: null, labels_generated_at: null, tracking_number: null, courier_label_path: null, manifest_id: null }).eq('checkout_group', String(f.get('group')));
		if (error) return fail(400, { error: error.message });
		return { ok: true };
	},
	/** Invia a Qapla': l'ordine passa a Qapla' (sezione Crea, etichetta dal pannello), l'ordine e' concluso
	    e il cliente riceve l'email "in attesa di ritiro"; poi gli stati arrivano dal webhook */
	qapla: async ({ request, url, locals: { supabase } }) => {
		const f = await request.formData();
		const group = String(f.get('group') ?? '');
		const { data } = await supabase.from('orders').select('*').eq('checkout_group', group);
		if (!data?.length) return fail(404, { error: 'Ordine non trovato.' });
		const g = groupOrders(data as OrderRow[])[0];
		if (!env.QAPLA_API_KEY) return fail(400, { error: "Qapla non è ancora collegato: manca QAPLA_API_KEY su Vercel." });
		let r: { count: number; warnings: string[] };
		try { r = await generateLabels(supabase, 'Qapla', [group]); } catch (e) { return fail(400, { error: e instanceof Error ? e.message : 'Errore Qapla' }); }
		const hard = r.warnings.filter((w) => !/Ordine inviato a Qapla/.test(w));
		if (hard.length) return fail(400, { error: hard.join(' · ') });
		const now = new Date().toISOString();
		await supabase.from('orders').update({ status: 'in_spedizione', courier: 'Qapla', shipped_at: now, transmitted_at: now }).eq('checkout_group', group);
		// email al cliente: ordine concluso, in attesa del ritiro del corriere
		const first = g.items[0];
		let emailed = false;
		if (g.email) {
			const mail = shippingUpdateEmail({ kind: 'affidato', name: first.shipping?.first_name || g.customer, number: g.number, trackingUrl: `${url.origin}/account/ordini`, items: g.items.map((i) => `${i.qty} × ${i.product_name}`), accountUrl: first.user_id ? `${url.origin}/account/ordini` : null });
			const res = await sendEmail({ to: g.email, subject: mail.subject, html: mail.html, tag: mail.tag, metadata: { order: g.number } });
			emailed = res.ok;
			if (res.ok) await supabase.from('orders').update({ shipping_notified: ['affidato'] }).eq('checkout_group', group);
		}
		return { ok: true, qapla: g.number, emailed, notes: r.warnings };
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
		if (mode === 'ours' && !(first.courier && first.transmitted_at)) return fail(400, { error: 'Con il nostro corriere usa "Invia a Qapla"; Concludi vale per consegna diretta e corriere del cliente.' });
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
