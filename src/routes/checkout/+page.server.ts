import { fail } from '@sveltejs/kit';
import { loadEngine } from '$lib/server/pricing';
import { quoteWith, PRODUCT_ENGINES } from '$lib/pricing/engine';
import { checkDiscount } from '$lib/server/discount';
import { estimatedShipDate, formatItDate } from '$lib/utils/shipping';
import type { Actions, PageServerLoad } from './$types';

/** Supplemento produzione express (imponibile): spediamo 2 giorni prima. Modificabile qui. */
export const EXPRESS_NET = 15;
const VAT = 1.22;

export const load: PageServerLoad = async ({ locals: { supabase, user } }) => {
	const ship = estimatedShipDate(5);
	const base = { shipDate: formatItDate(ship), expressDate: formatItDate(estimatedShipDate(3)), expressNet: EXPRESS_NET };
	if (!user) return { ...base, profile: null, addresses: [], credit: 0, loyalty: null };
	const [{ data: profile }, { data: addresses }, { data: credit }, { data: loyalty }] = await Promise.all([
		supabase.from('profiles').select('full_name, email, phone, company_name, vat_number, fiscal_code, sdi_code').eq('id', user.id).maybeSingle(),
		supabase.from('addresses').select('*').eq('user_id', user.id).order('is_default', { ascending: false }),
		supabase.rpc('my_credit_balance'),
		supabase.rpc('loyalty_status')
	]);
	return { ...base, profile, addresses: addresses ?? [], credit: Number(credit ?? 0), loyalty };
};

interface Line { id: string; product: string; forma: string; materiale: string; finitura?: string; w: number; h: number; qty: number; filePath: string | null; fileName: string | null; note?: string; reorderOf?: string | null }

