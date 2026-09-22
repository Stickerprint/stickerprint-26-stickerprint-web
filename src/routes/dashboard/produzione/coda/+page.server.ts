import { loadCompletedJobs, loadQueue, loadSetup, recalcIfStale, taskActions } from '$lib/server/produzione';
import type { Actions, PageServerLoad } from './$types';
export const load: PageServerLoad = async ({ locals: { supabase } }) => {
	await recalcIfStale(supabase);
	const [setup, queue, done] = await Promise.all([loadSetup(supabase), loadQueue(supabase), loadCompletedJobs(supabase, 60)]);
	return { setup, queue, done, now: new Date().toISOString() };
};
export const actions: Actions = { ...taskActions };
