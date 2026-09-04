import { fail, redirect } from '@sveltejs/kit';
import { CATS, categoryFromCode, PAYMENT_METHODS_MANUALI, SHIPPING_METHODS } from '$lib/dashboard/orders';
import type { Actions } from './$types';

const VAT = 1.22;
const r2 = (v: number) => Math.round(v * 100) / 100;
interface Item { code: string; description: string; qty: number; price: number; lamination: string; mockup_url: string | null }

export const actions: Actions = {
	default: async ({ request, locals: { supabase } }) => {
		const f = await request.formData();
		const s = (k: string) => String(f.get(k) ?? '').trim();
		let items: Item[];
		try {
			items = JSON.parse(String(f.get('items') ?? '[]'));
		} catch {
			return fail(400, { error: 'Articoli non leggibili.' });
		}
		const name = s('name');
		if (!name) return fail(400, { error: 'Inserisci almeno il nome del cliente.' });
		items = items.filter((i) => i && (i.code || i.description) && Number(i.qty) > 0);
		if (!items.length) return fail(400, { error: 'Aggiungi almeno un articolo.' });
		const lordi = s('price_type') === 'lordi';
		const sameShip = f.get('ship_same') !== 'off';
		const billing = { company: name, first_name: s('first_name'), last_name: s('last_name'), street: s('address'), city: s('city'), zip: s('cap'), province: s('province').toUpperCase().slice(0, 2), country: s('country') || 'IT', vat: s('piva'), fiscal_code: s('cf'), sdi: s('sdi'), pec: s('pec'), phone: s('phone') };
		const shipping = sameShip ? { ...billing } : { company: s('ship_name'), first_name: '', last_name: '', street: s('ship_address'), city: s('ship_city'), zip: s('ship_cap'), province: s('ship_province').toUpperCase().slice(0, 2), country: s('ship_country') || 'IT', phone: s('phone') };
		const group = crypto.randomUUID();
		const createdAt = s('date') ? new Date(s('date') + 'T10:00:00').toISOString() : new Date().toISOString();
		const payment = s('payment') || PAYMENT_METHODS_MANUALI[0];
		const numbers: string[] = [];
		for (const it of items) {
			const { data: num, error: ne } = await supabase.rpc('next_order_number');
			if (ne || !num) return fail(400, { error: 'Numero d’ordine non disponibile.' });
			const slug = categoryFromCode(it.code) ?? 'adesivi_personalizzati';
			const unitNet = lordi ? Number(it.price) / VAT : Number(it.price);
			const net = r2(unitNet * Number(it.qty));
			const row = {
				user_id: null, number: num as string, checkout_group: group, channel: 'manuale',
				product_slug: slug, product_name: CATS[slug]?.name ?? slug, product_code: (it.code || '').toUpperCase().slice(0, 8) || null, description: it.description || null,
				qty: Number(it.qty), unit_net: Math.round(unitNet * 10000) / 10000, total_net: net, total_gross: r2(net * VAT), price_type: lordi ? 'lordi' : 'netti',
				lamination: it.lamination || null, mockup_url: it.mockup_url || null,
				status: 'in_produzione', prod_stage: 'stampa',
				customer_name: name, email: s('email') || null, country: billing.country, shipping, billing,
				payment_method: payment, payment_status: payment === 'Bonifico anticipato' ? 'paid' : 'pending',
				shipping_method: s('ship_method') || SHIPPING_METHODS[0], delivery_date: s('ship_date') || null,
				internal_notes: s('notes') || null, created_at: createdAt
			};
			const { error } = await supabase.from('orders').insert(row);
			if (error) return fail(400, { error: `Ordine non salvato: ${error.message}` });
			numbers.push(row.number);
		}
		redirect(303, `/dashboard/fatturazione/ordini/${group}?creato=${numbers[0]}`);
	}
};
