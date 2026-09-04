import { courierStatus } from '$lib/server/couriers';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals: { supabase } }) => {
	const { data } = await supabase.from('courier_manifests').select('id, courier, number, day, shipments, transmitted_at').order('transmitted_at', { ascending: false }).limit(30);
	return { couriers: courierStatus(), manifests: (data ?? []).map((m) => ({ ...m, count: Array.isArray(m.shipments) ? m.shipments.length : 0 })) };
};
