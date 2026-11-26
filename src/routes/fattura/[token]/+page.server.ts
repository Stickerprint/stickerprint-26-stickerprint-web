import { error, fail, redirect } from '@sveltejs/kit';
import { adminClient } from '$lib/server/admin';
import { getInvoiceByToken, invoiceQuestion, linguaFattura, setInvoicePaymentStatus, trackInvoiceOpen } from '$lib/server/fatture';
import { vaiAllaLinguaDelCliente } from '$lib/server/lingua-pagina';
import { COMPANY } from '$lib/server/company';
import { aliquotaFattura, importiFattura } from '$lib/server/invoice';
import { docT } from '$lib/server/docs';
import { onlinePaymentsOn, retrieveSession, stripeConfigured } from '$lib/server/stripe';
import { paypalConfigured, settlePayPalReturn } from '$lib/server/paypal';
import { t } from '$lib/traduzioni';
import { langOf, localizePath } from '$lib/i18n';
import type { Actions, PageServerLoad } from './$types';

/** Pagina pubblica della fattura: righe, totali, scadenze (pagabili o informative), PDF, domande. Ogni apertura viene registrata. */
export const load: PageServerLoad = async ({ params, url, request, locals: { locale, user } }) => {
	const db = adminClient();
	if (!db) error(503, t(locale, 'account.errori.servizio'));
	let c = await getInvoiceByToken(db, params.token);
	if (!c) error(404, t(locale, 'account.errori.fatturaNonTrovata'));
	/* la pagina nella lingua del cliente anche se il link non ha il prefisso (email vecchie, link copiati) */
	const cliente = await linguaFattura(db, c.inv);
	vaiAllaLinguaDelCliente(url, locale, cliente.locale, !!user);
	if (request.method === 'GET' && url.searchParams.get('anteprima') !== '1' && c.inv.sent_at) await trackInvoiceOpen(db, c.inv);
	const sid = url.searchParams.get('session_id');
	if (sid && stripeConfigured()) {
		try { const s = await retrieveSession(sid); if (s.paid && s.invoice === c.inv.id && s.seq && c.payments.find((p) => p.seq === s.seq)?.status !== 'pagato') await setInvoicePaymentStatus(db, c.inv.id, s.seq, 'pagato', null, s.ref, 'stripe'); } catch { /* il webhook fara' il resto */ }
	}
	const ppToken = url.searchParams.get('pp') === '1' ? url.searchParams.get('token') : null;
	let ppError: string | null = null;
	if (ppToken && paypalConfigured()) { const r = await settlePayPalReturn(db, ppToken, `invoice:${c.inv.id}:`); if (r.ok) redirect(303, `${localizePath(`/fattura/${params.token}`, locale)}?pagato=1`); ppError = r.error ?? null; }
	const paid = url.searchParams.get('pagato') === '1';
	if (paid) c = (await getInvoiceByToken(db, params.token)) ?? c;
	const b = c.inv.billing ?? {};
	const addr = [b.company, [b.first_name, b.last_name].filter(Boolean).join(' '), [b.street, b.street2].filter(Boolean).join(', '), [b.zip, b.city, b.province ? `(${b.province})` : ''].filter(Boolean).join(' '), b.vat ? t(locale, 'account.doc.piva', { n: b.vat }) : '', b.fiscal_code ? t(locale, 'account.doc.cf', { n: b.fiscal_code }) : '', b.sdi ? t(locale, 'account.doc.sdi', { n: b.sdi }) : ''].filter(Boolean);
	/* nella lingua di chi guarda: la descrizione tradotta della riga, se c'e' (ordini esteri) */
	const lines = (c.inv.lines ?? []).map((l) => ({ ...l, description: (langOf(locale) !== 'it' && l.description_c) || l.description }));
	/* IVA con l'aliquota registrata: 0% e natura per l'estero, non "IVA 22%" fisso */
	const D = docT(langOf(locale));
	const rate = aliquotaFattura(c.inv.vat_rate);
	const natura = c.inv.natura ?? 'N3.1';
	/* importi come nel PDF del cliente: in dollari se ha pagato in dollari (stessa funzione del PDF: i numeri coincidono) */
	const I = importiFattura({ lines: c.inv.lines ?? [], express_net: Number(c.inv.express_net), vat_rate: c.inv.vat_rate, vat_amount: Number(c.inv.vat_amount), paid_currency: cliente.pagato, payment_terms: null });
	if (I.estera) lines.forEach((l, i) => { l.unit_net = I.righe[i].unit; l.total_net = I.righe[i].total; });
	if (Number(c.inv.express_net) > 0) lines.push({ description: t(locale, 'account.doc.express'), qty: 1, unit_net: I.express, total_net: I.express });
	/* le scadenze in valuta: una fattura in dollari e' gia' pagata al checkout, l'importo e' quello addebitato */
	const inValuta = (eur: number) => (I.estera && I.euro.totale > 0 ? Math.round((eur / I.euro.totale) * I.totale * 100) / 100 : eur);
	return {
		currency: I.currency, euroRegistrato: I.estera ? I.euro.totale : null,
		inv: { number: c.inv.number, issued_at: c.inv.issued_at, orders: c.inv.order_numbers ?? [], net: I.estera ? I.imponibile : Number(c.inv.subtotal_net) - Number(c.inv.discount_net) + Number(c.inv.express_net), vat: I.estera ? I.iva : Number(c.inv.vat_amount), ivaLabel: rate === 0 ? D('fattura.ivaZero', { natura }) : D('fattura.ivaAliquota', { p: Math.round(rate * 100) }), ivaNota: rate === 0 ? (natura === 'N3.2' ? D('fattura.n32') : natura === 'N3.1' ? D('fattura.n31') : D('fattura.nonImponibile')) : null, gross: I.estera ? I.totale : Number(c.inv.amount_gross), first_name: b.first_name || b.company || '', /* mai il nome di chi segue: la pagina firma sempre «Stickerprint-Staff» */ sender: null as string | null, notes: c.inv.notes },
		addr, lines,
		payments: c.payments.map((p) => ({ seq: p.seq, method: p.method, due: p.due, amount: inValuta(Number(p.amount)), payable: p.payable, status: p.status, paid_at: p.paid_at })),
		messages: c.messages.map((m) => ({ id: m.id, direction: m.direction, author: m.direction === 'out' ? null : m.author, body: m.body, created_at: m.created_at })),
		bank: { iban: COMPANY.iban || null, name: COMPANY.name }, online: onlinePaymentsOn(), paypal: paypalConfigured(), simulation: !stripeConfigured() && onlinePaymentsOn(), paid, ppError, cancelled: url.searchParams.get('annullato') === '1'
	};
};

export const actions: Actions = {
	domanda: async ({ params, request, url, locals: { locale } }) => {
		const db = adminClient();
		if (!db) return fail(503, { error: t(locale, 'account.errori.servizio') });
		const e = await invoiceQuestion(db, params.token, String((await request.formData()).get('testo') ?? ''), url.origin, langOf(locale));
		return e ? fail(400, { error: e }) : { ok: true, message: t(locale, 'account.messaggi.messaggioInviato') };
	}
};
