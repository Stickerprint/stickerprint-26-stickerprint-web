/** Salvataggio ordini dalla dashboard (nuovo o modifica), anagrafica e conferma d'ordine. */
import type { SupabaseClient } from '@supabase/supabase-js';
import { CATS, SHIPPING_METHODS, groupOrders, money, type OrderRow } from '$lib/dashboard/orders';
import { VAT, r2, categoryOf, type OrderDraft, type ProductCode } from '$lib/dashboard/orderDraft';
import type { PaymentMethod } from '$lib/dashboard/payments';
import { buildOrderPdf } from './docs';
import { sendEmail } from './email';
import { manualOrderEmail } from './email-templates';

export function parseDraft(raw: FormDataEntryValue | null): OrderDraft | null {
	try { const d = JSON.parse(String(raw ?? '')) as OrderDraft; return d && d.customer && Array.isArray(d.items) ? d : null; } catch { return null; }
}
const toB64 = (bytes: Uint8Array) => { let s = ''; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000)); return btoa(s); };

/** Contatto in anagrafica: aggiorna se esiste (stessa P.IVA o email), altrimenti lo crea. Ritorna l'id. */
export async function upsertContact(supabase: SupabaseClient, c: OrderDraft['customer'], id: string | null = null): Promise<{ id: string | null; error?: string }> {
	const row = { kind: c.piva ? 'azienda' : 'privato', name: c.name || [c.first_name, c.last_name].filter(Boolean).join(' '), first_name: c.first_name || null, last_name: c.last_name || null, email: c.email?.toLowerCase() || null, phone: c.phone || null, street: c.address || null, city: c.city || null, zip: c.cap || null, province: (c.province || '').toUpperCase().slice(0, 2) || null, country: c.country || 'IT', vat: c.piva || null, fiscal_code: c.cf || null, sdi: c.sdi || null, pec: c.pec || null, updated_at: new Date().toISOString() };
	if (!row.name) return { id: null, error: 'Inserisci almeno il nome del cliente.' };
	let target = id;
	if (!target) {
		const q = supabase.from('contacts').select('id');
		const { data } = row.vat ? await q.eq('vat', row.vat).limit(1).maybeSingle() : row.email ? await q.ilike('email', row.email).limit(1).maybeSingle() : { data: null };
		target = data?.id ?? null;
	}
	if (target) { const { error } = await supabase.from('contacts').update(row).eq('id', target); return { id: target, error: error?.message }; }
	const { data, error } = await supabase.from('contacts').insert(row).select('id').single();
	return { id: data?.id ?? null, error: error?.message };
}

