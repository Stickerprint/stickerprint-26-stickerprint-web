import { json } from '@sveltejs/kit';
import { checkDiscount } from '$lib/server/discount';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, locals: { supabase } }) => {
	const { code, subtotalNet, email } = await request.json().catch(() => ({}));
	return json(await checkDiscount(supabase, String(code ?? ''), Number(subtotalNet ?? 0), email ? String(email) : null));
};
