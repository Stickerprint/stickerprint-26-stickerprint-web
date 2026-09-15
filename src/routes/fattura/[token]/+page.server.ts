import { error, fail } from '@sveltejs/kit';
import { adminClient } from '$lib/server/admin';
import { getInvoiceByToken, invoiceQuestion, setInvoicePaymentStatus, trackInvoiceOpen } from '$lib/server/fatture';
import { COMPANY } from '$lib/server/company';
import { onlinePaymentsOn, retrieveSession, stripeConfigured } from '$lib/server/stripe';
import type { Actions, PageServerLoad } from './$types';

/** Pagina pubblica della fattura: righe, totali, scadenze (pagabili o informative), PDF, domande. Ogni apertura viene registrata. */
export const load: PageServerLoad = async ({ params, url, request }) => {
	const db = adminClient();
	if (!db) error(503, 'Servizio non disponibile');
	let c = await getInvoiceByToken(db, params.token);
	if (!c) error(404, 'Fattura non trovata');
	if (request.method === 'GET' && url.searchParams.get('anteprima') !== '1' && c.inv.sent_at) await trackInvoiceOpen(db, c.inv);
	const sid = url.searchParams.get('session_id');
	if (sid && stripeConfigured()) {
		try { const s = await retrieveSession(sid); if (s.paid && s.invoice === c.inv.id && s.seq && c.payments.find((p) => p.seq === s.seq)?.status !== 'pagato') await setInvoicePaymentStatus(db, c.inv.id, s.seq, 'pagato', null, s.ref, 'stripe'); } catch { /* il webhook fara' il resto */ }
	}
	const paid = url.searchParams.get('pagato') === '1';
	if (paid) c = (await getInvoiceByToken(db, params.token)) ?? c;
	const b = c.inv.billing ?? {};
	const addr = [b.company, [b.first_name, b.last_name].filter(Boolean).join(' '), [b.street, b.street2].filter(Boolean).join(', '), [b.zip, b.city, b.province ? `(${b.province})` : ''].filter(Boolean).join(' '), b.vat ? `P.IVA ${b.vat}` : '', b.fiscal_code ? `C.F. ${b.fiscal_code}` : '', b.sdi ? `SDI ${b.sdi}` : ''].filter(Boolean);
	const lines = [...(c.inv.lines ?? [])];
	if (Number(c.inv.express_net) > 0) lines.push({ description: 'Produzione express (+30%)', qty: 1, unit_net: Number(c.inv.express_net), total_net: Number(c.inv.express_net) });
	return {
		inv: { number: c.inv.number, issued_at: c.inv.issued_at, orders: c.inv.order_numbers ?? [], net: Number(c.inv.subtotal_net) - Number(c.inv.discount_net) + Number(c.inv.express_net), vat: Number(c.inv.vat_amount), gross: Number(c.inv.amount_gross), first_name: b.first_name || b.company || '', sender: c.inv.sender_name, notes: c.inv.notes },
		addr, lines,
		payments: c.payments.map((p) => ({ seq: p.seq, method: p.method, due: p.due, amount: Number(p.amount), payable: p.payable, status: p.status, paid_at: p.paid_at })),
		messages: c.messages.map((m) => ({ id: m.id, direction: m.direction, author: m.author, body: m.body, created_at: m.created_at })),
		bank: { iban: COMPANY.iban || null, name: COMPANY.name }, online: onlinePaymentsOn(), simulation: !stripeConfigured() && onlinePaymentsOn(), paid, cancelled: url.searchParams.get('annullato') === '1'
	};
};

export const actions: Actions = {
	domanda: async ({ params, request, url }) => {
		const db = adminClient();
		if (!db) return fail(503, { error: 'Servizio non disponibile.' });
		const e = await invoiceQuestion(db, params.token, String((await request.formData()).get('testo') ?? ''), url.origin);
		return e ? fail(400, { error: e }) : { ok: true, message: 'Messaggio inviato: ti rispondiamo il prima possibile, anche via email.' };
	}
};
