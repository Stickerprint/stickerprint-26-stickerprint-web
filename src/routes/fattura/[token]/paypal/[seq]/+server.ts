import { error, redirect } from '@sveltejs/kit';
import { adminClient } from '$lib/server/admin';
import { getInvoiceByToken } from '$lib/server/fatture';
import { createPayPalOrder, paypalConfigured } from '$lib/server/paypal';
import type { RequestHandler } from './$types';

/** "Paga con PayPal" su una scadenza della fattura */
export const GET: RequestHandler = async ({ params, url }) => {
	const db = adminClient();
	if (!db) error(503, 'Servizio non disponibile');
	if (!paypalConfigured()) error(404, 'PayPal non attivo');
	const c = await getInvoiceByToken(db, params.token);
	if (!c) error(404, 'Fattura non trovata');
	const p = c.payments.find((x) => x.seq === Number(params.seq));
	if (!p) error(404, 'Scadenza non trovata');
	if (p.status === 'pagato') redirect(303, `/fattura/${params.token}?pagato=1`);
	if (!p.payable) error(400, 'Questa scadenza viene addebitata con ricevuta bancaria.');
	const base = `${url.origin}/fattura/${params.token}`;
	const o = await createPayPalOrder({ amount: Number(p.amount), description: `Fattura ${c.inv.number}${c.payments.length > 1 ? ` · scadenza ${p.seq} di ${c.payments.length}` : ''}`, reference: c.inv.number, customId: `invoice:${c.inv.id}:${p.seq}`, returnUrl: `${base}?pp=1`, cancelUrl: `${base}?annullato=1` });
	redirect(303, o.approveUrl);
};
