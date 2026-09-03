import type { Invoice } from '$lib/account';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals: { supabase, user } }) => {
	const { data } = await supabase.from('invoices').select('id, order_id, number, issued_at, amount_gross, pdf_path, order:orders(number)').eq('user_id', user!.id).order('issued_at', { ascending: false });
	type Row = Invoice & { order: { number: string } | { number: string }[] | null };
	const invoices = ((data ?? []) as unknown as Row[]).map((r) => ({ ...r, order_number: Array.isArray(r.order) ? r.order[0]?.number : r.order?.number }));
	return { invoices };
};
