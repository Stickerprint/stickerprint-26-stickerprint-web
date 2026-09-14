import { error, fail } from '@sveltejs/kit';
import { adminClient } from '$lib/server/admin';
import { customerMessage, getByToken, trackOpen } from '$lib/server/conferme';
import { loadReviews } from '$lib/server/reviews';
import { COMPANY } from '$lib/server/company';
import { PRODUCTS } from '$lib/products';
import { CATS, itemMeta, thumbOf } from '$lib/dashboard/orders';
import { env } from '$env/dynamic/private';
import type { Actions, PageServerLoad } from './$types';

/** Pagina pubblica della conferma d'ordine: articoli, indirizzi, scadenze con pagamento, PDF, domande e segnalazioni. */
export const load: PageServerLoad = async ({ params, url, request }) => {
	const db = adminClient();
	if (!db) error(503, 'Servizio non disponibile');
	const c = await getByToken(db, params.token);
	if (!c) error(404, 'Conferma non trovata');
	if (request.method === 'GET' && url.searchParams.get('anteprima') !== '1' && c.conf.sent_at) await trackOpen(db, c.conf);
	const { stats } = await loadReviews(db);
	const g = c.group;
	const f = g.items[0];
	const addr = (a: Record<string, string> | null) => (a ? [a.company, [a.first_name, a.last_name].filter(Boolean).join(' '), [a.street, a.street2].filter(Boolean).join(', '), [a.zip, a.city, a.province ? `(${a.province})` : ''].filter(Boolean).join(' ')].filter(Boolean) : []);
	return {
		order: { number: g.number, status: g.status, created_at: g.created_at, delivery_date: g.delivery_date, shipping_method: g.shipping_method, net: g.net, gross: g.gross, customer: g.customer, first_name: f.billing?.first_name || f.shipping?.first_name || '' },
		items: g.items.map((i) => ({ id: i.id, name: i.product_name, description: i.description || itemMeta(i), qty: i.qty, unit: Number(i.unit_net ?? Number(i.total_net) / i.qty), total: Number(i.total_net), image: thumbOf(i) ?? PRODUCTS[i.product_slug]?.gallery?.[0] ?? null, isMockup: !!thumbOf(i), category: CATS[i.product_slug]?.name ?? i.product_name })),
		billing: addr(f.billing), shipping: addr(f.shipping), vat: f.billing?.vat ?? null,
		payments: c.payments.map((p) => ({ seq: p.seq, method: p.method, due: p.due, amount: Number(p.amount), upfront: p.upfront, status: p.status, paid_at: p.paid_at })),
		sender: c.conf.sender_name, messages: c.messages.map((m) => ({ id: m.id, direction: m.direction, kind: m.kind, author: m.author, body: m.body, created_at: m.created_at })),
		bank: { iban: COMPANY.iban || null, name: COMPANY.name }, online: !!env.STRIPE_SECRET_KEY, stats
	};
};

const withDb = <T>(fn: (db: NonNullable<ReturnType<typeof adminClient>>) => Promise<T>) => { const db = adminClient(); return db ? fn(db) : Promise.resolve(fail(503, { error: 'Servizio non disponibile.' })); };
export const actions: Actions = {
	domanda: async ({ params, request, url }) => withDb(async (db) => {
		const e = await customerMessage(db, params.token, String((await request.formData()).get('testo') ?? ''), 'domanda', url.origin);
		return e ? fail(400, { error: e }) : { ok: true, message: 'Domanda inviata: ti rispondiamo il prima possibile, anche via email.' };
	}),
	errore: async ({ params, request, url }) => withDb(async (db) => {
		const e = await customerMessage(db, params.token, String((await request.formData()).get('testo') ?? ''), 'errore', url.origin);
		return e ? fail(400, { error: e }) : { ok: true, message: 'Segnalazione ricevuta: fermiamo tutto finché non è sistemata e ti scriviamo.' };
	})
};
