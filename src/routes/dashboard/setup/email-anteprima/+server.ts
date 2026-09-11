import { reviewRequestEmail, shippingUpdateEmail } from '$lib/server/email-templates';
import type { RequestHandler } from './$types';

/** Anteprima delle email di stato: /dashboard/setup/email-anteprima?kind=affidato|spedito|in_consegna|consegnato|problema|punto_ritiro|recensione */
export const GET: RequestHandler = async ({ url }) => {
	const kind = url.searchParams.get('kind') ?? 'affidato';
	const base = { name: 'Mattia', number: 'SP00027', trackingUrl: 'https://tracking.qapla.it/51df4308/SP00027', courier: 'GLS-ITA', items: ['15 × Adesivi personalizzati sagomato 40×40 mm', '1 × Kit di adesivi (4 adesivi)'], accountUrl: `${url.origin}/account/ordini`, place: 'Milano', detail: 'GIACENZA' };
	const mail = kind === 'recensione' ? reviewRequestEmail({ name: 'Mattia', number: 'SP00027', items: base.items, href: `${url.origin}/recensione/x` }) : shippingUpdateEmail({ ...base, kind: kind as 'affidato' });
	return new Response(mail.html, { headers: { 'content-type': 'text/html; charset=utf-8' } });
};
