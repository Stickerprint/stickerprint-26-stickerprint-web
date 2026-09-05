import { fail } from '@sveltejs/kit';
import { saveRequest } from '$lib/server/requests';
import { loadReviews } from '$lib/server/reviews';
import type { Actions, PageServerLoad } from './$types';

// le stelle sotto "+580 aziende servite": stesse recensioni della home
export const load: PageServerLoad = async ({ locals: { supabase } }) => {
	const { stats } = await loadReviews(supabase);
	return { stats };
};

export const actions: Actions = {
	default: async ({ request, locals: { supabase } }) => {
		const f = await request.formData();
		const s = (k: string) => String(f.get(k) ?? '').trim();
		if (!s('name') || !s('company')) return fail(400, { error: 'Nome e azienda sono obbligatori.' });
		const r = await saveRequest(supabase, 'aziende', f, { name: s('name'), company: s('company'), email: s('email'), phone: s('phone'), message: s('message') });
		if (!r.ok) return fail(400, { error: r.error });
		return { ok: true };
	}
};