/** Crea (group = null) o aggiorna tutto l'ordine: righe, cliente, spedizione, scadenze. Ritorna il checkout_group. */
export async function saveOrderDraft(supabase: SupabaseClient, d: OrderDraft, group: string | null, opts: { methods: PaymentMethod[]; codes: ProductCode[] }): Promise<{ group: string; numbers: string[]; error?: string }> {
	const s = (v: string | null | undefined) => (v ?? '').trim();
	const c = d.customer;
	const name = s(c.name) || [s(c.first_name), s(c.last_name)].filter(Boolean).join(' ');
	if (!name) return { group: group ?? '', numbers: [], error: 'Inserisci almeno il nome del cliente.' };
	const items = d.items.filter((i) => i && (s(i.code) || s(i.description)) && Number(i.qty) > 0);
	if (!items.length) return { group: group ?? '', numbers: [], error: 'Aggiungi almeno un articolo.' };
	const lordi = d.price_type === 'lordi';
	const billing = { company: name, first_name: s(c.first_name), last_name: s(c.last_name), street: s(c.address), city: s(c.city), zip: s(c.cap), province: s(c.province).toUpperCase().slice(0, 2), country: s(c.country) || 'IT', vat: s(c.piva), fiscal_code: s(c.cf), sdi: s(c.sdi), pec: s(c.pec), phone: s(c.phone) };
	const sh = d.shipping ?? { name: '', address: '', city: '', cap: '', province: '', country: 'IT' };
	const shipping = d.ship_same !== false ? { ...billing } : { company: s(sh.name) || name, first_name: '', last_name: '', street: s(sh.address), city: s(sh.city), zip: s(sh.cap), province: s(sh.province).toUpperCase().slice(0, 2), country: s(sh.country) || 'IT', phone: s(c.phone) };
	const totals = items.reduce((sum, it) => sum + (lordi ? Number(it.price) / VAT : Number(it.price)) * Number(it.qty), 0);
	const totalGross = r2(totals * VAT);
	// scadenze: righe dell'editor (metodo + data + importo); senza righe → unica scadenza alla data ordine
	const byId = new Map(opts.methods.map((m) => [m.id, m]));
	let terms = (d.terms ?? []).filter((t) => t.due).map((t) => { const m = byId.get(t.method_id); return { due: t.due, amount: r2(Number(t.amount) || 0), method: m?.name ?? t.method ?? 'Bonifico bancario', xml_code: m?.xml_code ?? t.xml_code ?? 'MP05' }; });
	if (!terms.length) terms = [{ due: s(d.date) || new Date().toISOString().slice(0, 10), amount: totalGross, method: opts.methods[0]?.name ?? 'Bonifico bancario', xml_code: opts.methods[0]?.xml_code ?? 'MP05' }];
	// gli importi delle rate devono coprire il totale: l'ultima assorbe la differenza
	const sumTerms = r2(terms.reduce((a, t) => a + t.amount, 0));
	if (Math.abs(sumTerms - totalGross) > 0.01) terms[terms.length - 1].amount = r2(terms[terms.length - 1].amount + totalGross - sumTerms);
	const methodNames = [...new Set(terms.map((t) => t.method))];
	const payment = methodNames.join(' + ');
	const paidUpfront = terms.every((t) => opts.methods.find((m) => m.name === t.method)?.paid_upfront);
	const createdAt = s(d.date) ? new Date(s(d.date) + 'T10:00:00').toISOString() : new Date().toISOString();
	const common = {
		customer_name: name, email: s(c.email).toLowerCase() || null, country: billing.country, shipping, billing, contact_id: d.contact_id || null,
		payment_method: payment, payment_terms: terms, shipping_method: s(d.ship_method) || SHIPPING_METHODS[0], delivery_date: s(d.ship_date) || null,
		internal_notes: s(d.notes) || null, created_at: createdAt, price_type: lordi ? 'lordi' : 'netti'
	};
	const key = group ?? crypto.randomUUID();
	let existing: OrderRow[] = [];
	if (group) { const { data } = await supabase.from('orders').select('*').eq('checkout_group', group); existing = (data ?? []) as OrderRow[]; }
	const g = existing.length ? groupOrders(existing)[0] : null;
	const numbers: string[] = [];
	const keep = new Set<string>();
	for (const it of items) {
		const slug = categoryOf(it.code, opts.codes) ?? 'adesivi_personalizzati';
		const unitNet = lordi ? Number(it.price) / VAT : Number(it.price);
		const net = r2(unitNet * Number(it.qty));
		const line = { product_slug: slug, product_name: CATS[slug]?.name ?? slug, product_code: s(it.code).toUpperCase().slice(0, 12) || null, description: s(it.description) || null, qty: Number(it.qty), unit_net: Math.round(unitNet * 10000) / 10000, total_net: net, total_gross: r2(net * VAT), lamination: it.lamination || null, mockup_url: it.mockup_url || null, ...common };
		const prev = it.id ? existing.find((e) => e.id === it.id) : null;
		if (prev) {
			const { error } = await supabase.from('orders').update({ ...line, payment_status: prev.channel === 'manuale' ? (paidUpfront ? 'paid' : 'pending') : prev.payment_status }).eq('id', prev.id);
			if (error) return { group: key, numbers, error: `Ordine non salvato: ${error.message}` };
			keep.add(prev.id); numbers.push(prev.number);
		} else {
			const { data: num, error: ne } = await supabase.rpc('next_order_number');
			if (ne || !num) return { group: key, numbers, error: 'Numero d’ordine non disponibile.' };
			const row = { ...line, user_id: g?.items[0].user_id ?? null, number: num as string, checkout_group: key, channel: g?.channel ?? 'manuale', status: g?.status ?? 'in_produzione', prod_stage: g ? (g.items[0].prod_stage ?? 'stampa') : 'stampa', payment_status: paidUpfront ? 'paid' : 'pending', device: g?.device ?? null };
			const { data: ins, error } = await supabase.from('orders').insert(row).select('id').single();
			if (error) return { group: key, numbers, error: `Ordine non salvato: ${error.message}` };
			if (ins) keep.add(ins.id); numbers.push(row.number);
		}
	}
	const gone = existing.filter((e) => !keep.has(e.id)).map((e) => e.id);
	if (gone.length) await supabase.from('orders').delete().in('id', gone);
	return { group: key, numbers };
}

