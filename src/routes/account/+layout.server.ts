import type { LayoutServerLoad } from './$types';
import type { Loyalty } from '$lib/account';

export const load: LayoutServerLoad = async ({ locals: { supabase, user } }) => {
	const uid = user!.id;
	const [{ data: profile }, { count: ordersCount }, { count: openCount }, { data: delivered }, { data: reviewed }, { data: loyalty }] = await Promise.all([
		supabase.from('profiles').select('full_name, email, created_at, role, avatar_url').eq('id', uid).maybeSingle(),
		supabase.from('orders').select('id', { count: 'exact', head: true }).eq('user_id', uid),
		supabase.from('orders').select('id', { count: 'exact', head: true }).eq('user_id', uid).in('status', ['in_attesa', 'in_produzione', 'spedito']),
		supabase.from('orders').select('id').eq('user_id', uid).eq('status', 'consegnato'),
		supabase.from('reviews').select('order_id').eq('user_id', uid),
		supabase.rpc('loyalty_status')
	]);
	const reviewedIds = new Set((reviewed ?? []).map((r) => r.order_id));
	const toReview = (delivered ?? []).filter((o) => !reviewedIds.has(o.id)).length;
	const name = profile?.full_name || user?.user_metadata?.full_name || user?.email || '';
	return {
		profile: { name, email: profile?.email ?? user?.email ?? '', avatar: profile?.avatar_url ?? null, since: profile?.created_at ? new Date(profile.created_at).getFullYear() : new Date().getFullYear() },
		loyalty: (loyalty ?? null) as Loyalty | null,
		counts: { orders: ordersCount ?? 0, open: openCount ?? 0, toReview }
	};
};
