import { fail } from '@sveltejs/kit';
import { addStaffReview, deleteReview, listReviewRequests, listReviews, setReviewStatus } from '$lib/server/recensioni';
import type { Actions, PageServerLoad } from './$types';

/** Recensioni: da approvare, pubblicate, rifiutate; inserimento di recensioni ricevute altrove */
export const load: PageServerLoad = async ({ locals: { supabase } }) => { const [reviews, requests] = await Promise.all([listReviews(supabase), listReviewRequests(supabase)]); return { reviews, requests }; };

export const actions: Actions = {
	stato: async ({ request, locals: { supabase } }) => {
		const f = await request.formData();
		const e = await setReviewStatus(supabase, String(f.get('id')), String(f.get('status')) as 'approved');
		return e ? fail(400, { error: e }) : { ok: true, message: 'Recensione aggiornata.' };
	},
	aggiungi: async ({ request, locals: { supabase } }) => {
		const f = await request.formData();
		const e = await addStaffReview(supabase, { author: String(f.get('author') ?? ''), rating: Number(f.get('rating') ?? 5), comment: String(f.get('comment') ?? ''), title: String(f.get('title') ?? ''), productSlug: String(f.get('product_slug') ?? '') || null, sourceNote: String(f.get('source_note') ?? ''), date: String(f.get('date') ?? '') || null });
		return e ? fail(400, { error: e }) : { ok: true, message: 'Recensione pubblicata.' };
	},
	elimina: async ({ request, locals: { supabase } }) => {
		const e = await deleteReview(supabase, String((await request.formData()).get('id')));
		return e ? fail(400, { error: e }) : { ok: true, message: 'Recensione eliminata.' };
	}
};
