import type { SupabaseClient } from '@supabase/supabase-js';

export interface Customer {
	id: string | null; // profilo o contatto; null = ospite (solo email)
	kind: 'profile' | 'contact' | 'guest';
	email: string; name: string; company: string | null; vat: string | null; phone: string | null;
	type: 'azienda' | 'privato' | 'ospite'; level: string; levelName: string;
	orders: number; spent: number; avg: number; lastOrder: string | null; since: string | null;
}

/** Anagrafica: profili registrati + contatti inseriti a mano + ospiti ricavati dagli ordini, con statistiche e livello fedeltà */
export async function loadCustomers(supabase: SupabaseClient): Promise<Customer[]> {
	const [{ data: profiles }, { data: loyalty }, { data: levels }, { data: orders }, { data: contacts }] = await Promise.all([
		supabase.from('profiles').select('id, email, full_name, company_name, vat_number, phone, customer_type, role, created_at'),
		supabase.from('loyalty').select('user_id, level'),
		supabase.from('loyalty_levels').select('level, name'),
		supabase.from('orders').select('user_id, contact_id, email, total_net, status, created_at, billing').neq('status', 'annullato'),
		supabase.from('contacts').select('*')
	]);
	const levelName = new Map((levels ?? []).map((l) => [l.level, l.name]));
	const lvl = new Map((loyalty ?? []).map((l) => [l.user_id, l.level]));
	const stats = new Map<string, { n: number; spent: number; last: string | null }>();
	const add = (key: string, o: { total_net: number; created_at: string }) => {
		const s = stats.get(key) ?? { n: 0, spent: 0, last: null };
		s.n++; s.spent += Number(o.total_net); if (!s.last || o.created_at > s.last) s.last = o.created_at; stats.set(key, s);
	};
	const merge = (...keys: string[]) => { const out = { n: 0, spent: 0, last: null as string | null }; for (const k of keys) { const s = stats.get(k); if (!s) continue; out.n += s.n; out.spent += s.spent; if (!out.last || (s.last && s.last > out.last)) out.last = s.last; } return out; };
	const guests = new Map<string, { email: string; name: string; company: string | null; vat: string | null }>();
	for (const o of orders ?? []) {
		if (o.user_id) add(o.user_id, o);
		else if (o.contact_id) add('contact:' + o.contact_id, o);
		else if (o.email) {
			const e = o.email.toLowerCase(); add('guest:' + e, o);
			const b = (o.billing ?? {}) as Record<string, string>;
			if (!guests.has(e)) guests.set(e, { email: e, name: b.company || [b.first_name, b.last_name].filter(Boolean).join(' ') || e, company: b.company || null, vat: b.vat || null });
		}
	}
	const out: Customer[] = [];
	const profileEmails = new Set<string>();
	for (const p of profiles ?? []) {
		if (p.role !== 'customer') continue;
		profileEmails.add((p.email ?? '').toLowerCase());
		const s = merge(p.id, 'guest:' + (p.email ?? '').toLowerCase());
		const level = lvl.get(p.id) ?? 'creator';
		const type = p.customer_type === 'azienda' || p.vat_number ? 'azienda' : 'privato';
		out.push({ id: p.id, kind: 'profile', email: p.email, name: p.full_name || p.email, company: p.company_name, vat: p.vat_number, phone: p.phone, type, level, levelName: levelName.get(level) ?? level, orders: s.n, spent: s.spent, avg: s.n ? s.spent / s.n : 0, lastOrder: s.last, since: p.created_at });
	}
	const contactEmails = new Set<string>();
	for (const c of contacts ?? []) {
		const e = (c.email ?? '').toLowerCase();
		if (e) contactEmails.add(e);
		if (e && profileEmails.has(e)) continue; // già in anagrafica come profilo registrato
		const s = merge('contact:' + c.id, e ? 'guest:' + e : '');
		out.push({ id: c.id, kind: 'contact', email: c.email ?? '', name: c.name, company: c.kind === 'azienda' ? c.name : null, vat: c.vat, phone: c.phone, type: c.kind === 'azienda' || c.vat ? 'azienda' : 'privato', level: 'nessuno', levelName: 'Anagrafica', orders: s.n, spent: s.spent, avg: s.n ? s.spent / s.n : 0, lastOrder: s.last, since: c.created_at });
	}
	for (const g of guests.values()) {
		if (profileEmails.has(g.email) || contactEmails.has(g.email)) continue;
		const s = stats.get('guest:' + g.email)!;
		out.push({ id: null, kind: 'guest', email: g.email, name: g.name, company: g.company, vat: g.vat, phone: null, type: 'ospite', level: 'nessuno', levelName: 'Non registrato', orders: s.n, spent: s.spent, avg: s.n ? s.spent / s.n : 0, lastOrder: s.last, since: null });
	}
	return out.sort((a, b) => b.spent - a.spent);
}
