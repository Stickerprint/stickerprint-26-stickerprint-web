import { error, redirect } from '@sveltejs/kit';
import { adminClient } from '$lib/server/admin';
import { getByToken } from '$lib/server/conferme';
import { createPayPalOrder, paypalConfigured } from '$lib/server/paypal';
import type { RequestHandler } from './$types';

/** "Paga con PayPal" su una scadenza della conferma: il cliente va su PayPal e torna sulla conferma */
export const GET: RequestHandler = async ({ params, url }) => {
	const db = adminClient();
	if (!db) error(503, 'Servizio non disponibile');
	if (!paypalConfigured()) error(404, 'PayPal non attivo');
	const c = await getByToken(db, params.token);
	if (!c) error(404, 'Conferma non trovata');
	const p = c.payments.find((x) => x.seq === Number(params.seq));
	if (!p) error(404, 'Scadenza non trovata');
	if (p.status === 'pagato') redirect(303, `/conferma/${params.token}?pagato=1`);
	if (!p.upfront) error(400, 'Questa scadenza non si paga online.');
	const base = `${url.origin}/conferma/${params.token}`;
	const o = await createPayPalOrder({ amount: Number(p.amount), description: `Ordine ${c.group.number} · ${c.payments.length > 1 ? `scadenza ${p.seq} di ${c.payments.length}` : 'pagamento anticipato'}`, reference: c.group.number, customId: `order:${c.group.key}:${p.seq}`, returnUrl: `${base}?pp=1`, cancelUrl: `${base}?annullato=1` });
	redirect(303, o.approveUrl);
};
