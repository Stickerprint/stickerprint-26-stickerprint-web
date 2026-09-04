import { fail } from '@sveltejs/kit';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env } from '$env/dynamic/private';
import { PUBLIC_SUPABASE_URL, PUBLIC_SITE_URL } from '$env/static/public';
import { loadEngine } from '$lib/server/pricing';
import { quoteWith, PRODUCT_ENGINES } from '$lib/pricing/engine';
import { checkDiscount } from '$lib/server/discount';
import { buildInvoicePdf, normalizeLines, type InvoiceLine } from '$lib/server/invoice';
import { sendEmail } from '$lib/server/email';
import { pushStaff } from '$lib/server/push';
import { orderConfirmationEmail } from '$lib/server/email-templates';
import { estimatedShipDate, formatItDate } from '$lib/utils/shipping';
import { MATERIAL_LABEL } from '$lib/account';
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

export const load: PageServerLoad = async ({ locals: { supabase, user } }) => {
	const ship = estimatedShipDate(5);
	const base = { shipDate: formatItDate(ship), expressDate: formatItDate(estimatedShipDate(3)), expressRate: EXPRESS_RATE, guestAllowed: !!env.SUPABASE_SERVICE_ROLE_KEY };
	if (!user) return { ...base, profile: null, addresses: [], credit: 0, loyalty: null };
	const [{ data: profile }, { data: addresses }, { data: credit }, { data: loyalty }] = await Promise.all([
		supabase.from('profiles').select('full_name, email, phone, company_name, vat_number, fiscal_code, sdi_code').eq('id', user.id).maybeSingle(),
		supabase.from('addresses').select('*').eq('user_id', user.id).order('is_default', { ascending: false }),
		supabase.rpc('my_credit_balance'),
		supabase.rpc('loyalty_status')
	]);
	return { ...base, profile, addresses: addresses ?? [], credit: Number(credit ?? 0), loyalty };
};

interface Line { id: string; product: string; forma: string; materiale: string; finitura?: string; w: number; h: number; qty: number; filePath: string | null; fileName: string | null; previewUrl?: string | null; note?: string; reorderOf?: string | null }
/** Prodotti con prova di stampa automatica (il file generato dal sistema è quello confermato dal cliente) */
const AUTO_PROOF = new Set(['adesivi_personalizzati', 'adesivi_resinati', 'etichette', 'campioni']);
function deviceFrom(ua: string): 'mobile' | 'tablet' | 'desktop' {
	if (/iPad|Tablet|PlayBook|Silk/i.test(ua) || (/Android/i.test(ua) && !/Mobile/i.test(ua))) return 'tablet';
	if (/Mobi|iPhone|Android|Windows Phone/i.test(ua)) return 'mobile';
	return 'desktop';
}
const r2 = (v: number) => Math.round(v * 100) / 100;
function toBase64(bytes: Uint8Array): string {
	let bin = '';
	for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
	return btoa(bin);
}

