import { error } from '@sveltejs/kit';
import { adminClient } from '$lib/server/admin';
import { getByToken, upfrontDue } from '$lib/server/conferme';
import { t } from '$lib/traduzioni';
import type { PageServerLoad } from './$types';

/** Pagina di ringraziamento, ultimo passo del flusso unico (Mattia, 25/11/2026): ci si arriva dopo aver pagato
 *  l'anticipo, oppure subito dopo la conferma del preventivo quando non c'e' niente da pagare adesso
 *  (ricevuta bancaria, bonifico a scadenza). Non conta come apertura della conferma d'ordine. */
export const load: PageServerLoad = async ({ params, url, locals: { locale } }) => {
	const db = adminClient();
	if (!db) error(503, t(locale, 'account.errori.servizio'));
	const c = await getByToken(db, params.token);
	if (!c) error(404, t(locale, 'account.errori.confermaNonTrovata'));
	const g = c.group;
	const f = g.items[0];
	const due = upfrontDue(c.payments);
	/* "pagato" si dice solo se una scadenza risulta davvero pagata: il parametro da solo non basta */
	const pagato = url.searchParams.get('pagato') === '1' && c.payments.some((p) => p.status === 'pagato');
	return {
		token: params.token, number: g.number, created_at: g.created_at, first_name: (f.billing?.first_name || f.shipping?.first_name || '').trim() || g.customer,
		pagato, due, dalPreventivo: url.searchParams.get('dal') === 'preventivo', annullato: g.status === 'annullato',
		spedizione: g.delivery_date ?? f.ship_by ?? null, tempi: f.lead_time ?? null, email: !!g.email && !!c.conf.sent_at
	};
};
