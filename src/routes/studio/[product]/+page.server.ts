import { error } from '@sveltejs/kit';
import { loadEngine } from '$lib/server/pricing';
import { studioProduct } from '$lib/studio/products';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals: { supabase } }) => {
	const product = studioProduct(params.product);
	if (!product) error(404, 'Prodotto non trovato');
	const { config } = await loadEngine(supabase, product.engineSlug);
	return { product, cfg: config };
};
