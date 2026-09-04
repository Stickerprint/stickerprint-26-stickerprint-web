/** Bozza di ordine usata dall'editor (nuovo ordine e modifica): condivisa tra browser e server. */
import { CATS, categoryFromCode, SHIPPING_METHODS, itemMeta, type OrderGroup } from './orders';
import { computeTerms, type PaymentMethod } from './payments';

export interface DraftItem { id: string | null; number: string | null; code: string; description: string; qty: number; price: number; lamination: string; mockup_url: string | null; preview_url?: string | null }
export interface DraftTerm { method_id: string; method: string; xml_code: string; due: string; amount: number }
export interface DraftCustomer { name: string; first_name: string; last_name: string; address: string; city: string; cap: string; province: string; country: string; piva: string; cf: string; sdi: string; pec: string; email: string; phone: string }
export interface DraftShipping { name: string; address: string; city: string; cap: string; province: string; country: string }
export interface OrderDraft {
	customer: DraftCustomer; ship_same: boolean; shipping: DraftShipping; contact_id: string | null;
	date: string; ship_date: string; ship_method: string; notes: string; price_type: 'netti' | 'lordi';
	items: DraftItem[]; terms: DraftTerm[];
}
export interface ProductCode { id: string; code: string; name: string; category: string; description: string | null; unit_net: number | null; active: boolean; sort: number }

export const VAT = 1.22;
export const r2 = (v: number) => Math.round(v * 100) / 100;
export const today = () => new Date().toISOString().slice(0, 10);

export const emptyCustomer = (): DraftCustomer => ({ name: '', first_name: '', last_name: '', address: '', city: '', cap: '', province: '', country: 'IT', piva: '', cf: '', sdi: '', pec: '', email: '', phone: '' });
export const emptyItem = (): DraftItem => ({ id: null, number: null, code: '', description: '', qty: 100, price: 0.35, lamination: 'nessuna', mockup_url: null });
export function emptyDraft(): OrderDraft {
	return { customer: emptyCustomer(), ship_same: true, shipping: { name: '', address: '', city: '', cap: '', province: '', country: 'IT' }, contact_id: null, date: today(), ship_date: '', ship_method: SHIPPING_METHODS[0], notes: '', price_type: 'netti', items: [emptyItem()], terms: [] };
}

/** Bozza a partire da un ordine esistente (e-commerce o manuale) */
export function draftFromGroup(g: OrderGroup, methods: PaymentMethod[]): OrderDraft {
	const f = g.items[0];
	const b = f.billing ?? {}; const s = f.shipping ?? {};
	const sameShip = !f.shipping || JSON.stringify({ a: s.street, c: s.city, z: s.zip }) === JSON.stringify({ a: b.street, c: b.city, z: b.zip });
	const lordi = f.price_type === 'lordi';
	const byName = new Map(methods.map((m) => [m.name, m]));
	const terms: DraftTerm[] = (f.payment_terms ?? []).map((t) => { const m = byName.get(t.method); return { method_id: m?.id ?? '', method: t.method, xml_code: t.xml_code ?? m?.xml_code ?? 'MP05', due: t.due, amount: Number(t.amount) }; });
	return {
		customer: { name: f.customer_name || b.company || [b.first_name, b.last_name].filter(Boolean).join(' ') || g.customer, first_name: b.first_name ?? '', last_name: b.last_name ?? '', address: [b.street, b.street2].filter(Boolean).join(', '), city: b.city ?? '', cap: b.zip ?? '', province: b.province ?? '', country: b.country ?? f.country ?? 'IT', piva: b.vat ?? '', cf: b.fiscal_code ?? '', sdi: b.sdi ?? '', pec: b.pec ?? '', email: f.email ?? '', phone: b.phone ?? s.phone ?? '' },
		ship_same: sameShip, shipping: { name: s.company || [s.first_name, s.last_name].filter(Boolean).join(' '), address: [s.street, s.street2].filter(Boolean).join(', '), city: s.city ?? '', cap: s.zip ?? '', province: s.province ?? '', country: s.country ?? 'IT' },
		contact_id: f.contact_id ?? null, date: f.created_at.slice(0, 10), ship_date: f.delivery_date ?? '', ship_method: f.shipping_method ?? SHIPPING_METHODS[0], notes: f.internal_notes ?? '', price_type: lordi ? 'lordi' : 'netti',
		items: g.items.map((i) => { const unitNet = Number(i.unit_net ?? Number(i.total_net) / i.qty); return { id: i.id, number: i.number, code: i.product_code ?? (CATS[i.product_slug]?.code ?? ''), description: i.description || itemMeta(i) || i.product_name, qty: i.qty, price: Math.round((lordi ? unitNet * VAT : unitNet) * 10000) / 10000, lamination: i.lamination ?? (i.finitura && i.finitura !== 'nessuna' ? i.finitura : 'nessuna'), mockup_url: i.mockup_url, preview_url: i.proof_url ?? i.preview_url }; }),
		terms
	};
}

export function draftTotals(d: Pick<OrderDraft, 'items' | 'price_type'>) {
	const inserted = d.items.reduce((s, i) => s + Number(i.qty || 0) * Number(i.price || 0), 0);
	const lordi = d.price_type === 'lordi';
	const net = lordi ? inserted / VAT : inserted;
	return { qty: d.items.reduce((s, i) => s + Number(i.qty || 0), 0), net: r2(net), iva: r2(lordi ? inserted - net : inserted * (VAT - 1)), tot: r2(lordi ? inserted : inserted * VAT) };
}
/** Categoria di produzione dal codice: prima i codici salvati, poi il prefisso */
export function categoryOf(code: string, codes: ProductCode[]): string | null {
	const c = (code ?? '').trim().toUpperCase();
	const exact = codes.find((p) => p.code.toUpperCase() === c);
	if (exact) return exact.category;
	const pref = codes.filter((p) => c.startsWith(p.code.toUpperCase())).sort((a, b) => b.code.length - a.code.length)[0];
	return pref?.category ?? categoryFromCode(c);
}
/** Ripartisce il totale in parti uguali sulle rate (l'ultima assorbe gli arrotondamenti) */
export function splitAmounts(terms: DraftTerm[], total: number): DraftTerm[] {
	const n = terms.length; if (!n) return terms;
	const each = r2(total / n);
	return terms.map((t, i) => ({ ...t, amount: i === n - 1 ? r2(total - each * (n - 1)) : each }));
}
/** Rate iniziali per un metodo di pagamento (es. 30/60 gg f.m. → due righe) */
export function termsForMethod(m: PaymentMethod, total: number, date: string): DraftTerm[] {
	if (m.custom) return [{ method_id: m.id, method: m.name, xml_code: m.xml_code, due: date, amount: r2(total) }];
	return computeTerms(m, total, date).map((t) => ({ method_id: m.id, method: m.name, xml_code: m.xml_code, due: t.due, amount: t.amount }));
}
