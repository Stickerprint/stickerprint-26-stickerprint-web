import { json } from '@sveltejs/kit';
import { createClient } from '@supabase/supabase-js';
import { env } from '$env/dynamic/private';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';
import { applyQaplaUpdate } from '$lib/server/qapla-status';
import { qaplaGet } from '$lib/server/couriers/qapla';
import type { RequestHandler } from './$types';

/**
 * Rete di sicurezza del webhook: ogni ora (cron Vercel) rilegge da Qapla' lo stato delle spedizioni
 * ancora in viaggio. Autorizzazione: header Authorization "Bearer <CRON_SECRET>" (Vercel) o x-internal-key.
 */
export const GET: RequestHandler = async ({ request, url }) => {
	const auth = request.headers.get('authorization') ?? '';
	const ok = (env.CRON_SECRET && auth === `Bearer ${env.CRON_SECRET}`) || (env.INTERNAL_API_KEY && request.headers.get('x-internal-key') === env.INTERNAL_API_KEY);
	if (!ok) return json({ error: 'unauthorized' }, { status: 401 });
	if (!env.QAPLA_API_KEY || !env.SUPABASE_SERVICE_ROLE_KEY) return json({ skipped: true });
	const db = createClient(PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
	const { data } = await db.from('orders').select('tracking_number, checkout_group').eq('courier', 'Qapla').in('status', ['in_spedizione', 'spedito', 'in_consegna']).not('tracking_number', 'is', null);
	const trackings = [...new Set((data ?? []).map((r) => r.tracking_number as string))].slice(0, 100);
	const out: Record<string, unknown> = {};
	for (const t of trackings) {
		try {
			const s = await qaplaGet<{ shipment?: Record<string, unknown> } & Record<string, unknown>>('getShipment', { trackingNumber: t });
			const sh = (s.shipment ?? s) as Record<string, unknown>;
			const st = (sh.status ?? sh) as Record<string, unknown>;
			const id = Number(st.statusID ?? sh.qaplaStatusID ?? st.id ?? NaN);
			if (!Number.isFinite(id)) { out[t] = 'stato non letto'; continue; }
			out[t] = await applyQaplaUpdate(db, { trackingNumber: t, reference: (sh.reference as string) ?? null, courier: ((sh.courier as Record<string, string>)?.code ?? (sh.courier as string)) ?? null, date: (st.date as string) ?? null, place: (st.place as string) ?? null, qaplaStatusID: id, qaplaStatus: (st.status as string) ?? null, statusDetails: st.statusDetailID ? [{ id: Number(st.statusDetailID), detail: String(st.statusDetail ?? '') }] : [] }, url.origin);
		} catch (e) { out[t] = e instanceof Error ? e.message : 'errore'; }
	}
	return json({ checked: trackings.length, out });
};
