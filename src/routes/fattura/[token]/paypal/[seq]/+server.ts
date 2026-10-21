import { error, redirect } from '@sveltejs/kit';
import { adminClient } from '$lib/server/admin';
import { getInvoiceByToken } from '$lib/server/fatture';
import { createPayPalOrder, paypalConfigured } from '$lib/server/paypal';
import { t } from '$lib/traduzioni';
import { LOCALES, localizePath } from '$lib/i18n';
import type { RequestHandler } from './$types';

/** "Paga con PayPal" su una scadenza della fattura */
export const GET: RequestHandler = async ({ params, url, locals: { locale } }) => {
	const db = adminClient();
	if (!db) error(503, t(locale, 'account.errori.servizio'));
	if (!paypalConfigured()) error(404, t(locale, 'account.errori.paypalNonAttivo'));
	const c = await getInvoiceByToken(db, params.token);
	if (!c) error(404, t(locale, 'account.errori.fatturaNonTrovata'));
	const p = c.payments.find((x) => x.seq === Number(params.seq));
	if (!p) error(404, t(locale, 'account.errori.scadenzaNonTrovata'));
	const page = localizePath(`/fattura/${params.token}`, locale);
	if (p.status === 'pagato') redirect(303, `${page}?pagato=1`);
	if (!p.payable) error(400, t(locale, 'account.errori.scadenzaRiba'));
	const base = `${url.origin}${page}`;
	const o = await createPayPalOrder({ amount: Number(p.amount), locale: LOCALES[locale].intl.replace('-', '_'), description: `${t(locale, 'account.paga.fattura', { n: c.inv.number })}${c.payments.length > 1 ? t(locale, 'account.paga.scadenzaDi', { seq: p.seq, tot: c.payments.length }) : ''}`, reference: c.inv.number, customId: `invoice:${c.inv.id}:${p.seq}`, returnUrl: `${base}?pp=1`, cancelUrl: `${base}?annullato=1` });
	redirect(303, o.approveUrl);
};