export const actions: Actions = {
	order: async ({ request, locals: { supabase, user } }) => {
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
		const payment = s('payment') || 'test';
		if (payment !== 'test') return fail(400, { error: 'Questo metodo di pagamento sarà disponibile a breve. Per ora usa "Test".' });
		const express = f.get('express') === 'on';
		const useCredit = !!user && f.get('use_credit') === 'on';

		// prezzi ricalcolati dal listino (mai fidarsi del browser); l'express (+30%) entra nel prezzo del prodotto
		const engines: Record<string, Awaited<ReturnType<typeof loadEngine>>['config']> = {};
		const priced = [];
		for (const l of lines) {
			if (l.product === 'campioni') {
				// kit campioni: prezzo fisso 10 € IVA inclusa, niente file, niente express
				const baseNet = r2(SAMPLES_GROSS / VAT);
				priced.push({ ...l, qty: 1, baseNet, net: baseNet, gross: SAMPLES_GROSS, expressNet: 0 });
				continue;
			}
			engines[l.product] ??= (await loadEngine(supabase, l.product)).config;
			const q = quoteWith(engines[l.product], { w: Number(l.w), h: Number(l.h), forma: l.forma, materiale: l.materiale, finitura: l.finitura ?? 'nessuna', qty: Number(l.qty), vatIncluded: true });
			const baseNet = q.net;
			const net = r2(express ? baseNet * (1 + EXPRESS_RATE) : baseNet);
			priced.push({ ...l, baseNet, net, gross: r2(net * VAT), expressNet: r2(net - baseNet) });
		}
		const productsNet = r2(priced.reduce((a, l) => a + l.baseNet, 0));
		const expressNet = r2(priced.reduce((a, l) => a + l.expressNet, 0));
		let discount = 0;
		let discountCode: string | null = null;
		if (s('discount_code')) {
			const d = await checkDiscount(supabase, s('discount_code'), productsNet);
			if (!d.ok) return fail(400, { error: d.error });
			discount = d.amount;
			discountCode = d.code;
		}
		const taxable = r2(Math.max(0, productsNet + expressNet - discount));
		const vatAmount = r2(taxable * (VAT - 1));
		const totalGross = r2(taxable + vatAmount);
		let creditUsed = 0;
		if (useCredit) {
			const { data: bal } = await supabase.rpc('my_credit_balance');
			creditUsed = r2(Math.min(Number(bal ?? 0), totalGross));
		}
		const toPay = r2(totalGross - creditUsed);

		// ordini: una riga per prodotto
		const group = crypto.randomUUID();
		const numbers: string[] = [];
		const invLines: InvoiceLine[] = [];
		for (const l of priced) {
			const { data: num, error: ne } = await db.rpc('next_order_number');
			if (ne || !num) return fail(400, { error: 'Numero d’ordine non disponibile, riprova.' });
			const share = productsNet > 0 ? l.baseNet / productsNet : 1 / priced.length;
			const name = l.product === 'campioni' ? 'Kit campioni' : (PRODUCT_ENGINES.find((p) => p.slug === l.product)?.name ?? l.product);
			const row = {
				user_id: user?.id ?? null, number: num as string,
				product_slug: l.product, product_name: name,
				forma: l.forma, materiale: l.materiale, finitura: l.finitura ?? null,
				width_mm: l.w, height_mm: l.h, qty: l.qty,
				total_net: l.net, total_gross: l.gross,
				status: AUTO_PROOF.has(l.product) ? 'in_produzione' : 'attesa_prova',
				prod_stage: AUTO_PROOF.has(l.product) && l.product !== 'campioni' ? 'stampa' : null,
				auto_proof: AUTO_PROOF.has(l.product),
				preview_url: l.previewUrl ?? null, proof_url: l.previewUrl ?? null,
				device, user_agent: ua.slice(0, 500),
				file_path: l.filePath?.startsWith('riordino:') || l.filePath === 'campioni' ? null : l.filePath,
				notes: [l.reorderOf ? `Riordino di ${l.reorderOf}` : '', l.note ?? ''].filter(Boolean).join(' · ') || null,
				email, shipping: ship, billing: bill,
				payment_method: payment, payment_status: payment === 'test' ? 'test' : 'paid',
				discount_code: discountCode, discount_amount: r2(discount * share),
				credit_used: r2(creditUsed * share), express, checkout_group: group,
				total_paid: r2(toPay * share)
			};
			const { error } = await db.from('orders').insert(row);
			if (error) return fail(400, { error: `Ordine non registrato: ${error.message}` });
			numbers.push(row.number);
			invLines.push({ description: l.product === 'campioni' ? `${row.number} · Kit campioni` : `${row.number} · ${name} ${l.forma} ${MATERIAL_LABEL[l.materiale] ?? l.materiale}${l.finitura && l.finitura !== 'nessuna' ? ' lamina ' + l.finitura : ''} ${l.w}×${l.h} mm`, qty: l.qty, unit_net: r2(l.baseNet / l.qty), total_net: l.baseNet });
		}
		if (creditUsed > 0) await supabase.from('credit_transactions').insert({ user_id: user!.id, amount: -creditUsed, kind: 'spend', order_ref: numbers[0], note: `Credito usato sull'ordine ${numbers.join(', ')}` });
		if (discountCode) await db.rpc('discount_code_used', { p_code: discountCode });

		// fattura: registrata, PDF generato e inviato via email (con la conferma d'ordine)
		const { data: invNum } = await db.rpc('next_invoice_number');
		const invoiceLines = normalizeLines(invLines, discount, creditUsed);
		const payTerms = [{ due: new Date().toISOString().slice(0, 10), amount: toPay, method: ({ paypal: 'PayPal', stripe: 'Carta di credito (Stripe)' } as Record<string, string>)[payment] ?? 'Test', xml_code: 'MP08' }];
		const invoice = { number: (invNum as string) ?? `FT-${Date.now()}`, issued_at: new Date().toISOString().slice(0, 10), email, billing: bill, lines: invoiceLines, payment_terms: payTerms, subtotal_net: productsNet, discount_net: discount, discount_code: discountCode, express_net: expressNet, credit_used: creditUsed, vat_amount: vatAmount, total_gross: totalGross, to_pay: toPay, payment_method: payment, orders: numbers };
		let pdfPath: string | null = null;
		let pdfB64: string | null = null;
		try {
			const bytes = await buildInvoicePdf(invoice);
			pdfB64 = toBase64(bytes);
			const folder = user?.id ?? 'guest';
			const path = `${folder}/${invoice.number}.pdf`;
			const { error } = await db.storage.from('invoices').upload(path, bytes, { contentType: 'application/pdf', upsert: true });
			if (!error) pdfPath = path;
		} catch (e) {
			console.error('[invoice] pdf', e);
		}
		const { data: firstOrder } = await db.from('orders').select('id').eq('number', numbers[0]).maybeSingle();
		await db.from('invoices').insert({ user_id: user?.id ?? null, order_id: firstOrder?.id ?? null, number: invoice.number, issued_at: invoice.issued_at, amount_gross: toPay, pdf_path: pdfPath, email, billing: bill, lines: invoiceLines, payment_terms: payTerms, order_numbers: numbers, subtotal_net: productsNet, discount_net: discount, express_net: expressNet, credit_used: creditUsed, vat_amount: vatAmount, payment_method: payment, paid_at: new Date().toISOString(), checkout_group: group, sent_at: null });

		// dati salvati per la prossima volta
		if (user) {
			await supabase.from('profiles').update({ phone: ship.phone, fiscal_code: fiscal.fiscal_code || null, company_name: fiscal.company || null, vat_number: fiscal.vat || null, sdi_code: fiscal.sdi || null, full_name: `${ship.first_name} ${ship.last_name}` }).eq('id', user.id);
			if (f.get('save_address') === 'on') {
				await supabase.from('addresses').update({ is_default: false }).eq('user_id', user.id).eq('kind', 'shipping');
				await supabase.from('addresses').insert({ user_id: user.id, kind: 'shipping', first_name: ship.first_name, last_name: ship.last_name, company: fiscal.company || null, street: [ship.street, ship.street2].filter(Boolean).join(', '), city: ship.city, zip: ship.zip, province: ship.province, country: 'IT', phone: ship.phone, is_default: true });
			}
		}
		// email di conferma con fattura allegata (se Postmark è configurato)
		const origin = PUBLIC_SITE_URL || 'https://stickerprint.it';
		const mail = orderConfirmationEmail({ name: ship.first_name, numbers, invoiceNumber: invoice.number, total: `${toPay.toFixed(2).replace('.', ',')} €`, lines: invLines.map((l) => `${l.qty} × ${l.description}`), shipDate: formatItDate(estimatedShipDate(express ? 3 : 5)), accountUrl: user ? `${origin}/account/ordini` : null });
		sendEmail({ to: email, ...mail, attachments: pdfB64 ? [{ name: `${invoice.number}.pdf`, content: pdfB64, contentType: 'application/pdf' }] : undefined })
			.then((r) => { if (r.ok && !r.skipped) db.from('invoices').update({ sent_at: new Date().toISOString() }).eq('number', invoice.number).then(() => {}); })
			.catch((e) => console.error('[checkout] email', e));
		pushStaff({ title: `Nuovo ordine ${numbers[0]}`, body: `${ship.first_name} ${ship.last_name} · ${invLines.length} ${invLines.length === 1 ? 'articolo' : 'articoli'} · ${toPay.toFixed(2)} €`, url: `/dashboard/fatturazione/ordini/${group}`, tag: numbers[0] }).catch((e) => console.error('[push]', e));
		return { ok: true, numbers, toPay, invoice: invoice.number };
	}
};
