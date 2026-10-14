import { json } from '@sveltejs/kit';
import { adminClient } from '$lib/server/admin';
import type { RequestHandler } from './$types';

/**
 * Il sito segnala qui ogni "Aggiungi al carrello" (src/lib/cart.ts): una riga in carrello_eventi per la Panoramica marketing.
 * Niente dati personali, niente blocco del cliente: se qualcosa non va si risponde ok lo stesso.
 */
const testo = (v: unknown, max = 120) => (typeof v === 'string' ? v.slice(0, max) : null);
const numero = (v: unknown, max = 1e7) => { const n = Number(v); return Number.isFinite(n) && n >= 0 && n <= max ? Math.round(n * 100) / 100 : 0; };
const SORGENTI = ['configuratore', 'riordino', 'campioni', 'offerta'];

export const POST: RequestHandler = async ({ request, locals: { user } }) => {
	const b = await request.json().catch(() => null);
	if (!b || typeof b !== 'object') return json({ ok: false }, { status: 400 });
	const db = adminClient();
	if (!db) return json({ ok: false, error: 'chiave di servizio mancante' });
	const ua = request.headers.get('user-agent') ?? '';
	const dispositivo = /iPad|Tablet/i.test(ua) ? 'tablet' : /Mobi|Android|iPhone/i.test(ua) ? 'mobile' : 'desktop';
	const riga = {
		visitatore: testo(b.visitatore, 64) || 'sconosciuto', user_id: user?.id ?? null,
		prodotto: testo(b.prodotto, 60) || 'altro', nome: testo(b.nome, 120) ?? '', forma: testo(b.forma, 40), materiale: testo(b.materiale, 40), finitura: testo(b.finitura, 40),
		larghezza_mm: b.larghezza_mm == null ? null : numero(b.larghezza_mm, 5000), altezza_mm: b.altezza_mm == null ? null : numero(b.altezza_mm, 5000),
		qta: Math.max(1, Math.min(1e6, Math.round(Number(b.qta) || 1))), netto: numero(b.netto), lordo: numero(b.lordo),
		sorgente: SORGENTI.includes(String(b.sorgente)) ? String(b.sorgente) : 'configuratore', promo: testo(b.promo, 60), pagina: testo(b.pagina, 200), dispositivo
	};
	const { error } = await db.from('carrello_eventi').insert(riga);
	return json({ ok: !error, error: error?.message });
};
