import { reviewRequestEmail, shippingUpdateEmail, type ShippingMailKind } from '$lib/server/email-templates';
import { sendEmail } from '$lib/server/email';
import type { RequestHandler } from './$types';

/** Anteprima delle email di stato: /dashboard/setup/email-anteprima?kind=affidato|spedito|in_consegna|consegnato|problema|punto_ritiro|recensione */
export const GET: RequestHandler = async ({ url, locals: { user } }) => {
	const kind = url.searchParams.get('kind') ?? 'affidato';
	const base = { name: 'Mattia', number: 'SP00027', trackingUrl: 'https://tracking.qapla.it/51df4308/SP00027', courier: 'GLS-ITA', items: [{ name: 'Adesivi personalizzati sagomato', meta: 'bianco · 40×40 mm', qty: 15, preview: `${url.origin}/images/prodotti/rilievo/1.webp` }, { name: 'Kit di adesivi (4 adesivi)', qty: 10, preview: `${url.origin}/images/prodotti/rilievo/2.webp` }], accountUrl: `${url.origin}/account/ordini`, place: 'Milano', detail: 'GIACENZA' };
	const mail = kind === 'recensione' ? reviewRequestEmail({ name: 'Mattia', number: 'SP00027', items: base.items, href: `${url.origin}/account/recensioni` }) : shippingUpdateEmail({ ...base, kind: kind as ShippingMailKind, detail: kind === 'ritardo_corriere' ? 'In ritardo' : undefined, place: kind === 'ritardo_corriere' ? 'Hub di Bologna' : undefined, shippedAt: kind === 'ritardo_corriere' ? '12/09/2026' : undefined, newDate: kind === 'ritardo_nostro' ? 'mercoledì 17 settembre' : undefined, accountUrl: `${url.origin}/account/ordini` });
	// ?invia=1: manda l'anteprima all'indirizzo dello staff che e' loggato (per vedere le email nella casella vera)
	if (url.searchParams.get('invia') === '1' && user?.email) {
		const r = await sendEmail({ to: user.email, ...mail, metadata: { anteprima: kind } });
		return new Response(r.ok ? `Inviata "${mail.subject}" a ${user.email}` : `Errore: ${r.error}`, { headers: { 'content-type': 'text/plain; charset=utf-8' } });
	}
	return new Response(mail.html, { headers: { 'content-type': 'text/html; charset=utf-8' } });
};
