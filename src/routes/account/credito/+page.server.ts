import type { CreditTx } from '$lib/account';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals: { supabase, user } }) => {
	const [{ data: tx }, { data: balance }] = await Promise.all([
		supabase.from('credit_transactions').select('*').eq('user_id', user!.id).order('created_at', { ascending: false }),
		supabase.rpc('my_credit_balance')
	]);
	const all = (tx ?? []) as CreditTx[];
	const next = all.filter((t) => t.kind === 'earn' && t.expires_at && new Date(t.expires_at) > new Date()).map((t) => t.expires_at!).sort()[0] ?? null;
	return { tx: all, balance: Number(balance ?? 0), nextExpiry: next };
};
