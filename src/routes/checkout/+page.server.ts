import { renewedEndsAt, normalizePromo } from '$lib/server/promos';
import { fail } from '@sveltejs/kit';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { shippingForCountry, isRemote } from '$lib/shipping-rules';
import { capValido, ivaDi, paesiPer, valutaDi, zonaDi, STATI_USA } from '$lib/mercati';
import { verificaVies } from '$lib/server/vies';
import { PROVINCES } from '$lib/provinces';
import { env } from '$env/dynamic/private';
import { PUBLIC_SUPABASE_URL, PUBLIC_SITE_URL } from '$env/static/public';
import { loadEngine } from '$lib/server/pricing';
import { quoteWith, PRODUCT_ENGINES } from '$lib/pricing/engine';
import { kitQuote, kitN } from '$lib/pricing/kit';
import { checkDiscount } from '$lib/server/discount';
import { normalizeLines, type InvoiceLine } from '$lib/server/invoice';
import { CATS } from '$lib/dashboard/orders';
import { estimatedShipDate } from '$lib/utils/shipping';
import { LOCALES, PRICE_BOOKS, localizePath, toCurrency } from '$lib/i18n';
import { dataIn, t } from '$lib/traduzioni';
import { MATERIAL_LABEL, materialLabel } from '$lib/account';
import { productFor } from '$lib/prodotti-testi';
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
/** IVA italiana sui prezzi del sito (i prezzi del motore la includono) */
const VAT = 1.22;

/** Client con chiave di servizio (ordini degli ospiti): serve SUPABASE_SERVICE_ROLE_KEY su Vercel */
function adminClient(): SupabaseClient | null {
	const key = env.SUPABASE_SERVICE_ROLE_KEY;
	return key ? createClient(PUBLIC_SUPABASE_URL, key, { auth: { persistSession: false } }) : null;
}

