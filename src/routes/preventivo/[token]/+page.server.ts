import { error, fail } from '@sveltejs/kit';
import { adminClient } from '$lib/server/admin';
import { acceptQuoteByToken, getQuoteByToken, loadQuoteMessages, quoteQuestionByToken, rejectQuoteByToken, trackQuoteOpen } from '$lib/server/richieste';
import { loadReviews } from '$lib/server/reviews';
import { categoryOf, type ProductCode } from '$lib/dashboard/orderDraft';
import { PRODUCTS } from '$lib/products';
import { CATS } from '$lib/dashboard/orders';
import type { Actions, PageServerLoad } from './$types';

/** Pagina pubblica del preventivo: anteprima con i mockup, riepilogo, conferma con un clic, PDF, domande. Ogni apertura viene registrata. */
export const load: PageServerLoad = async ({ params, url, request }) => {
	const db = adminClient();
	if (!db) error(503, 'Servizio non disponibile');
	const q = await getQuoteByToken(db, params.token);
	if (!q) error(404, 'Preventivo non trovato');
	// l'anteprima dello staff (?anteprima=1) non conta come apertura del cliente
	// (il ricaricamento dopo una domanda o una conferma e' una POST: non conta)
	if (request.method === 'GET' && url.searchParams.get('anteprima') !== '1' && (q.status === 'inviato' || q.status === 'accettato')) await trackQuoteOpen(db, q);
	const [{ data: codes }, { stats }, messages] = await Promise.all([
		db.from('product_codes').select('*').eq('active', true),
		loadReviews(db),
		loadQuoteMessages(db, q.id)
	]);
	const items = q.draft.items.filter((i) => Number(i.qty) > 0).map((i) => {
		const slug = categoryOf(i.code, (codes ?? []) as ProductCode[]) ?? 'adesivi_personalizzati';
		const product = PRODUCTS[slug];
		return { code: i.code, description: i.description, qty: Number(i.qty), price: Number(i.price), total: Math.round(Number(i.qty) * Number(i.price) * 100) / 100, lamination: i.lamination, image: i.mockup_url ?? i.preview_url ?? product?.gallery?.[0] ?? null, isMockup: !!(i.mockup_url ?? i.preview_url), category: CATS[slug]?.name ?? product?.name ?? slug };
	});
	const d = q.draft;
	return {
		q: { number: q.number, version: q.version, status: q.status, total_net: Number(q.total_net), total_gross: Number(q.total_gross), valid_until: q.valid_until, sent_at: q.sent_at, accepted_at: q.accepted_at, sender_name: q.sender_name, created_at: q.created_at },
		customer: { name: d.customer.name, first_name: d.customer.first_name, city: d.customer.city },
		items, lordi: d.price_type === 'lordi', terms: [...new Set((d.terms ?? []).map((t) => t.method))], shipMethod: d.ship_method, shipDate: d.ship_date || null,
		stats, messages: messages.map((m) => ({ id: m.id, direction: m.direction, author: m.author, body: m.body, created_at: m.created_at }))
	};
};

const withDb = <T>(fn: (db: NonNullable<ReturnType<typeof adminClient>>) => Promise<T>) => { const db = adminClient(); return db ? fn(db) : Promise.resolve(fail(503, { error: 'Servizio non disponibile.' })); };
export const actions: Actions = {
	accetta: async ({ params, request, url }) => withDb(async (db) => {
		const f = await request.formData();
		const r = await acceptQuoteByToken(db, params.token, String(f.get('nome') ?? '').trim(), url.origin);
		return r.ok ? { ok: true, accepted: true, message: r.message } : fail(400, { error: r.message });
	}),
	rifiuta: async ({ params, request }) => withDb(async (db) => {
		const f = await request.formData();
		const r = await rejectQuoteByToken(db, params.token, String(f.get('motivo') ?? ''));
		return r.ok ? { ok: true, rejected: true, message: r.message } : fail(400, { error: r.message });
	}),
	domanda: async ({ params, request, url }) => withDb(async (db) => {
		const f = await request.formData();
		const e = await quoteQuestionByToken(db, params.token, String(f.get('testo') ?? ''), url.origin);
		return e ? fail(400, { error: e }) : { ok: true, asked: true, message: 'Domanda inviata: ti rispondiamo il prima possibile, anche via email.' };
	}),
	aggiorna: async ({ params, request, url }) => withDb(async (db) => {
		const f = await request.formData();
		const e = await quoteQuestionByToken(db, params.token, String(f.get('testo') ?? ''), url.origin, 'aggiornamento');
		return e ? fail(400, { error: e }) : { ok: true, asked: true, message: 'Richiesta inviata: ti mandiamo un preventivo aggiornato.' };
	})
};
