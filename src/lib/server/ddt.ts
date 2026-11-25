/**
 * DDT di un ordine. Dal 25/11/2026 (Mattia) il DDT non nasce piu' da solo quando l'ordine va in spedizione: si genera
 * a mano dalla scheda dell'ordine, col bottone «Genera DDT», ed e' facoltativo (la fattura si puo' fare anche
 * direttamente dagli ordini). Non cambia lo stato dell'ordine e non manda email.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { CATS, deliveryMode, groupOrders, itemMeta, type OrderGroup, type OrderRow } from '$lib/dashboard/orders';
import { righeDelGruppo } from './ordini-gruppo';

const r2 = (v: number) => Math.round(v * 100) / 100;

export interface DatiDdt { parcels: number; weight: number | null; /** quantita' consegnate per riga (id della riga → pezzi): senza, quelle dell'ordine */ qtys?: Record<string, number> }

/** Crea il DDT dell'ordine: quantita' consegnate (se diverse aggiornano l'ordine e le scadenze), colli e peso. */
export async function creaDdt(supabase: SupabaseClient, key: string, d: DatiDdt): Promise<{ error: string } | { id: string; number: string; g: OrderGroup }> {
	const data = await righeDelGruppo(supabase, key);
	const vive = data.filter((r) => r.status !== 'annullato');
	if (!vive.length) return { error: 'Ordine non trovato.' };
	if (vive.some((r) => r.ddt_id)) return { error: 'Questo ordine ha già un DDT.' };
	const ids = vive.map((r) => r.id);
	const parcels = Math.max(1, Math.round(Number(d.parcels) || 1));
	const weight = Number(d.weight) > 0 ? Number(d.weight) : null;
	const qtys = d.qtys ?? {};
	for (const it of vive) {
		const q = Math.max(1, Math.round(Number(qtys[it.id] ?? it.qty)));
		if (q !== it.qty) {
			const unit = Number(it.unit_net ?? Number(it.total_net) / it.qty);
			const net = r2(unit * q);
			await supabase.from('orders').update({ qty: q, total_net: net, total_gross: r2(net * 1.22) }).eq('id', it.id);
			it.qty = q; it.total_net = net; it.total_gross = r2(net * 1.22);
		}
	}
	const g = groupOrders(vive)[0];
	const first = g.items[0];
	// se le quantità sono cambiate, le scadenze di pagamento seguono il nuovo totale (in proporzione)
	const oldTerms = first.payment_terms ?? [];
	const oldSum = r2(oldTerms.reduce((s, t) => s + Number(t.amount), 0));
	if (oldTerms.length && oldSum > 0 && Math.abs(oldSum - g.gross) > 0.01) {
		const k = g.gross / oldSum;
		const terms = oldTerms.map((t) => ({ ...t, amount: r2(Number(t.amount) * k) }));
		terms[terms.length - 1].amount = r2(terms[terms.length - 1].amount + g.gross - terms.reduce((s, t) => s + t.amount, 0));
		await supabase.from('orders').update({ payment_terms: terms }).in('id', ids);
		for (const it of g.items) it.payment_terms = terms;
	}
	/* come viaggia la merce: e' una dicitura del documento, presa dal metodo di spedizione scritto sull'ordine */
	const mode = deliveryMode(g);
	const courier = mode === 'direct' ? 'Consegna diretta' : mode === 'customer' ? 'Corriere del destinatario' : (first.courier ?? 'Qapla');
	const trasporto = mode === 'direct' ? 'Consegna diretta Stickerprint' : mode === 'customer' ? 'Corriere a carico del destinatario' : `Corriere a carico del mittente (${courier})`;
	const { data: num } = await supabase.rpc('next_ddt_number');
	if (!num) return { error: 'Numero del DDT non disponibile, riprova.' };
	const lines = g.items.map((i) => ({ code: i.product_code ?? CATS[i.product_slug]?.code ?? null, description: `${i.product_name}${itemMeta(i) ? ' · ' + itemMeta(i) : ''}`, qty: i.qty, unit_net: r2(Number(i.unit_net ?? Number(i.total_net) / i.qty)), total_net: r2(Number(i.total_net)) }));
	const subtotal = r2(lines.reduce((s, l) => s + l.total_net, 0));
	// ordini e-commerce: la fattura esiste già, il DDT resta collegato e non è da fatturare
	const { data: inv } = g.channel === 'manuale' ? { data: null } : await supabase.from('invoices').select('id').eq('checkout_group', g.key).limit(1).maybeSingle();
	const ddt = { number: num as string, checkout_group: g.key, order_number: g.number, issued_at: new Date().toISOString().slice(0, 10), parcels, weight_kg: weight, causale: 'Vendita', trasporto, customer_name: g.customer, email: g.email || null, invoice_id: inv?.id ?? null,
		data: { customer: first.billing ?? first.shipping ?? {}, shipping: first.shipping ?? {}, lines, subtotal_net: subtotal, vat_amount: r2(subtotal * 0.22), total_gross: r2(subtotal * 1.22), order_numbers: g.numbers, notes: first.internal_notes ?? null, payment_method: g.payment_method, payment_terms: first.payment_terms ?? null } };
	const { data: row, error } = await supabase.from('ddts').insert(ddt).select('id').single();
	if (error) return { error: `DDT non creato: ${error.message}` };
	await supabase.from('orders').update({ parcels, weight_kg: weight, ddt_id: row.id }).in('id', ids);
	return { id: row.id as string, number: ddt.number, g };
}
