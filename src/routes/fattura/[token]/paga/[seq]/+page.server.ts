import { error, fail, redirect } from '@sveltejs/kit';
import { adminClient } from '$lib/server/admin';
import { getInvoiceByToken, setInvoicePaymentStatus } from '$lib/server/fatture';
import { createCheckoutSession, simulationOn, stripeConfigured } from '$lib/server/stripe';
import { t } from '$lib/traduzioni';
import type { Actions, PageServerLoad } from './$types';

/** "Paga ora" su una scadenza della fattura: Stripe Checkout, oppure la cassa simulata quando Stripe non c'e' ancora */
export const load: PageServerLoad = async ({ params, url, locals: { locale } }) => {
	const db = adminClient();
	if (!db) error(503, t(locale, 'account.errori.servizio'));
	const c = await getInvoiceByToken(db, params.token);
	if (!c) error(404, t(locale, 'account.errori.fatturaNonTrovata'));
	const p = c.payments.find((x) => x.seq === Number(params.seq));
	if (!p) error(404, t(locale, 'account.errori.scadenzaNonTrovata'));
	if (p.status === 'pagato') redirect(303, `/fattura/${params.token}?pagato=1`);
	if (!p.payable) error(400, t(locale, 'account.errori.scadenzaRiba'));
	const base = `${url.origin}/fattura/${params.token}`;
	if (stripeConfigured()) {
		const s = await createCheckoutSession({ amountCents: Math.round(Number(p.amount) * 100), description: `Fattura ${c.inv.number}${c.payments.length > 1 ? ` · scadenza ${p.seq} di ${c.payments.length}` : ''}`, email: c.inv.email, orderNumber: c.inv.number, group: c.inv.checkout_group ?? '', seq: p.seq, invoice: c.inv.id, successUrl: `${base}?pagato=1&session_id={CHECKOUT_SESSION_ID}`, cancelUrl: `${base}?annullato=1` });
		redirect(303, s.url);
	}
	if (!simulationOn()) error(404, t(locale, 'account.errori.pagamentoNonAttivoFattura'));
	const b = c.inv.billing ?? {};
	return { order: { number: c.inv.number, customer: b.company || `${b.first_name ?? ''} ${b.last_name ?? ''}`.trim(), email: c.inv.email }, payment: { seq: p.seq, amount: Number(p.amount), method: p.method, of: c.payments.length }, back: `/fattura/${params.token}` };
};

export const actions: Actions = {
	default: async ({ params, locals: { locale } }) => {
		const db = adminClient();
		if (!db || !simulationOn()) return fail(400, { error: t(locale, 'account.errori.simulazioneNonAttiva') });
		const c = await getInvoiceByToken(db, params.token);
		if (!c) return fail(404, { error: t(locale, 'account.errori.fatturaNonTrovata') });
		const e = await setInvoicePaymentStatus(db, c.inv.id, Number(params.seq), 'pagato', null, `SIM-${Date.now().toString(36).toUpperCase()}`, 'simulazione');
		if (e) return fail(400, { error: e });
		redirect(303, `/fattura/${params.token}?pagato=1`);
	}
};
