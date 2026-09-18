import { redirect } from '@sveltejs/kit';
import { dev } from '$app/environment';
import { env as privateEnv } from '$env/dynamic/private';
import type { LayoutServerLoad } from './$types';

/** Stickerprint Studio: solo staff e admin, con lo stesso login della dashboard. */
export const load: LayoutServerLoad = async ({ locals: { supabase, session, user }, url }) => {
	// in sviluppo (npm run dev, solo sul proprio computer) si entra senza login per le prove
	if (dev && !session && privateEnv.STUDIO_DEV_OPEN === '1') return { fullName: 'Prova locale' };
	const back = `/dashboard/login?next=${encodeURIComponent(url.pathname + url.search)}`;
	if (!session || !user) redirect(303, back);
	const { data: profile } = await supabase.from('profiles').select('role, full_name').eq('id', user.id).maybeSingle();
	if (!profile || !['admin', 'staff'].includes(profile.role)) redirect(303, back);
	return { fullName: (profile.full_name as string | null) ?? null };
};
