import { fail } from '@sveltejs/kit';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { shippingGrossFor, isRemote } from '$lib/shipping-rules';
import { env } from '$env/dynamic/private';
import { PUBLIC_SUPABASE_URL, PUBLIC_SITE_URL } from '$env/static/public';
import { loadEngine } from '$lib/server/pricing';
import { quoteWith, PRODUCT_ENGINES } from '$lib/pricing/engine';
import { kitQuote, kitN } from '$lib/pricing/kit';
import { checkDiscount } from '$lib/server/discount';
import { normalizeLines, type InvoiceLine } from '$lib/server/invoice';
import { estimatedShipDate, formatItDate } from '$lib/utils/shipping';
import { MATERIAL_LABEL } from '$lib/account';
import { createCheckoutSession, createPaymentIntent, stripeConfigured } from '$lib/server/stripe';
import { env as pub } from '$env/dynamic/public';
import { createPayPalOrder, paypalConfigured } from '$lib/server/paypal';
import { cancelPendingCheckout, expireStaleCheckouts, finalizeCheckout, savePendingCheckout, setCheckoutSession, type CheckoutItem, type CheckoutPayload } from '$lib/server/checkout';
import { ensureCustomer, ownsCard, savedCardsFor, savedCardsOn } from '$lib/server/saved-cards';
import type { Actions, PageServerLoad } from './$types';

/** Produzione express: +30% sui prodotti (concorre al credito) */
const EXPRESS_RATE = 0.3;
/** Kit campioni: prezzo IVA inclusa, spedizione gratuita */
const SAMPLES_GROSS = 10;
const VAT = 1.22;

/** Client con chiave di servizio (ordini degli ospiti): serve SUPABASE_SERVICE_ROLE_KEY su Vercel */
function adminClient(): SupabaseClient | null {
	const key = env.SUPABASE_SERVICE_ROLE_KEY;
	return key ? createClient(PUBLIC_SUPABASE_URL, key, { auth: { persistSession: false } }) : null;
}

export const load: PageServerLoad = async ({ url, locals: { supabase, user } }) => {
	const ship = estimatedShipDate(5);
	/* ritorno da Stripe senza pagare: gli ordini in attesa vengono tolti, il carrello e' ancora nel browser */
	const cancelledGroup = url.searchParams.get('annullato') === '1' ? url.searchParams.get('g') : null;
	if (cancelledGroup && /^[0-9a-f-]{36}$/.test(cancelledGroup)) { const a = adminClient(); if (a) await cancelPendingCheckout(a, cancelledGroup); }
	{ const a = adminClient(); if (a) expireStaleCheckouts(a).catch(() => {}); }
	const base = { shipDate: formatItDate(ship), expressDate: formatItDate(estimatedShipDate(3)), expressRate: EXPRESS_RATE, guestAllowed: !!env.SUPABASE_SERVICE_ROLE_KEY, online: stripeConfigured(), stripeKey: stripeConfigured() ? (pub.PUBLIC_STRIPE_PUBLISHABLE_KEY ?? '') : '', paypal: paypalConfigured(), cancelled: !!cancelledGroup };
	if (!user) return { ...base, profile: null, addresses: [], credit: 0, loyalty: null, orderCount: 0, lifetimeValue: 0, savedCards: [], canSaveCard: false };
	const [{ data: profile }, { data: addresses }, { data: credit }, { data: loyalty }] = await Promise.all([
		supabase.from('profiles').select('full_name, email, phone, company_name, vat_number, fiscal_code, sdi_code').eq('id', user.id).maybeSingle(),
		supabase.from('addresses').select('*').eq('user_id', user.id).order('is_default', { ascending: false }),
		supabase.rpc('my_credit_balance'),
		supabase.rpc('loyalty_status')
	]);
	/* storico per il tracciamento dell'acquisto: cliente nuovo o di ritorno, numero ordini, valore a vita */
	const { data: prev } = await supabase.from('orders').select('checkout_group, total_paid, total_gross').eq('user_id', user.id);
	const groups = new Set((prev ?? []).map((o) => o.checkout_group ?? Math.random()));
	const lifetimeValue = Math.round((prev ?? []).reduce((a, o) => a + Number(o.total_paid ?? o.total_gross ?? 0), 0) * 100) / 100;
	/* carte salvate dell'account (solo marca, ultime 4 cifre e scadenza: il resto sta su Stripe) */
	const savedCards = savedCardsOn() ? await savedCardsFor(user.id) : [];
	return { ...base, profile, addresses: addresses ?? [], credit: Number(credit ?? 0), loyalty, orderCount: groups.size, lifetimeValue, savedCards, canSaveCard: savedCardsOn() };
};