export const load: PageServerLoad = async ({ url, request, locals: { supabase, user, locale } }) => {
	const ship = estimatedShipDate(5);
	/* date di spedizione nella lingua del sito (giorno della settimana, giorno, mese) */
	const loc = LOCALES[locale] ?? LOCALES.it;
	/* ritorno da Stripe senza pagare: gli ordini in attesa vengono tolti, il carrello e' ancora nel browser */
	const cancelledGroup = url.searchParams.get('annullato') === '1' ? url.searchParams.get('g') : null;
	if (cancelledGroup && /^[0-9a-f-]{36}$/.test(cancelledGroup)) { const a = adminClient(); if (a) await cancelPendingCheckout(a, cancelledGroup); }
	{ const a = adminClient(); if (a) expireStaleCheckouts(a).catch(() => {}); }
	const paesi = paesiPer(locale);
	/* paese proposto: quello dell'IP se e' fra quelli serviti (un belga su /fr vede BE, un portoghese su /en vede PT) */
	const ipCountry = (request.headers.get('x-vercel-ip-country') ?? '').toUpperCase();
	const base = { paesi, paeseDefault: paesi.includes(ipCountry) ? ipCountry : paesi[0], stati: locale === 'us' ? STATI_USA : null, shipDate: dataIn(loc, ship, true), expressDate: dataIn(loc, estimatedShipDate(3), true), expressRate: EXPRESS_RATE, guestAllowed: !!env.SUPABASE_SERVICE_ROLE_KEY, online: stripeConfigured(), stripeKey: stripeConfigured() ? (pub.PUBLIC_STRIPE_PUBLISHABLE_KEY ?? '') : '', paypal: paypalConfigured(), cancelled: !!cancelledGroup };
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

interface Line { id: string; product: string; forma: string; materiale: string; finitura?: string; w: number; h: number; qty: number; filePath: string | null; fileName: string | null; previewUrl?: string | null; note?: string; reorderOf?: string | null; engineState?: Record<string, unknown> | null }
/** Tutti i prodotti hanno l'anteprima automatica: il file generato dal configuratore e' quello confermato dal cliente, si va dritti in produzione */
const AUTO_PROOF = new Set(['adesivi_personalizzati', 'adesivi_resinati', 'etichette', 'campioni', 'adesivi_rilievo', 'fogli', 'vetrofanie', 'kit_adesivi']);
function deviceFrom(ua: string): 'mobile' | 'tablet' | 'desktop' {
	if (/iPad|Tablet|PlayBook|Silk/i.test(ua) || (/Android/i.test(ua) && !/Mobile/i.test(ua))) return 'tablet';
	if (/Mobi|iPhone|Android|Windows Phone/i.test(ua)) return 'mobile';
	return 'desktop';
}
const r2 = (v: number) => Math.round(v * 100) / 100;

export const actions: Actions = {
	order: async ({ request, url, locals: { supabase, user, locale } }) => {
		/* messaggi di errore nella lingua del sito (catalogo checkout.errori) */
		const msg = (k: string, params?: Record<string, string | number>) => t(locale, `checkout.errori.${k}`, params);
		const ua = request.headers.get('user-agent') ?? '';
		const device = deviceFrom(ua);
		const admin = adminClient();
		if (!user && !admin) return fail(401, { error: msg('accedi') });
		const db = user ? supabase : admin!; // ospite: chiave di servizio
		const f = await request.formData();
		const s = (k: string) => String(f.get(k) ?? '').trim();
		let lines: Line[];
		try {
			lines = JSON.parse(String(f.get('items') ?? '[]'));
		} catch {
			return fail(400, { error: msg('carrelloNonLeggibile') });
		}
		if (!lines.length) return fail(400, { error: msg('carrelloVuoto') });
		if (lines.some((l) => !l.filePath && l.product !== 'campioni')) return fail(400, { error: msg('mancaFileCarica') });

		const email = (user?.email ?? s('email')).toLowerCase();
		if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return fail(400, { error: msg('emailNonValida') });
		/* paese: fra quelli della lingua (Italia, UE o USA); Italia e USA vogliono provincia/stato, gli altri no */
		const paesi = paesiPer(locale);
		const country = paesi.includes(s('country').toUpperCase()) ? s('country').toUpperCase() : paesi[0];
		const zona = zonaDi(country);
		const provinciaOk = (p: string) => country === 'IT' ? PROVINCES.some(([sigla]) => sigla === p.toUpperCase()) : country === 'US' ? p.toUpperCase() in STATI_USA : true;
		const ship = { first_name: s('first_name'), last_name: s('last_name'), street: s('street'), street2: s('street2'), city: s('city'), zip: s('zip'), province: s('province').toUpperCase().slice(0, country === 'IT' || country === 'US' ? 2 : 40), country, phone: s('phone') };
		if (!ship.first_name || !ship.last_name || !ship.street || !ship.city || !ship.zip || !ship.phone || !provinciaOk(ship.province) || ((country === 'IT' || country === 'US') && !ship.province)) return fail(400, { error: msg('datiSpedizione') });
		if (!capValido(ship.zip, country)) return fail(400, { error: msg('capNonValido') });
		const fiscal = { fiscal_code: s('fiscal_code'), company: s('company'), vat: s('vat'), sdi: s('sdi') };
		if (country === 'IT' && !fiscal.fiscal_code && !fiscal.vat) return fail(400, { error: msg('codiceFiscale') });
		const sameBilling = f.get('same_billing') !== 'off';
		const bill = sameBilling ? { ...ship, ...fiscal } : { first_name: s('b_first_name'), last_name: s('b_last_name'), street: s('b_street'), street2: s('b_street2'), city: s('b_city'), zip: s('b_zip'), province: s('b_province').toUpperCase().slice(0, 40), country, phone: ship.phone, ...fiscal };
		if (!sameBilling && (!bill.street || !bill.city || !bill.zip || ((country === 'IT' || country === 'US') && !bill.province))) return fail(400, { error: msg('fatturazione') });
		/* IVA: Italia e UE 22% (i prezzi del motore la includono); USA niente IVA (esportazione): si lavora sul netto.
		   Azienda UE con partita IVA valida nel VIES: cessione intracomunitaria senza IVA (N3.2). Se il VIES non risponde, IVA. */
		let vatRate = ivaDi(zona);
		let vies: { valido: boolean; verificato: boolean; nome?: string | null } | null = null;
		if (zona === 'ue' && fiscal.vat) {
			vies = await verificaVies(fiscal.vat, country);
			if (vies.valido) vatRate = 0;
		}
		const VATF = 1 + vatRate;
		const currency = valutaDi(zona);
		const fx = currency === 'USD' ? PRICE_BOOKS.USD.rate * PRICE_BOOKS.USD.markup : 1;
		let payment = s('payment') || (stripeConfigured() ? 'stripe' : 'test');
		let inline = (payment === 'card' || payment === 'wallet') && stripeConfigured() && !!pub.PUBLIC_STRIPE_PUBLISHABLE_KEY; // carta o wallet inseriti sul sito
		let online = payment === 'stripe' || payment === 'paypal' || inline;
		let viaPayPal = payment === 'paypal' && paypalConfigured();
		if (online && !stripeConfigured() && !viaPayPal) return fail(400, { error: msg('onlineNonAttivo') });
		if (!online && payment !== 'test' && payment !== 'credito') return fail(400, { error: msg('metodoNonValido') });
		if (payment === 'credito' && !user) return fail(400, { error: msg('creditoSoloAccount') });
		if (payment === 'test' && (stripeConfigured() || paypalConfigured())) return fail(400, { error: msg('provaNonDisponibile') });
		if (online && !admin) return fail(400, { error: msg('onlineNonDisponibile') });
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
				// un'offerta a ciclo scaduta conta come rinnovata (stessa regola della pagina /offerte)
				const valida = !!pr && (!pr.ends_at || new Date(pr.ends_at).getTime() > Date.now() || !!renewedEndsAt(normalizePromo(pr)));
				if (pr && valida && pr.product_slug === l.product && Number(pr.qty) === Number(l.qty)) {
					const sizes = Array.isArray(pr.sizes) ? (pr.sizes as { w: number; h?: number; price: number }[]) : [];
					const hit = sizes.find((s) => Math.abs(Number(s.w) - Number(l.w)) < 0.6 && Math.abs(Number(s.h ?? s.w) - Number(l.h)) < 0.6);
					const gross = hit ? Number(hit.price) : sizes.length ? NaN : Number(pr.price);
					if (Number.isFinite(gross) && gross > 0) baseNet = r2(gross / VAT);
				}
			}
			const net = r2(express ? baseNet * (1 + EXPRESS_RATE) : baseNet);
			priced.push({ ...l, baseNet, net, gross: r2(net * VATF), expressNet: r2(net - baseNet) });
		}
		const productsNet = r2(priced.reduce((a, l) => a + l.baseNet, 0));
		const expressNet = r2(priced.reduce((a, l) => a + l.expressNet, 0));
		let discount = 0;
		let discountCode: string | null = null;
		if (s('discount_code')) {
			const d = await checkDiscount(supabase, s('discount_code'), productsNet, email, locale, user?.id ?? null);
			if (!d.ok) return fail(400, { error: d.error });
			discount = d.amount;
			discountCode = d.code;
		}
		/* spedizione per zona (src/lib/mercati.ts): Italia gratis da 50 €, UE da 69 €, USA da 99 $; il kit campioni da solo viaggia gratis */
		const sped = shippingForCountry(r2(Math.max(0, productsNet - discount) * VAT), priced.every((l) => l.product === 'campioni'), country, ship.province);
		const shippingNet = zona === 'us' ? sped.gross : r2(sped.gross / VAT);
		const shippingGross = r2(shippingNet * VATF);
		const taxable = r2(Math.max(0, productsNet + expressNet + shippingNet - discount));
		const vatAmount = r2(taxable * vatRate);
		const totalGross = r2(taxable + vatAmount);
		let creditUsed = 0;
		if (useCredit) {
			const { data: bal } = await supabase.rpc('my_credit_balance');
			creditUsed = r2(Math.min(Number(bal ?? 0), totalGross));
		}
		const toPay = r2(totalGross - creditUsed);
		/* quanto incassare nella valuta del cliente: in dollari il totale (gia' senza IVA) al cambio del listino */
		const toPayCurrency = currency === 'USD' ? r2(toPay * fx) : toPay;
		/* credito che copre tutto il totale: non c'e' niente da incassare, niente cassa (Stripe rifiuta gli importi a zero);
		   l'ordine si chiude subito come pagato col credito, qualunque metodo fosse selezionato */
		if (payment === 'credito' && (toPay > 0 || creditUsed <= 0)) return fail(400, { error: msg('creditoNonCopre') });
		if (online && creditUsed > 0 && toPay <= 0) payment = 'credito';
		if (payment === 'credito') { online = false; inline = false; viaPayPal = false; }

		// ordini: UN numero per tutto il carrello, una riga per prodotto (stesso numero, stesso gruppo).
		// Con pagamento online le righe nascono "in attesa di pagamento" e si chiudono all'incasso (finalizeCheckout).
		const group = crypto.randomUUID();
		const numbers: string[] = [];
		const invLines: InvoiceLine[] = [];
		/* righe per l'email di conferma del cliente, nella sua lingua (invLines resta in italiano: fattura, dashboard, avviso allo staff) */
		const customerLines: InvoiceLine[] = [];
		const lingua = LOCALES[locale].lang;
		const nomeSagoma = (slug: string, forma: string) => { const k = slug === 'fogli_adesivi' ? `fogli.opzioni.${forma}.label` : `configuratore.opzioni.sagome.${forma}.label`; const v = t(locale, k); return v === k ? forma : v; };
		const nomeLamina = (f: string | undefined) => (!f || f === 'nessuna' ? '' : t(locale, 'checkout.carrello.lamina', { finitura: f === 'lucida' || f === 'opaca' ? t(locale, `checkout.finiture.${f}`) : f }));
		const items: CheckoutItem[] = [];
		const autoProof: boolean[] = [];
		const { data: num0, error: ne0 } = await db.rpc('next_order_number');
		if (ne0 || !num0) return fail(400, { error: msg('numeroOrdine') });
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
				payment_method: payment === 'card' ? 'stripe' : payment, payment_status: online ? 'pending' : payment === 'credito' ? 'paid' : 'test',
				discount_code: discountCode, discount_amount: r2(discount * share),
				credit_used: r2(creditUsed * share), express, checkout_group: group,
				total_paid: r2(toPay * share),
				locale, currency, fx_rate: fx, vat_rate: vatRate, zona, total_paid_currency: r2(toPayCurrency * share),
				// regolazioni del motore approvate (per Stickerprint Studio); scartate se anomale
				engine_state: l.engineState && typeof l.engineState === 'object' && JSON.stringify(l.engineState).length < 300_000 ? l.engineState : null
			};
			let { error } = await db.from('orders').insert(row);
			/* colonne lingua/valuta non ancora create (migrazione 0059): l'ordine passa senza */
			if (error && /locale|currency|fx_rate|vat_rate|zona|total_paid_currency/.test(error.message)) {
				const { locale: _l, currency: _c, fx_rate: _f, vat_rate: _v, zona: _z, total_paid_currency: _t, ...senza } = row;
				void [_l, _c, _f, _v, _z, _t];
				({ error } = await db.from('orders').insert(senza));
			}
			/* colonna engine_state non ancora creata (migrazione 0046 in arrivo): l'ordine passa senza */
			if (error && /engine_state/.test(error.message)) {
				const { engine_state: _skip, ...senza } = row;
				void _skip;
				({ error } = await db.from('orders').insert(senza));
			}
			/* finche' il vincolo di unicita' sul numero non e' tolto (migrazione 0031) la seconda riga
			   riceve un numero suo: l'ordine passa comunque */
			if (error && error.code === '23505') {
				const { data: n2 } = await db.rpc('next_order_number');
				if (n2) { row.number = n2 as string; num = row.number; ({ error } = await db.from('orders').insert(row)); }
			}
			if (error) return fail(400, { error: msg('ordineNonRegistrato', { errore: error.message }) });
			if (!numbers.includes(row.number)) numbers.push(row.number);
			invLines.push({ code: CATS[l.product]?.code ?? null, description: l.product === 'campioni' ? `Kit campioni` : l.product === 'kit_adesivi' ? `Kit di adesivi (${kitN(l.forma)} adesivi da ${l.w} mm, ${MATERIAL_LABEL[l.materiale] ?? l.materiale}${l.finitura && l.finitura !== 'nessuna' ? ', lamina ' + l.finitura : ''})` : `${name} ${l.forma} ${MATERIAL_LABEL[l.materiale] ?? l.materiale}${l.finitura && l.finitura !== 'nessuna' ? ' lamina ' + l.finitura : ''} ${l.w}×${l.h} mm`, qty: l.qty, unit_net: r2(l.baseNet / l.qty), total_net: l.baseNet });
			{
				const lam = nomeLamina(l.finitura);
				const descr = l.product === 'campioni' ? t(locale, 'checkout.riepilogo.kitCampioni') : l.product === 'kit_adesivi' ? t(locale, 'checkout.carrello.kitRiga', { n: kitN(l.forma), mm: `${l.w} mm`, materiale: materialLabel(l.materiale, lingua), lamina: lam ? `, ${lam}` : '' }) : t(locale, 'checkout.carrello.riga', { prodotto: productFor(l.product, lingua)?.name ?? name, sagoma: nomeSagoma(l.product, l.forma), materiale: materialLabel(l.materiale, lingua), lamina: lam ? ` ${lam}` : '', misura: `${l.w}×${l.h} mm` }); /* descrizione dell'ordine SEMPRE in mm: la legge la produzione */
				customerLines.push({ code: CATS[l.product]?.code ?? null, description: descr, qty: l.qty, unit_net: r2(l.baseNet / l.qty), total_net: l.baseNet });
			}
			items.push({ product: l.product, productName: name, forma: l.forma, materiale: l.materiale, finitura: l.finitura ?? null, w: l.w, h: l.h, qty: Number(l.qty), gross: l.gross, previewUrl: l.previewUrl ?? null });
			autoProof.push(auto);
		}
		const invoiceLines = normalizeLines(invLines, discount, creditUsed);
		if (shippingNet > 0) invoiceLines.push({ description: isRemote(ship.province) ? 'Spedizione (isole e zone remote)' : 'Spedizione', qty: 1, unit_net: shippingNet, total_net: shippingNet });
		const payload: CheckoutPayload = { userId: user?.id ?? null, email, firstName: ship.first_name, lastName: ship.last_name, payment: payment === 'card' ? 'stripe' : payment, ship, bill, numbers, invoiceLines, emailLines: invLines, customerLines, items, productsNet, expressNet, discount, discountCode, creditUsed, vatAmount, totalGross, toPay, express, autoProof , locale, currency, fxRate: fx, vatRate, zona, toPayCurrency, vies: vies ? { valido: vies.valido, verificato: vies.verificato, nome: vies.nome ?? null } : null };
		const fdb = admin ?? db;
		const se = await savePendingCheckout(fdb, group, payload, viaPayPal ? 'paypal' : online ? 'stripe' : payment === 'credito' ? 'credit' : 'test', { locale, currency });
		if (se) return fail(400, { error: msg('ordineNonRegistrato', { errore: se }) });
		// scadenza unica, anticipata: pagata online (o subito, con l'ordine di prova)
		await fdb.from('order_payments').insert({ checkout_group: group, seq: 1, method: ({ paypal: 'PayPal', stripe: 'Carta di credito (Stripe)', card: 'Carta di credito (Stripe)', wallet: 'Apple Pay / Google Pay (Stripe)', credito: 'Credito Stickerprint' } as Record<string, string>)[payment] ?? 'Test', due: new Date().toISOString().slice(0, 10), amount: toPay, upfront: true, status: 'da_pagare' });

		// dati salvati per la prossima volta
		if (user) {
			await supabase.from('profiles').update({ phone: ship.phone, fiscal_code: fiscal.fiscal_code || null, company_name: fiscal.company || null, vat_number: fiscal.vat || null, sdi_code: fiscal.sdi || null, full_name: `${ship.first_name} ${ship.last_name}` }).eq('id', user.id);
			if (f.get('save_address') === 'on') {
				await supabase.from('addresses').update({ is_default: false }).eq('user_id', user.id).eq('kind', 'shipping');
				await supabase.from('addresses').insert({ user_id: user.id, kind: 'shipping', first_name: ship.first_name, last_name: ship.last_name, company: fiscal.company || null, street: [ship.street, ship.street2].filter(Boolean).join(', '), city: ship.city, zip: ship.zip, province: ship.province, country: 'IT', phone: ship.phone, is_default: true });
			}
		}

		/* testi e ritorni della cassa nella lingua del cliente: descrizione su Stripe/PayPal, pagina Grazie e carrello con il prefisso */
		const descrizionePagamento = t(locale, 'checkout.ordine.descrizionePagamento', { numeri: numbers.join(', ') });
		const urlGrazie = localizePath('/checkout/grazie', locale);
		const urlAnnullato = `${localizePath('/checkout', locale)}?annullato=1&g=${group}`;
		if (inline) {
			// carta o wallet direttamente nella pagina: il browser conferma il PaymentIntent, la pagina Grazie (o il webhook) chiude l'ordine
			try {
				/* cliente registrato che paga con carta: carta gia' salvata (verificata: deve essere sua) oppure carta nuova da salvare */
				let customer: string | null = null, paymentMethod: string | null = null;
				const savedPm = s('saved_pm'), saveCard = f.get('save_card') === 'on';
				if (user && payment === 'card' && savedCardsOn()) {
					if (savedPm) {
						customer = await ownsCard(user.id, savedPm);
						if (!customer) { await cancelPendingCheckout(fdb, group); return fail(400, { error: msg('cartaSalvataNonDisponibile') }); }
						paymentMethod = savedPm;
					} else if (saveCard) {
						customer = await ensureCustomer({ id: user.id, email, name: `${ship.first_name} ${ship.last_name}`.trim() });
					}
				}
				const pi = await createPaymentIntent({ amountCents: Math.round(toPayCurrency * 100), currency: currency === 'USD' ? 'usd' : 'eur', description: descrizionePagamento, email, orderNumber: numbers[0], group, seq: 1, customer, saveCard: saveCard && !paymentMethod, paymentMethod });
				await setCheckoutSession(fdb, group, pi.id);
				return { ok: true, clientSecret: pi.clientSecret, group, numbers, toPay, toPayCurrency, currency };
			} catch (e) {
				await cancelPendingCheckout(fdb, group);
				return fail(400, { error: msg('pagamentoNonAvviato', { errore: e instanceof Error ? e.message : msg('erroreStripe') }) });
			}
		}
		if (viaPayPal) {
			// PayPal diretto: il cliente paga sul sito PayPal e torna sulla pagina Grazie, che cattura l'incasso e chiude l'ordine
			const origin = PUBLIC_SITE_URL || url.origin;
			try {
				const o = await createPayPalOrder({ amount: toPayCurrency, currency, locale: LOCALES[locale].intl, description: descrizionePagamento, reference: numbers[0], customId: `checkout:${group}`, returnUrl: `${origin}${urlGrazie}?pp=1${express ? '&e=1' : ''}`, cancelUrl: `${origin}${urlAnnullato}` }, locale);
				await setCheckoutSession(fdb, group, o.id);
				return { ok: true, redirect: o.approveUrl, numbers, toPay };
			} catch (e) {
				await cancelPendingCheckout(fdb, group);
				return fail(400, { error: msg('paypalNonAvviato', { errore: e instanceof Error ? e.message : msg('erroreGenerico') }) });
			}
		}
		if (online) {
			// cassa Stripe: carta, Apple Pay, Google Pay, Link (e PayPal se scelto); al ritorno la pagina Grazie chiude l'ordine
			const origin = PUBLIC_SITE_URL || url.origin;
			try {
				const sess = await createCheckoutSession({ amountCents: Math.round(toPayCurrency * 100), currency: currency === 'USD' ? 'usd' : 'eur', locale: LOCALES[locale].lang, description: descrizionePagamento, email, orderNumber: numbers[0], group, seq: 1, checkout: true, methods: payment === 'paypal' ? ['paypal'] : undefined, successUrl: `${origin}${urlGrazie}?session_id={CHECKOUT_SESSION_ID}${express ? '&e=1' : ''}`, cancelUrl: `${origin}${urlAnnullato}` });
				await setCheckoutSession(fdb, group, sess.id);
				return { ok: true, redirect: sess.url, numbers, toPay };
			} catch (e) {
				await cancelPendingCheckout(fdb, group);
				return fail(400, { error: msg('pagamentoNonAvviato', { errore: e instanceof Error ? e.message : msg('erroreStripe') }) });
			}
		}
		const fin = await finalizeCheckout(fdb, group, { provider: payment === 'credito' ? 'credit' : 'test', ref: null });
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