import { qaplaCouriers } from '$lib/server/couriers/qapla';
import { fail } from '@sveltejs/kit';
import { groupOrders, itemMeta, deliveryMode, thumbOf, type OrderRow } from '$lib/dashboard/orders';
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

/** giorno (Europe/Rome) di una data ISO, come AAAA-MM-GG */
const romeDay = (iso: string) => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Rome' }).format(new Date(iso));

export const load: PageServerLoad = async ({ locals: { supabase }, url }) => {
	syncQapla(url.origin);
	const view = url.searchParams.get('vista') === 'spediti' ? 'spediti' : 'da-spedire';
	const today = romeDay(new Date().toISOString());
	/* DA SPEDIRE: usciti dalla produzione, non ancora inviati a Qapla ne' conclusi. Appena si invia o si conclude, l'ordine esce da qui */
	const { data: todo } = await supabase.from('orders').select('*').in('status', ['pronto', 'in_spedizione']).is('transmitted_at', null).is('ddt_id', null).order('created_at', { ascending: false });
	const groups = groupOrders((todo ?? []) as OrderRow[]);
	if (view === 'da-spedire') return { view, groups, couriers: await qaplaCouriers(), defaultCourier: env.QAPLA_COURIER || 'GLS-ITA', qaplaOk: !!env.QAPLA_API_KEY, today, month: today.slice(0, 7), day: today, days: {} as Record<string, number>, shipped: [] as ReturnType<typeof groupOrders>, todoCount: groups.length };

	/* ORDINI SPEDITI: calendario del mese; per ogni giorno gli ordini partiti quel giorno (data di invio a Qapla o di conclusione) */
	const month = /^\d{4}-\d{2}$/.test(url.searchParams.get('mese') ?? '') ? String(url.searchParams.get('mese')) : today.slice(0, 7);
	const [y, m] = month.split('-').map(Number);
	const from = new Date(Date.UTC(y, m - 1, 1) - 3 * 3600 * 1000).toISOString();   // margine per il fuso: si filtra poi sul giorno di Roma
	const to = new Date(Date.UTC(y, m, 1) + 3 * 3600 * 1000).toISOString();
	const { data: sent } = await supabase.from('orders').select('*').not('shipped_at', 'is', null).gte('shipped_at', from).lt('shipped_at', to).neq('status', 'annullato').order('shipped_at', { ascending: false });
	const all = groupOrders((sent ?? []) as OrderRow[]).filter((g) => romeDay(g.items[0].shipped_at!).startsWith(month));
	const days: Record<string, number> = {};
	for (const g of all) { const d = romeDay(g.items[0].shipped_at!); days[d] = (days[d] ?? 0) + 1; }
	const asked = url.searchParams.get('giorno');
	const day = asked && /^\d{4}-\d{2}-\d{2}$/.test(asked) && asked.startsWith(month) ? asked : (month === today.slice(0, 7) && days[today] ? today : (Object.keys(days).sort().pop() ?? `${month}-01`));
	const shipped = all.filter((g) => romeDay(g.items[0].shipped_at!) === day);
	return { view, groups: [] as typeof groups, couriers: await qaplaCouriers(), defaultCourier: env.QAPLA_COURIER || 'GLS-ITA', qaplaOk: !!env.QAPLA_API_KEY, today, month, day, days, shipped, todoCount: groups.length };
};
const r2 = (v: number) => Math.round(v * 100) / 100;
/* regola: e-commerce pagato subito → fattura gia' emessa al checkout, niente DDT; manuali e altri casi → DDT sempre */
const needsDdt = (o: { channel: string | null; payment_status: string | null }) => !(o.channel === 'ecommerce' && o.payment_status === 'paid');

