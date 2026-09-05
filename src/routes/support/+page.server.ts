import { loadFaq } from '$lib/server/faq';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals: { supabase } }) => {
	return { categories: await loadFaq(supabase) };
};
