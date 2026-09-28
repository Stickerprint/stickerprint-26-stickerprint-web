/**
 * Recensioni: invio (ospiti e registrati) con codice sconto personale, approvazione in dashboard, inserimento dallo staff.
 * Il codice e' 10% sul prossimo ordine, minimo 50 € IVA inclusa, valido 6 mesi, monouso, legato all'email di chi recensisce.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { sendEmail } from './email';
import { reviewRequestEmail, reviewThanksEmail } from './email-templates';
import { invalidateReviews } from './reviews';

type DB = SupabaseClient;
export const REVIEW_COUPON = { percent: 10, minNet: 41, months: 6 }; // 41 € imponibile = 50 € IVA inclusa

function makeCode(): string {
	const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
	let s = '';
	for (let i = 0; i < 6; i++) s += A[Math.floor(Math.random() * A.length)];
	return `GRAZIE-${s}`;
}
/** Codice personale monouso per la recensione: 10% sul prossimo ordine, 6 mesi, minimo 50 € IVA inclusa */
export async function issueReviewCoupon(db: DB, reviewId: string, email: string | null): Promise<string | null> {
	const validTo = new Date(); validTo.setMonth(validTo.getMonth() + REVIEW_COUPON.months);
	for (let i = 0; i < 5; i++) {
		const code = makeCode();
		const { error } = await db.from('discount_codes').insert({ code, description: 'Grazie per la recensione', kind: 'percent', value: REVIEW_COUPON.percent, min_order: REVIEW_COUPON.minNet, max_uses: 1, active: true, valid_to: validTo.toISOString(), bound_email: email?.toLowerCase() || null, review_id: reviewId });
		if (!error) { await db.from('reviews').update({ coupon_code: code }).eq('id', reviewId); return code; }
		if (error.code !== '23505') { console.error('[recensioni] coupon', error.message); return null; }
	}
	return null;
}
/** Salva la recensione (in attesa di approvazione), genera il codice e manda l'email di ringraziamento */
export async function submitReview(db: DB, o: { orderId: string; userId: string | null; email: string | null; author: string | null; productSlug: string | null; rating: number; title: string | null; comment: string | null; number: string; origin: string; groupOrderIds?: string[]; checkoutGroup?: string | null; requestId?: string | null }): Promise<{ ok: true; code: string | null } | { ok: false; error: string }> {
	const rating = Math.max(1, Math.min(5, Math.round(o.rating)));
	/* una recensione per ordine (numero), anche se l'ordine ha piu' articoli */
	if (o.groupOrderIds?.length) { const { data: prev } = await db.from('reviews').select('id').in('order_id', o.groupOrderIds).limit(1); if (prev?.length) return { ok: false, error: 'Hai già lasciato una recensione per questo ordine, grazie!' }; }
	const { data, error } = await db.from('reviews').insert({ user_id: o.userId, order_id: o.orderId, rating, title: o.title?.slice(0, 120) || null, comment: o.comment?.slice(0, 2000) || null, author: o.author, email: o.email?.toLowerCase() || null, product_slug: o.productSlug, status: 'pending', source: 'cliente' }).select('id').single();
	if (error || !data) return { ok: false, error: /duplicate|unique/i.test(error?.message ?? '') ? 'Hai già lasciato una recensione per questo ordine, grazie!' : (error?.message ?? 'Errore') };
	const code = await issueReviewCoupon(db, data.id, o.email);
	await linkReviewToRequest(db, { orderId: o.orderId, groupOrderIds: o.groupOrderIds ?? null, checkoutGroup: o.checkoutGroup ?? null, requestId: o.requestId ?? null }, data.id).catch(() => {});
	if (o.email && code) {
		const validTo = new Date(); validTo.setMonth(validTo.getMonth() + REVIEW_COUPON.months);
		await sendEmail({ to: o.email, ...reviewThanksEmail({ name: o.author?.split(' ')[0] ?? null, number: o.number, code, validUntil: validTo.toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' }), href: `${o.origin}/` }), metadata: { order: o.number } });
	}
	return { ok: true, code };
}

export interface ReviewRow { id: string; user_id: string | null; order_id: string | null; rating: number; title: string | null; comment: string | null; is_public: boolean; status: 'pending' | 'approved' | 'rejected'; source: 'cliente' | 'staff'; source_note: string | null; product_slug: string | null; author: string | null; email: string | null; coupon_code: string | null; created_at: string; reviewed_at: string | null; order?: { number: string; product_name: string; shipping: Record<string, string> | null } | null; profile?: { full_name: string | null } | null }
export async function listReviews(db: DB): Promise<ReviewRow[]> {
	const { data } = await db.from('reviews').select('*, order:orders(number, product_name, shipping), profile:profiles(full_name)').order('created_at', { ascending: false }).limit(500);
	return (data ?? []) as ReviewRow[];
}
export async function setReviewStatus(db: DB, id: string, status: 'approved' | 'rejected' | 'pending'): Promise<string | null> {
	const { error } = await db.from('reviews').update({ status, reviewed_at: new Date().toISOString(), is_public: status === 'approved' }).eq('id', id);
	invalidateReviews();
	return error?.message ?? null;
}
/** Recensione inserita dallo staff (ricevuta altrove: Google, email, WhatsApp): pubblicata subito, con la fonte annotata */
export async function addStaffReview(db: DB, o: { author: string; rating: number; comment: string; title?: string | null; productSlug: string | null; sourceNote: string | null; date?: string | null }): Promise<string | null> {
	if (!o.author.trim() || !o.comment.trim()) return 'Nome e testo sono obbligatori.';
	const { error } = await db.from('reviews').insert({ author: o.author.trim(), rating: Math.max(1, Math.min(5, Math.round(o.rating))), title: o.title?.trim() || null, comment: o.comment.trim(), product_slug: o.productSlug, status: 'approved', is_public: true, source: 'staff', source_note: o.sourceNote?.trim() || null, reviewed_at: new Date().toISOString(), ...(o.date ? { created_at: new Date(o.date + 'T12:00:00').toISOString() } : {}) });
	invalidateReviews();
	return error?.message ?? null;
}
export async function deleteReview(db: DB, id: string): Promise<string | null> {
	const { error } = await db.from('reviews').delete().eq('id', id);
	invalidateReviews();
	return error?.message ?? null;
}
export async function pendingReviews(db: DB): Promise<number> {
	const { count } = await db.from('reviews').select('id', { count: 'exact', head: true }).eq('status', 'pending');
	return count ?? 0;
}

/* ---------- richieste di recensione inviate via email ---------- */
export interface ReviewRequestRow { id: string; order_id: string | null; checkout_group: string | null; number: string; email: string; name: string | null; sent_at: string; tracked: boolean; opened_count: number; first_opened_at: string | null; last_opened_at: string | null; clicked_at: string | null; review_id: string | null; review?: { rating: number; status: string } | null }
export async function listReviewRequests(db: DB): Promise<ReviewRequestRow[]> {
	const { data } = await db.from('review_requests').select('*, review:reviews(rating, status)').order('sent_at', { ascending: false }).limit(500);
	return (data ?? []) as ReviewRequestRow[];
}
/** Registra l'invio (prima di mandare la mail, cosi' il pixel e i link hanno gia' l'id) */
export async function createReviewRequest(db: DB, o: { orderId: string | null; checkoutGroup: string | null; number: string; email: string; name: string | null }): Promise<string | null> {
	const { data } = await db.from('review_requests').insert({ order_id: o.orderId, checkout_group: o.checkoutGroup, number: o.number, email: o.email, name: o.name }).select('id').single();
	return data?.id ?? null;
}
/** Il cliente ha aperto la pagina della recensione dal link dell'email */
export async function markReviewRequestClicked(db: DB, id: string | null): Promise<void> {
	if (!id || !/^[0-9a-f-]{36}$/.test(id)) return;
	await db.from('review_requests').update({ clicked_at: new Date().toISOString() }).eq('id', id).is('clicked_at', null);
}
/** Collega la recensione ricevuta alla richiesta inviata: per id della richiesta (link dell'email), per ordine o per gruppo */
export async function linkReviewToRequest(db: DB, o: { orderId: string; groupOrderIds: string[] | null; checkoutGroup: string | null; requestId: string | null }, reviewId: string): Promise<void> {
	const ors = [`order_id.eq.${o.orderId}`];
	if (o.groupOrderIds?.length) ors.push(`order_id.in.(${o.groupOrderIds.join(',')})`);
	if (o.checkoutGroup) ors.push(`checkout_group.eq.${o.checkoutGroup}`);
	if (o.requestId && /^[0-9a-f-]{36}$/.test(o.requestId)) ors.push(`id.eq.${o.requestId}`);
	await db.from('review_requests').update({ review_id: reviewId }).or(ors.join(',')).is('review_id', null);
}

/* ---------- richiesta di recensione (cron e dashboard usano questa) ---------- */
type RigaOrdine = { id: string; number: string; checkout_group: string | null; user_id: string | null; email: string | null; shipping: { first_name?: string } | null; product_name: string; qty: number; preview_url?: string | null; proof_url?: string | null; mockup_url?: string | null };

/** manda la richiesta di recensione per UN ordine (tutte le sue righe) e segna la data */
export async function inviaRichiestaRecensione(db: DB, rows: RigaOrdine[], origin: string): Promise<{ ok: boolean; message: string }> {
	const f = rows[0];
	if (!f?.email) return { ok: false, message: 'Questo ordine non ha un indirizzo email.' };
	const k = f.checkout_group ?? f.id;
	const reqId = await createReviewRequest(db, { orderId: f.id, checkoutGroup: f.checkout_group ?? null, number: f.number, email: f.email, name: f.shipping?.first_name ?? null });
	const q = reqId ? `?r=${reqId}` : '';
	const href = f.user_id ? `${origin}/account/recensioni${q}` : `${origin}/recensione/${f.checkout_group ?? f.id}${q}`;
	const mail = reviewRequestEmail({ name: f.shipping?.first_name ?? null, number: f.number, items: rows.map((r) => ({ name: r.product_name, qty: r.qty, preview: r.proof_url ?? r.preview_url ?? r.mockup_url ?? null })), href });
	const html = reqId ? mail.html.replace('</body>', `<img src="${origin}/api/track/open/${reqId}" width="1" height="1" alt="" style="display:block;width:1px;height:1px;border:0;"></body>`) : mail.html;
	const r = await sendEmail({ to: f.email, subject: mail.subject, html, tag: mail.tag, metadata: { order: f.number } });
	if (!r.ok) {
		if (reqId) await db.from('review_requests').delete().eq('id', reqId);
		return { ok: false, message: `Postmark non ha accettato l'email: ${r.error ?? 'errore sconosciuto'}` };
	}
	await db.from('orders').update({ review_asked_at: new Date().toISOString() }).eq(f.checkout_group ? 'checkout_group' : 'id', k);
	if (reqId && r.messageId) await db.from('review_requests').update({ message_id: r.messageId }).eq('id', reqId);
	return { ok: true, message: `Richiesta di recensione inviata a ${f.email} per l'ordine ${f.number}.` };
}