/** PDF di conferma d'ordine (riepilogo articoli, totali e scadenze) */
export async function orderPdfForGroup(supabase: SupabaseClient, group: string): Promise<{ pdf: Uint8Array; number: string; email: string; customer: string } | null> {
	const { data } = await supabase.from('orders').select('*').eq('checkout_group', group);
	if (!data?.length) return null;
	const g = groupOrders(data as OrderRow[])[0];
	const f = g.items[0];
	const pdf = await buildOrderPdf({ number: g.number, numbers: g.numbers, issued_at: g.created_at, customer: f.billing ?? {}, shipping: f.shipping ?? {}, email: g.email, lines: g.items.map((i) => ({ description: `${i.product_name}${i.description ? ' · ' + i.description : ''}`, qty: i.qty, unit_net: Number(i.unit_net ?? Number(i.total_net) / i.qty), total_net: Number(i.total_net) })), subtotal_net: g.net, vat_amount: r2(g.gross - g.net), total_gross: g.gross, payment_method: g.payment_method ?? '', payment_terms: f.payment_terms ?? [], shipping_method: g.shipping_method ?? '', delivery_date: g.delivery_date, notes: f.notes });
	return { pdf, number: g.number, email: g.email, customer: g.customer };
}

/** Invia la conferma d'ordine via email con il PDF allegato */
export async function sendOrderConfirmation(supabase: SupabaseClient, group: string): Promise<{ ok: boolean; message: string }> {
	const { data } = await supabase.from('orders').select('*').eq('checkout_group', group);
	const g = data?.length ? groupOrders(data as OrderRow[])[0] : null;
	if (!g?.email) return { ok: false, message: 'L’ordine non ha un indirizzo email.' };
	const doc = await orderPdfForGroup(supabase, group);
	const f = g.items[0];
	const mail = manualOrderEmail({ name: f.billing?.first_name || g.customer, number: g.number, total: money(g.gross), lines: g.items.map((i) => `${i.qty.toLocaleString('it-IT')} × ${i.product_name}${i.description ? ' · ' + i.description : ''}`), shipDate: g.delivery_date ? new Date(g.delivery_date).toLocaleDateString('it-IT') : 'da confermare', terms: (f.payment_terms ?? []).map((t) => `${new Date(t.due).toLocaleDateString('it-IT')} · ${money(Number(t.amount))} · ${t.method}`) });
	const r = await sendEmail({ to: g.email, ...mail, attachments: doc ? [{ name: `Conferma-ordine-${g.number}.pdf`, content: toB64(doc.pdf), contentType: 'application/pdf' }] : [] });
	if (!r.ok) return { ok: false, message: r.error ?? 'Email non inviata.' };
	return { ok: true, message: r.skipped ? 'Postmark non configurato: email non inviata (simulata).' : `Conferma inviata a ${g.email}.` };
}

/** Dati per l'editor: metodi di pagamento, codici prodotto e anagrafica (contatti + clienti registrati) per la ricerca */
export async function loadEditorData(supabase: SupabaseClient) {
	const [{ data: methods }, { data: codes }, { data: contacts }, { data: profiles }] = await Promise.all([
		supabase.from('payment_methods').select('*').eq('active', true).order('sort'),
		supabase.from('product_codes').select('*').eq('active', true).order('sort').order('code'),
		supabase.from('contacts').select('*').order('name').limit(1000),
		supabase.from('profiles').select('id, email, full_name, company_name, vat_number, fiscal_code, sdi_code, pec, phone').eq('role', 'customer').limit(1000)
	]);
	const pickable = [
		...(contacts ?? []).map((c) => ({ id: c.id as string, kind: 'contact' as const, name: c.name as string, first_name: c.first_name ?? '', last_name: c.last_name ?? '', email: c.email ?? '', phone: c.phone ?? '', street: c.street ?? '', city: c.city ?? '', zip: c.zip ?? '', province: c.province ?? '', country: c.country ?? 'IT', vat: c.vat ?? '', fiscal_code: c.fiscal_code ?? '', sdi: c.sdi ?? '', pec: c.pec ?? '' })),
		...(profiles ?? []).map((p) => { const [fn, ...ln] = (p.full_name ?? '').split(' '); return { id: p.id as string, kind: 'profile' as const, name: p.company_name || p.full_name || p.email, first_name: fn ?? '', last_name: ln.join(' '), email: p.email ?? '', phone: p.phone ?? '', street: '', city: '', zip: '', province: '', country: 'IT', vat: p.vat_number ?? '', fiscal_code: p.fiscal_code ?? '', sdi: p.sdi_code ?? '', pec: p.pec ?? '' }; })
	];
	return { methods: (methods ?? []) as PaymentMethod[], codes: (codes ?? []) as ProductCode[], contacts: pickable };
}
