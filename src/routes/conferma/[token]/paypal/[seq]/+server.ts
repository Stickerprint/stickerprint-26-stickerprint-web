import { error, redirect } from '@sveltejs/kit';
import { adminClient } from '$lib/server/admin';
import { getByToken } from '$lib/server/conferme';
import { createPayPalOrder, paypalConfigured } from '$lib/server/paypal';
import { t } from '$lib/traduzioni';
import type { RequestHandler } from './$types';

/** "Paga con PayPal" su una scadenza della conferma: il cliente va su PayPal e torna sulla conferma */
export const GET: RequestHandler = async ({ params, url, locals: { locale } }) => {
	const db = adminClient();
	if (!db) error(503, t(locale, 'account.errori.servizio'));
	if (!paypalConfigured()) error(404, t(locale, 'account.errori.paypalNonAttivo'));
	const c = await getByToken(db, params.token);
	if (!c) error(404, t(locale, 'account.errori.confermaNonTrovata'));
	const p = c.payments.find((x) => x.seq === Number(params.seq));
	if (!p) error(404, t(locale, 'account.errori.scadenzaNonTrovata'));
	if (p.status === 'pagato') redirect(303, `/conferma/${params.token}?pagato=1`);
	if (!p.upfront && /ricevuta|riba|rid\b|sdd/i.test(p.method)) error(400, t(locale, 'account.errori.scadenzaRiba'));
	const base = `${url.origin}/conferma/${params.token}`;
	const o = await createPayPalOrder({ amount: Number(p.amount), description: `Ordine ${c.group.number} · ${c.payments.length > 1 ? `scadenza ${p.seq} di ${c.payments.length}` : 'pagamento anticipato'}`, reference: c.group.number, customId: `order:${c.group.key}:${p.seq}`, returnUrl: `${base}?pp=1`, cancelUrl: `${base}?annullato=1` });
	redirect(303, o.approveUrl);
};