export const actions: Actions = {
	order: async ({ request, locals: { supabase, user } }) => {
		if (!user) return fail(401, { error: 'Accedi per completare l’ordine.' });
		const f = await request.formData();
		const s = (k: string) => String(f.get(k) ?? '').trim();
		let lines: Line[];
		try {
			lines = JSON.parse(String(f.get('items') ?? '[]'));
		} catch {
			return fail(400, { error: 'Carrello non leggibile.' });
		}
		if (!lines.length) return fail(400, { error: 'Il carrello è vuoto.' });
		if (lines.some((l) => !l.filePath)) return fail(400, { error: 'Manca il file di un prodotto: caricalo per continuare.' });

		// dati di spedizione
		const ship = { first_name: s('first_name'), last_name: s('last_name'), street: s('street'), street2: s('street2'), city: s('city'), zip: s('zip'), province: s('province'), country: 'IT', phone: s('phone') };
		if (!ship.first_name || !ship.last_name || !ship.street || !ship.city || !ship.zip || !ship.province || !ship.phone) return fail(400, { error: 'Compila tutti i dati di spedizione obbligatori.' });
		const fiscal = { fiscal_code: s('fiscal_code'), company: s('company'), vat: s('vat'), sdi: s('sdi') };
		if (!fiscal.fiscal_code && !fiscal.vat) return fail(400, { error: 'Inserisci il codice fiscale (o la partita IVA).' });
		const sameBilling = f.get('same_billing') !== 'off';
		const bill = sameBilling ? { ...ship, ...fiscal } : { first_name: s('b_first_name'), last_name: s('b_last_name'), street: s('b_street'), street2: s('b_street2'), city: s('b_city'), zip: s('b_zip'), province: s('b_province'), country: 'IT', ...fiscal };
		if (!sameBilling && (!bill.street || !bill.city || !bill.zip || !bill.province)) return fail(400, { error: 'Compila l’indirizzo di fatturazione.' });
		const payment = s('payment') || 'test';
		if (payment !== 'test') return fail(400, { error: 'Questo metodo di pagamento sarà disponibile a breve. Per ora usa "Test".' });
		const express = f.get('express') === 'on';
		const useCredit = f.get('use_credit') === 'on';

		// prezzi ricalcolati dal listino (mai fidarsi del browser)
		const engines: Record<string, Awaited<ReturnType<typeof loadEngine>>['config']> = {};
		const priced = [];
		for (const l of lines) {
			engines[l.product] ??= (await loadEngine(supabase, l.product)).config;
			const q = quoteWith(engines[l.product], { w: Number(l.w), h: Number(l.h), forma: l.forma, materiale: l.materiale, finitura: l.finitura ?? 'nessuna', qty: Number(l.qty), vatIncluded: true });
			priced.push({ ...l, net: q.net, gross: q.gross });
		}
		const subtotalNet = priced.reduce((a, l) => a + l.net, 0);
		let discount = 0;
		let discountCode: string | null = null;
		if (s('discount_code')) {
			const d = await checkDiscount(supabase, s('discount_code'), subtotalNet);
			if (!d.ok) return fail(400, { error: d.error });
			discount = d.amount;
			discountCode = d.code;
		}
		const expressNet = express ? EXPRESS_NET : 0;
		const totalNet = Math.max(0, subtotalNet - discount) + expressNet;
		const totalGross = Math.round(totalNet * VAT * 100) / 100;
		let creditUsed = 0;
		if (useCredit) {
			const { data: bal } = await supabase.rpc('my_credit_balance');
			creditUsed = Math.min(Number(bal ?? 0), totalGross);
			creditUsed = Math.round(creditUsed * 100) / 100;
		}
		const toPay = Math.round((totalGross - creditUsed) * 100) / 100;

		// ordini: una riga per prodotto
		const group = crypto.randomUUID();
		const numbers: string[] = [];
		for (const [i, l] of priced.entries()) {
			const { data: num } = await supabase.rpc('next_order_number');
			const share = subtotalNet > 0 ? l.net / subtotalNet : 1 / priced.length;
			const row = {
				user_id: user.id,
				number: num as string,
				product_slug: l.product,
				product_name: PRODUCT_ENGINES.find((p) => p.slug === l.product)?.name ?? l.product,
				forma: l.forma, materiale: l.materiale, finitura: l.finitura ?? null,
				width_mm: l.w, height_mm: l.h, qty: l.qty,
				total_net: l.net, total_gross: l.gross,
				status: 'in_attesa',
				file_path: l.filePath?.startsWith('riordino:') ? null : l.filePath,
				notes: [l.reorderOf ? `Riordino di ${l.reorderOf}` : '', l.note ?? ''].filter(Boolean).join(' · ') || null,
				email: user.email, shipping: ship, billing: bill,
				payment_method: payment, payment_status: payment === 'test' ? 'test' : 'pending',
				discount_code: discountCode, discount_amount: Math.round(discount * share * 100) / 100,
				credit_used: Math.round(creditUsed * share * 100) / 100,
				express, checkout_group: group,
				total_paid: Math.round((i === 0 ? toPay : 0) * 100) / 100
			};
			const { error } = await supabase.from('orders').insert(row);
			if (error) return fail(400, { error: `Ordine non registrato: ${error.message}` });
			numbers.push(row.number);
		}
		if (creditUsed > 0) {
			await supabase.from('credit_transactions').insert({ user_id: user.id, amount: -creditUsed, kind: 'spend', order_ref: numbers[0], note: `Credito usato sull'ordine ${numbers.join(', ')}` });
		}
		if (discountCode) await supabase.rpc('discount_code_used', { p_code: discountCode });
		// dati anagrafici e indirizzo salvati per la prossima volta
		await supabase.from('profiles').update({ phone: ship.phone, fiscal_code: fiscal.fiscal_code || null, company_name: fiscal.company || null, vat_number: fiscal.vat || null, sdi_code: fiscal.sdi || null, full_name: `${ship.first_name} ${ship.last_name}` }).eq('id', user.id);
		if (f.get('save_address') === 'on') {
			await supabase.from('addresses').update({ is_default: false }).eq('user_id', user.id).eq('kind', 'shipping');
			await supabase.from('addresses').insert({ user_id: user.id, kind: 'shipping', first_name: ship.first_name, last_name: ship.last_name, company: fiscal.company || null, street: [ship.street, ship.street2].filter(Boolean).join(', '), city: ship.city, zip: ship.zip, province: ship.province, country: 'IT', phone: ship.phone, is_default: true });
		}
		return { ok: true, numbers, toPay };
	}
};
