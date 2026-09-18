import { error, redirect } from '@sveltejs/kit';
import { loadEngine } from '$lib/server/pricing';
import { STUDIO_PRODUCTS, studioProduct } from '$lib/studio/products';
import type { PageServerLoad } from './$types';

/** file dell'ordine: percorso nel bucket privato -> link firmato; un indirizzo completo resta com'e' */
async function signed(supabase: App.Locals['supabase'], path: string | null | undefined) {
	if (!path) return null;
	if (/^https?:\/\//.test(path)) return path;
	const { data } = await supabase.storage.from('order-files').createSignedUrl(path, 3600);
	return data?.signedUrl ?? null;
}

export const load: PageServerLoad = async ({ params, url, locals: { supabase } }) => {
	let product = studioProduct(params.product);
	if (!product) error(404, 'Prodotto non trovato');

	/* aperto dalla dashboard: /studio/<prodotto>?ordine=<id> */
	const orderId = url.searchParams.get('ordine');
	let order: null | {
		id: string; number: string; productName: string; forma: string | null; materiale: string | null; finitura: string | null;
		w: number; h: number; qty: number; fileUrl: string | null; fileName: string | null; previewUrl: string | null; engineState: Record<string, unknown> | null; folder: boolean;
	} = null;
	if (orderId) {
		const { data: o } = await supabase.from('orders').select('*').eq('id', orderId).maybeSingle();
		if (!o) error(404, 'Ordine non trovato');
		// il prodotto giusto per quell'ordine
		const target = o.product_slug === 'kit_adesivi' ? 'kit-adesivi' : STUDIO_PRODUCTS.find((p) => p.engineSlug === o.product_slug && !p.kit)?.id;
		if (target && target !== product.id) redirect(303, `/studio/${target}?ordine=${orderId}`);
		product = studioProduct(target ?? product.id) ?? product;
		const folder = typeof o.file_path === 'string' && o.file_path.endsWith('/');
		order = {
			id: o.id, number: o.number, productName: o.product_name, forma: o.forma, materiale: o.materiale, finitura: o.finitura,
			w: Number(o.width_mm) || 0, h: Number(o.height_mm) || 0, qty: Number(o.qty) || 0,
			fileUrl: folder ? null : await signed(supabase, o.file_path),
			fileName: typeof o.file_path === 'string' ? (o.file_path.split('/').pop() || null) : null,
			previewUrl: await signed(supabase, o.proof_url ?? o.preview_url),
			engineState: (o.engine_state as Record<string, unknown> | null) ?? null,
			folder
		};
	}
	const { config } = await loadEngine(supabase, product.engineSlug);
	return { product, cfg: config, order };
};
