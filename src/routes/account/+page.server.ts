import { loadOrders } from '$lib/server/account';
import type { CreditTx } from '$lib/account';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals: { supabase, user } }) => {
	const uid = user!.id;
	const [{ orders, engines }, { data: tx }, { data: balance }] = await Promise.all([
		loadOrders(supabase, uid, 3),
		supabase.from('credit_transactions').select('*').eq('user_id', uid).order('created_at', { ascending: false }).limit(6),
		supabase.rpc('my_credit_balance')
	]);
	const all = (tx ?? []) as CreditTx[];
	const year = new Date().getFullYear();
	return {
		orders, engines, tx: all,
		credit: {
			balance: Number(balance ?? 0),
			earned: all.filter((t) => t.amount > 0).reduce((s, t) => s + Number(t.amount), 0),
			used: all.filter((t) => t.amount < 0).reduce((s, t) => s - Number(t.amount), 0),
			earnedYear: all.filter((t) => t.amount > 0 && new Date(t.created_at).getFullYear() === year).reduce((s, t) => s + Number(t.amount), 0)
		}
	};
};