type Db = App.Locals['supabase'];
/** Quantita' consegnate, scadenze riallineate e DDT: serve a "Concludi" (consegna diretta, corriere del cliente) e a "Invia a Qapla" per gli ordini manuali */
async function makeDdt(supabase: Db, group: string, f: FormData, forceMode?: 'ours'): Promise<{ error: string } | { id: string; number: string; mode: 'ours' | 'customer' | 'direct'; courier: string; g: ReturnType<typeof groupOrders>[number] }> {
	const parcels = Math.max(1, Number(f.get('parcels') ?? 1));
	const weight = Number(f.get('weight') ?? 0) || null;
	let qtys: Record<string, number> = {};
	try { qtys = JSON.parse(String(f.get('qtys') ?? '{}')); } catch { qtys = {}; }
	const { data } = await supabase.from('orders').select('*').eq('checkout_group', group);
	if (!data?.length) return { error: 'Ordine non trovato.' };
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
	const mode = forceMode ?? deliveryMode(g);
	const courier = mode === 'direct' ? 'Consegna diretta' : mode === 'customer' ? 'Corriere del destinatario' : (first.courier ?? 'Qapla');
	const trasporto = mode === 'direct' ? 'Consegna diretta Stickerprint' : mode === 'customer' ? 'Corriere a carico del destinatario' : `Corriere a carico del mittente (${courier})`;
	const { data: num } = await supabase.rpc('next_ddt_number');
	const lines = g.items.map((i) => ({ description: `${i.product_name}${itemMeta(i) ? ' · ' + itemMeta(i) : ''}`, qty: i.qty, unit_net: r2(Number(i.unit_net ?? Number(i.total_net) / i.qty)), total_net: r2(Number(i.total_net)) }));
	const subtotal = r2(lines.reduce((s, l) => s + l.total_net, 0));
	// ordini e-commerce: la fattura esiste già, il DDT resta collegato e non è da fatturare
	const { data: inv } = g.channel === 'manuale' ? { data: null } : await supabase.from('invoices').select('id').eq('checkout_group', group).limit(1).maybeSingle();
	const ddt = { number: num as string, checkout_group: group, order_number: g.number, issued_at: new Date().toISOString().slice(0, 10), parcels, weight_kg: weight, causale: 'Vendita', trasporto, customer_name: g.customer, email: g.email || null, invoice_id: inv?.id ?? null,
		data: { customer: first.billing ?? first.shipping ?? {}, shipping: first.shipping ?? {}, lines, subtotal_net: subtotal, vat_amount: r2(subtotal * 0.22), total_gross: r2(subtotal * 1.22), order_numbers: g.numbers, notes: first.internal_notes ?? null, payment_method: g.payment_method, payment_terms: first.payment_terms ?? null } };
	const { data: row, error } = await supabase.from('ddts').insert(ddt).select('id').single();
	if (error) return { error: `DDT non creato: ${error.message}` };
	await supabase.from('orders').update({ parcels, weight_kg: weight, ddt_id: row.id }).eq('checkout_group', group);
	return { id: row.id as string, number: ddt.number, mode, courier, g };
}


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
	/** Rimanda a Qapla' un ordine gia' inviato ma non ancora ritirato, con un altro corriere (stesso riferimento: Qapla' aggiorna l'ordine) */
	ricorriere: async ({ request, locals: { supabase } }) => {
		const f = await request.formData();
		const group = String(f.get('group') ?? ''); const courierCode = String(f.get('courier') ?? '').trim() || null;
		const { data } = await supabase.from('orders').select('number, tracking_number, courier').eq('checkout_group', group);
		if (!data?.length) return fail(404, { error: 'Ordine non trovato.' });
		if (data[0].tracking_number) return fail(400, { error: 'La spedizione ha già un tracking: il corriere non si cambia più da qui.' });
		let r: { count: number; warnings: string[] };
		try { r = await generateLabels(supabase, 'Qapla', [group], courierCode); } catch (e) { return fail(400, { error: e instanceof Error ? e.message : 'Errore Qapla' }); }
		const hard = r.warnings.filter((w) => !/Ordine inviato a Qapla/.test(w));
		if (hard.length) return fail(400, { error: hard.join(' · ') + ' — se Qapla rifiuta il riferimento doppio, elimina l\'ordine dal pannello Qapla (Etichette → Crea) e riprova.' });
		return { ok: true, qapla: data[0].number, emailed: false, notes: [], ddt: null, labels: null, reshipped: courierCode };
	},
	/** Invia a Qapla': l'ordine passa a Qapla' (sezione Crea, etichetta dal pannello) ed esce da "Da spedire". Resta IN SPEDIZIONE
	    finche' il corriere non lo ritira: da li' spedito, in consegna e consegnato arrivano da Qapla' (webhook e sincronizzazione).
	    Il cliente riceve l'email "in attesa di ritiro". */
	qapla: async ({ request, url, locals: { supabase } }) => {
		const f = await request.formData();
		const group = String(f.get('group') ?? '');
		const { data } = await supabase.from('orders').select('*').eq('checkout_group', group);
		if (!data?.length) return fail(404, { error: 'Ordine non trovato.' });
		const g = groupOrders(data as OrderRow[])[0];
		if (!env.QAPLA_API_KEY) return fail(400, { error: "Qapla non è ancora collegato: manca QAPLA_API_KEY su Vercel." });
		/* colli e peso (dal popup degli ordini manuali) servono a Qapla per l'etichetta */
		if (f.has('parcels')) await supabase.from('orders').update({ parcels: Math.max(1, Number(f.get('parcels') ?? 1)), weight_kg: Number(f.get('weight') ?? 0) || null }).eq('checkout_group', group);
		let r: { count: number; warnings: string[] };
		const courierCode = String(f.get('courier') ?? '').trim() || null;
		try { r = await generateLabels(supabase, 'Qapla', [group], courierCode); } catch (e) { return fail(400, { error: e instanceof Error ? e.message : 'Errore Qapla' }); }
		const hard = r.warnings.filter((w) => !/Ordine inviato a Qapla/.test(w));
		if (hard.length) return fail(400, { error: hard.join(' · ') });
		const now = new Date().toISOString();
		await supabase.from('orders').update({ status: 'in_spedizione', courier: 'Qapla', shipped_at: now, transmitted_at: now }).eq('checkout_group', group);
		/* il DDT si fa SEMPRE (Qapla, consegna diretta, corriere del cliente): qui con le quantita' davvero spedite */
		let ddtInfo: { id: string; number: string } | null = null;
		if (!g.items[0].ddt_id && needsDdt(g.items[0])) {
			const d = await makeDdt(supabase, group, f, 'ours');
			if ('error' in d) return fail(400, { error: `Ordine inviato a Qapla, ma ${d.error}` });
			ddtInfo = { id: d.id, number: d.number };
		}
		// email al cliente: ordine concluso, in attesa del ritiro del corriere
		const first = g.items[0];
		let emailed = false;
		if (g.email) {
			const mail = shippingUpdateEmail({ kind: 'affidato', name: first.shipping?.first_name || g.customer, number: g.number, trackingUrl: `${url.origin}/account/ordini`, items: g.items.map((i) => ({ name: i.product_name, qty: i.qty, meta: itemMeta(i) || null, preview: thumbOf(i) })), accountUrl: first.user_id ? `${url.origin}/account/ordini` : null });
			const res = await sendEmail({ to: g.email, subject: mail.subject, html: mail.html, tag: mail.tag, metadata: { order: g.number } });
			emailed = res.ok;
			if (res.ok) await supabase.from('orders').update({ shipping_notified: ['affidato'] }).eq('checkout_group', group);
		}
		return { ok: true, qapla: g.number, emailed, notes: r.warnings, ddt: ddtInfo?.number ?? null, labels: ddtInfo ? `/dashboard/produzione/spedizioni/etichette?ddt=${ddtInfo.id}&courier=Qapla` : null };
	},
	/** Concludi (consegna diretta o corriere del cliente): DDT ed etichette dei colli, poi l'ordine esce da "Da spedire".
	    Consegna diretta → l'ordine e' CONSEGNATO. Corriere del cliente → SPEDITO, e si ferma li' (non sappiamo quando consegna). */
	ddt: async ({ request, url, locals: { supabase } }) => {
		const f = await request.formData();
		const group = String(f.get('group') ?? '');
		const { data: cur } = await supabase.from('orders').select('shipping_method, channel, courier, transmitted_at, payment_status').eq('checkout_group', group).limit(1).maybeSingle();
		if (!cur) return fail(404, { error: 'Ordine non trovato.' });
		if (deliveryMode(cur) === 'ours') return fail(400, { error: 'Con il nostro corriere usa "Invia a Qapla"; Concludi vale per consegna diretta e corriere del cliente.' });
		const now = new Date().toISOString();
		if (!needsDdt(cur)) {
			/* e-commerce gia' pagato e fatturato: si chiude senza DDT, salvando solo colli e peso */
			const { data: rows } = await supabase.from('orders').select('*').eq('checkout_group', group);
			const g0 = groupOrders((rows ?? []) as OrderRow[])[0]; const m = deliveryMode(cur);
			await supabase.from('orders').update({ parcels: Math.max(1, Number(f.get('parcels') ?? 1)), weight_kg: Number(f.get('weight') ?? 0) || null, ...(m === 'direct' ? { status: 'consegnato', courier: 'Consegna diretta', shipped_at: now, delivered_at: now } : { status: 'spedito', courier: 'Corriere del destinatario', shipped_at: now }) }).eq('checkout_group', group);
			if (g0?.email) { const mail = shippingUpdateEmail({ kind: 'affidato', consegna: m === 'direct' ? 'noi' : 'cliente', name: g0.items[0].shipping?.first_name || g0.customer, number: g0.number, trackingUrl: `${url.origin}/account/ordini`, items: g0.items.map((i) => ({ name: i.product_name, qty: i.qty })) }); sendEmail({ to: g0.email, subject: mail.subject, html: mail.html, tag: mail.tag, metadata: { order: g0.number } }).catch(() => {}); }
			return { ok: true, labels: null, ddt: null, closed: m === 'direct' ? 'consegnato' : 'spedito' };
		}
		const r = await makeDdt(supabase, group, f);
		if ('error' in r) return fail(400, { error: r.error });
		await supabase.from('orders').update(r.mode === 'direct' ? { status: 'consegnato', courier: r.courier, shipped_at: now, delivered_at: now } : { status: 'spedito', courier: r.courier, shipped_at: now }).eq('checkout_group', group);
		const g = r.g, first = g.items[0];
		// email "ordine concluso"
		if (g.email) {
			const mail = shippingUpdateEmail({ kind: 'affidato', consegna: r.mode === 'direct' ? 'noi' : 'cliente', name: first.shipping?.first_name || g.customer, number: g.number, trackingUrl: `${url.origin}/account/ordini`, items: g.items.map((i) => ({ name: i.product_name, qty: i.qty, meta: itemMeta(i) || null, preview: thumbOf(i) })), accountUrl: first.user_id ? `${url.origin}/account/ordini` : null });
			sendEmail({ to: g.email, subject: mail.subject, html: mail.html, tag: mail.tag, metadata: { order: g.number } }).catch(() => {});
		}
		return { ok: true, labels: `/dashboard/produzione/spedizioni/etichette?ddt=${r.id}&courier=${encodeURIComponent(r.courier)}`, ddt: r.number, closed: r.mode === 'direct' ? 'consegnato' : 'spedito' };
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
