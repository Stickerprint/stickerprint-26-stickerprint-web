/**
 * Recensioni: invio (ospiti e registrati) con codice sconto personale, approvazione in dashboard, inserimento dallo staff.
 * Il codice e' 10% sul prossimo ordine, minimo 50 € IVA inclusa, valido 6 mesi, monouso, legato all'email di chi recensisce.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { sendEmail } from './email';
import { reviewThanksEmail } from './email-templates';
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
export async function submitReview(db: DB, o: { orderId: string; userId: string | null; email: string | null; author: string | null; productSlug: string | null; rating: number; title: string | null; comment: string | null; number: string; origin: string }): Promise<{ ok: true; code: string | null } | { ok: false; error: string }> {
	const rating = Math.max(1, Math.min(5, Math.round(o.rating)));
	const { data, error } = await db.from('reviews').insert({ user_id: o.userId, order_id: o.orderId, rating, title: o.title?.slice(0, 120) || null, comment: o.comment?.slice(0, 2000) || null, author: o.author, email: o.email?.toLowerCase() || null, product_slug: o.productSlug, status: 'pending', source: 'cliente' }).select('id').single();
	if (error || !data) return { ok: false, error: /duplicate|unique/i.test(error?.message ?? '') ? 'Hai già lasciato una recensione per questo ordine, grazie!' : (error?.message ?? 'Errore') };
	const code = await issueReviewCoupon(db, data.id, o.email);
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