interface Line { id: string; product: string; forma: string; materiale: string; finitura?: string; w: number; h: number; qty: number; filePath: string | null; fileName: string | null; previewUrl?: string | null; note?: string; reorderOf?: string | null }
/** Tutti i prodotti hanno l'anteprima automatica: il file generato dal configuratore e' quello confermato dal cliente, si va dritti in produzione */
const AUTO_PROOF = new Set(['adesivi_personalizzati', 'adesivi_resinati', 'etichette', 'campioni', 'adesivi_rilievo', 'fogli', 'vetrofanie', 'kit_adesivi']);
function deviceFrom(ua: string): 'mobile' | 'tablet' | 'desktop' {
	if (/iPad|Tablet|PlayBook|Silk/i.test(ua) || (/Android/i.test(ua) && !/Mobile/i.test(ua))) return 'tablet';
	if (/Mobi|iPhone|Android|Windows Phone/i.test(ua)) return 'mobile';
	return 'desktop';
}
const r2 = (v: number) => Math.round(v * 100) / 100;

export const actions: Actions = {
	order: async ({ request, url, locals: { supabase, user } }) => {
		const ua = request.headers.get('user-agent') ?? '';
		const device = deviceFrom(ua);
		const admin = adminClient();
		if (!user && !admin) return fail(401, { error: 'Accedi o registrati per completare l’ordine.' });
		const db = user ? supabase : admin!; // ospite: chiave di servizio
		const f = await request.formData();
		const s = (k: string) => String(f.get(k) ?? '').trim();
		let lines: Line[];
		try {
			lines = JSON.parse(String(f.get('items') ?? '[]'));
		} catch {
			return fail(400, { error: 'Carrello non leggibile.' });
		}
		if (!lines.length) return fail(400, { error: 'Il carrello è vuoto.' });
		if (lines.some((l) => !l.filePath && l.product !== 'campioni')) return fail(400, { error: 'Manca il file di un prodotto: caricalo per continuare.' });

		const email = (user?.email ?? s('email')).toLowerCase();
		if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return fail(400, { error: 'Inserisci un indirizzo email valido.' });
		const ship = { first_name: s('first_name'), last_name: s('last_name'), street: s('street'), street2: s('street2'), city: s('city'), zip: s('zip'), province: s('province'), country: 'IT', phone: s('phone') };
		if (!ship.first_name || !ship.last_name || !ship.street || !ship.city || !ship.zip || !ship.province || !ship.phone) return fail(400, { error: 'Compila tutti i dati di spedizione obbligatori.' });
		const fiscal = { fiscal_code: s('fiscal_code'), company: s('company'), vat: s('vat'), sdi: s('sdi') };
		if (!fiscal.fiscal_code && !fiscal.vat) return fail(400, { error: 'Inserisci il codice fiscale (o la partita IVA).' });
		const sameBilling = f.get('same_billing') !== 'off';
		const bill = sameBilling ? { ...ship, ...fiscal } : { first_name: s('b_first_name'), last_name: s('b_last_name'), street: s('b_street'), street2: s('b_street2'), city: s('b_city'), zip: s('b_zip'), province: s('b_province'), country: 'IT', phone: ship.phone, ...fiscal };
		if (!sameBilling && (!bill.street || !bill.city || !bill.zip || !bill.province)) return fail(400, { error: 'Compila l’indirizzo di fatturazione.' });
		const payment = s('payment') || (stripeConfigured() ? 'stripe' : 'test');
		const inline = (payment === 'card' || payment === 'wallet') && stripeConfigured() && !!pub.PUBLIC_STRIPE_PUBLISHABLE_KEY; // carta o wallet inseriti sul sito
		const online = payment === 'stripe' || payment === 'paypal' || inline;
		const viaPayPal = payment === 'paypal' && paypalConfigured();
		if (online && !stripeConfigured() && !viaPayPal) return fail(400, { error: 'Il pagamento online non è ancora attivo. Per ora usa "Test".' });
		if (!online && payment !== 'test') return fail(400, { error: 'Metodo di pagamento non valido.' });
		if (payment === 'test' && (stripeConfigured() || paypalConfigured())) return fail(400, { error: 'L’ordine di prova non è più disponibile: scegli un metodo di pagamento.' });
		if (online && !admin) return fail(400, { error: 'Pagamento online non disponibile in questo momento.' });
		const express = f.get('express') === 'on';
		const useCredit = !!user && f.get('use_credit') === 'on';

		// prezzi ricalcolati dal listino (mai fidarsi del browser); l'express (+30%) entra nel prezzo del prodotto
		const engines: Record<string, Awaited<ReturnType<typeof loadEngine>>['config']> = {};
		const priced: ((typeof lines)[number] & { baseNet: number; net: number; gross: number; expressNet: number })[] = [];
		for (const l of lines) {
			if (l.product === 'campioni') {
				// kit campioni: prezzo fisso 10 € IVA inclusa, niente file, niente express
				const baseNet = r2(SAMPLES_GROSS / VAT);
				priced.push({ ...l, qty: 1, baseNet, net: baseNet, gross: SAMPLES_GROSS, expressNet: 0 });
				continue;
			}
			let baseNet: number;
			if (l.product === 'kit_adesivi') {
				/* kit di adesivi: prezzo dal listino degli adesivi personalizzati + costi fissi del kit (vedi pricing/kit.ts) */
				engines.adesivi_personalizzati ??= (await loadEngine(supabase, 'adesivi_personalizzati')).config;
				baseNet = kitQuote(engines.adesivi_personalizzati, { materiale: l.materiale, finitura: l.finitura ?? 'lucida', misura: Number(l.w), n: kitN(l.forma), qty: Number(l.qty) }).net;
			} else {
				engines[l.product] ??= (await loadEngine(supabase, l.product)).config;
				const q = quoteWith(engines[l.product], { w: Number(l.w), h: Number(l.h), forma: l.forma, materiale: l.materiale, finitura: l.finitura ?? 'nessuna', qty: Number(l.qty), vatIncluded: true });
				baseNet = q.net;
			}
			// offerta: prezzo promo se l'offerta e' ancora attiva e quantita' e misura sono quelle dell'offerta
			const promoId = String((l as { promoId?: string }).promoId ?? '');
			if (promoId) {
				const { data: pr } = await supabase.from('promos').select('*').eq('id', promoId).eq('active', true).maybeSingle();
				if (pr && pr.product_slug === l.product && Number(pr.qty) === Number(l.qty) && (!pr.ends_at || new Date(pr.ends_at).getTime() > Date.now())) {
					const sizes = Array.isArray(pr.sizes) ? (pr.sizes as { w: number; h?: number; price: number }[]) : [];
					const hit = sizes.find((s) => Math.abs(Number(s.w) - Number(l.w)) < 0.6 && Math.abs(Number(s.h ?? s.w) - Number(l.h)) < 0.6);
					const gross = hit ? Number(hit.price) : sizes.length ? NaN : Number(pr.price);
					if (Number.isFinite(gross) && gross > 0) baseNet = r2(gross / VAT);
				}
			}
			const net = r2(express ? baseNet * (1 + EXPRESS_RATE) : baseNet);
			priced.push({ ...l, baseNet, net, gross: r2(net * VAT), expressNet: r2(net - baseNet) });
		}
		const productsNet = r2(priced.reduce((a, l) => a + l.baseNet, 0));
		const expressNet = r2(priced.reduce((a, l) => a + l.expressNet, 0));
		let discount = 0;
		let discountCode: string | null = null;
		if (s('discount_code')) {
			const d = await checkDiscount(supabase, s('discount_code'), productsNet, email);
			if (!d.ok) return fail(400, { error: d.error });
			discount = d.amount;
			discountCode = d.code;
		}
		/* spedizione: gratuita da 50 € di prodotti IVA inclusa (dopo lo sconto), altrimenti 10 €; il kit campioni da solo viaggia gratis */
		const shippingGross = shippingGrossFor(r2(Math.max(0, productsNet - discount) * VAT), priced.every((l) => l.product === 'campioni'), ship.province);
		const shippingNet = r2(shippingGross / VAT);
		const taxable = r2(Math.max(0, productsNet + expressNet + shippingNet - discount));
		const vatAmount = r2(taxable * (VAT - 1));
		const totalGross = r2(taxable + vatAmount);
		let creditUsed = 0;
		if (useCredit) {
			const { data: bal } = await supabase.rpc('my_credit_balance');
			creditUsed = r2(Math.min(Number(bal ?? 0), totalGross));
		}
		const toPay = r2(totalGross - creditUsed);

		// ordini: UN numero per tutto il carrello, una riga per prodotto (stesso numero, stesso gruppo).
		// Con pagamento online le righe nascono "in attesa di pagamento" e si chiudono all'incasso (finalizeCheckout).
		const group = crypto.randomUUID();
		const numbers: string[] = [];
		const invLines: InvoiceLine[] = [];
		const items: CheckoutItem[] = [];
		const autoProof: boolean[] = [];
		const { data: num0, error: ne0 } = await db.rpc('next_order_number');
		if (ne0 || !num0) return fail(400, { error: 'Numero d’ordine non disponibile, riprova.' });
		let num = num0 as string;
		for (const l of priced) {
			const share = productsNet > 0 ? l.baseNet / productsNet : 1 / priced.length;
			const name = l.product === 'campioni' ? 'Kit campioni' : l.product === 'kit_adesivi' ? 'Kit di adesivi' : (PRODUCT_ENGINES.find((p) => p.slug === l.product)?.name ?? l.product);
			const auto = AUTO_PROOF.has(l.product);
			const row = {
				user_id: user?.id ?? null, number: num,
				product_slug: l.product, product_name: name,
				forma: l.forma, materiale: l.materiale, finitura: l.finitura ?? null,
				width_mm: l.w, height_mm: l.h, qty: l.qty,
				total_net: l.net, total_gross: l.gross,
				status: online ? 'attesa_pagamento' : 'in_produzione',
				prod_stage: !online && l.product !== 'campioni' ? 'stampa' : null,
				auto_proof: auto,
				preview_url: l.previewUrl ?? null, proof_url: l.previewUrl ?? null,
				device, user_agent: ua.slice(0, 500),
				file_path: l.filePath?.startsWith('riordino:') || l.filePath === 'campioni' ? null : l.filePath,
				notes: [l.reorderOf ? `Riordino di ${l.reorderOf}` : '', l.note ?? ''].filter(Boolean).join(' · ') || null,
				email, shipping: ship, billing: bill,
				payment_method: payment === 'card' ? 'stripe' : payment, payment_status: online ? 'pending' : 'test',
				discount_code: discountCode, discount_amount: r2(discount * share),
				credit_used: r2(creditUsed * share), express, checkout_group: group,
				total_paid: r2(toPay * share)
			};
			let { error } = await db.from('orders').insert(row);
			/* finche' il vincolo di unicita' sul numero non e' tolto (migrazione 0031) la seconda riga
			   riceve un numero suo: l'ordine passa comunque */
			if (error && error.code === '23505') {
				const { data: n2 } = await db.rpc('next_order_number');
				if (n2) { row.number = n2 as string; num = row.number; ({ error } = await db.from('orders').insert(row)); }
			}
			if (error) return fail(400, { error: `Ordine non registrato: ${error.message}` });
			if (!numbers.includes(row.number)) numbers.push(row.number);
			invLines.push({ description: l.product === 'campioni' ? `Kit campioni` : l.product === 'kit_adesivi' ? `Kit di adesivi (${kitN(l.forma)} adesivi da ${l.w} mm, ${MATERIAL_LABEL[l.materiale] ?? l.materiale}${l.finitura && l.finitura !== 'nessuna' ? ', lamina ' + l.finitura : ''})` : `${name} ${l.forma} ${MATERIAL_LABEL[l.materiale] ?? l.materiale}${l.finitura && l.finitura !== 'nessuna' ? ' lamina ' + l.finitura : ''} ${l.w}×${l.h} mm`, qty: l.qty, unit_net: r2(l.baseNet / l.qty), total_net: l.baseNet });
			items.push({ product: l.product, productName: name, forma: l.forma, materiale: l.materiale, finitura: l.finitura ?? null, w: l.w, h: l.h, qty: Number(l.qty), gross: l.gross, previewUrl: l.previewUrl ?? null });
			autoProof.push(auto);
		}
		const invoiceLines = normalizeLines(invLines, discount, creditUsed);
		if (shippingNet > 0) invoiceLines.push({ description: isRemote(ship.province) ? 'Spedizione (isole e zone remote)' : 'Spedizione', qty: 1, unit_net: shippingNet, total_net: shippingNet });
		const payload: CheckoutPayload = { userId: user?.id ?? null, email, firstName: ship.first_name, lastName: ship.last_name, payment: payment === 'card' ? 'stripe' : payment, ship, bill, numbers, invoiceLines, emailLines: invLines, items, productsNet, expressNet, discount, discountCode, creditUsed, vatAmount, totalGross, toPay, express, autoProof };
		const fdb = admin ?? db;
		const se = await savePendingCheckout(fdb, group, payload, viaPayPal ? 'paypal' : online ? 'stripe' : 'test');
		if (se) return fail(400, { error: `Ordine non registrato: ${se}` });
		// scadenza unica, anticipata: pagata online (o subito, con l'ordine di prova)
		await fdb.from('order_payments').insert({ checkout_group: group, seq: 1, method: ({ paypal: 'PayPal', stripe: 'Carta di credito (Stripe)', card: 'Carta di credito (Stripe)', wallet: 'Apple Pay / Google Pay (Stripe)' } as Record<string, string>)[payment] ?? 'Test', due: new Date().toISOString().slice(0, 10), amount: toPay, upfront: true, status: 'da_pagare' });

		// dati salvati per la prossima volta
		if (user) {
			await supabase.from('profiles').update({ phone: ship.phone, fiscal_code: fiscal.fiscal_code || null, company_name: fiscal.company || null, vat_number: fiscal.vat || null, sdi_code: fiscal.sdi || null, full_name: `${ship.first_name} ${ship.last_name}` }).eq('id', user.id);
			if (f.get('save_address') === 'on') {
				await supabase.from('addresses').update({ is_default: false }).eq('user_id', user.id).eq('kind', 'shipping');
				await supabase.from('addresses').insert({ user_id: user.id, kind: 'shipping', first_name: ship.first_name, last_name: ship.last_name, company: fiscal.company || null, street: [ship.street, ship.street2].filter(Boolean).join(', '), city: ship.city, zip: ship.zip, province: ship.province, country: 'IT', phone: ship.phone, is_default: true });
			}
		}

		if (inline) {
			// carta o wallet direttamente nella pagina: il browser conferma il PaymentIntent, la pagina Grazie (o il webhook) chiude l'ordine
			try {
				/* cliente registrato che paga con carta: carta gia' salvata (verificata: deve essere sua) oppure carta nuova da salvare */
				let customer: string | null = null, paymentMethod: string | null = null;
				const savedPm = s('saved_pm'), saveCard = f.get('save_card') === 'on';
				if (user && payment === 'card' && savedCardsOn()) {
					if (savedPm) {
						customer = await ownsCard(user.id, savedPm);
						if (!customer) { await cancelPendingCheckout(fdb, group); return fail(400, { error: 'La carta salvata non è più disponibile: inseriscine una nuova.' }); }
						paymentMethod = savedPm;
					} else if (saveCard) {
						customer = await ensureCustomer({ id: user.id, email, name: `${ship.first_name} ${ship.last_name}`.trim() });
					}
				}
				const pi = await createPaymentIntent({ amountCents: Math.round(toPay * 100), description: `Ordine ${numbers.join(', ')} · Stickerprint`, email, orderNumber: numbers[0], group, seq: 1, customer, saveCard: saveCard && !paymentMethod, paymentMethod });
				await setCheckoutSession(fdb, group, pi.id);
				return { ok: true, clientSecret: pi.clientSecret, group, numbers, toPay };
			} catch (e) {
				await cancelPendingCheckout(fdb, group);
				return fail(400, { error: `Pagamento non avviato: ${e instanceof Error ? e.message : 'errore Stripe'}` });
			}
		}
		if (viaPayPal) {
			// PayPal diretto: il cliente paga sul sito PayPal e torna sulla pagina Grazie, che cattura l'incasso e chiude l'ordine
			const origin = PUBLIC_SITE_URL || url.origin;
			try {
				const o = await createPayPalOrder({ amount: toPay, description: `Ordine ${numbers.join(', ')} · Stickerprint`, reference: numbers[0], customId: `checkout:${group}`, returnUrl: `${origin}/checkout/grazie?pp=1${express ? '&e=1' : ''}`, cancelUrl: `${origin}/checkout?annullato=1&g=${group}` });
				await setCheckoutSession(fdb, group, o.id);
				return { ok: true, redirect: o.approveUrl, numbers, toPay };
			} catch (e) {
				await cancelPendingCheckout(fdb, group);
				return fail(400, { error: `Pagamento PayPal non avviato: ${e instanceof Error ? e.message : 'errore'}` });
			}
		}
		if (online) {
			// cassa Stripe: carta, Apple Pay, Google Pay, Link (e PayPal se scelto); al ritorno la pagina Grazie chiude l'ordine
			const origin = PUBLIC_SITE_URL || url.origin;
			try {
				const sess = await createCheckoutSession({ amountCents: Math.round(toPay * 100), description: `Ordine ${numbers.join(', ')} · Stickerprint`, email, orderNumber: numbers[0], group, seq: 1, checkout: true, methods: payment === 'paypal' ? ['paypal'] : undefined, successUrl: `${origin}/checkout/grazie?session_id={CHECKOUT_SESSION_ID}${express ? '&e=1' : ''}`, cancelUrl: `${origin}/checkout?annullato=1&g=${group}` });
				await setCheckoutSession(fdb, group, sess.id);
				return { ok: true, redirect: sess.url, numbers, toPay };
			} catch (e) {
				await cancelPendingCheckout(fdb, group);
				return fail(400, { error: `Pagamento non avviato: ${e instanceof Error ? e.message : 'errore Stripe'}` });
			}
		}
		const fin = await finalizeCheckout(fdb, group, { provider: 'test', ref: null });
		return { ok: true, numbers, toPay, invoice: fin.invoice ?? '' };
	},
	/** il cliente ha cambiato carrello o metodo dopo aver avviato il pagamento in pagina: l'ordine in attesa viene tolto */
	annulla: async ({ request }) => {
		const a = adminClient();
		const group = String((await request.formData()).get('group') ?? '');
		if (a && /^[0-9a-f-]{36}$/.test(group)) await cancelPendingCheckout(a, group);
		return { ok: true };
	}
};