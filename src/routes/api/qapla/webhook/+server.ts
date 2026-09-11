import { json } from '@sveltejs/kit';
import { createClient } from '@supabase/supabase-js';
import { env } from '$env/dynamic/private';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';
import { applyQaplaUpdate } from '$lib/server/qapla-status';
import { trackingPageUrl } from '$lib/server/couriers/qapla';
import type { RequestHandler } from './$types';

/**
 * Webhook Qapla' (Impostazioni canale → Aggiornamenti → Webhook tracking, v1.3):
 * a ogni cambio di stato del corriere Qapla' chiama qui; la chiave nel corpo deve essere quella del canale.
 * Risposta attesa da Qapla': {"result":"OK"}. Spedizioni di ordini non nostri (sito vecchio) vengono ignorate.
 */
export const POST: RequestHandler = async ({ request, url }) => {
	let body: Record<string, unknown>;
	try { body = await request.json(); } catch { return json({ result: 'KO', error: 'json' }, { status: 400 }); }
	if (!env.QAPLA_API_KEY || body.apiKey !== env.QAPLA_API_KEY) return json({ result: 'KO', error: 'apiKey' }, { status: 401 });
	const key = env.SUPABASE_SERVICE_ROLE_KEY;
	if (!key) return json({ result: 'OK', skipped: 'no-db' });
	const db = createClient(PUBLIC_SUPABASE_URL, key, { auth: { persistSession: false } });
	try {
		/* webhook "generazione spedizioni": etichetta creata nel pannello Qapla' → tracking sull'ordine */
		if (Array.isArray(body.orders)) {
			let matched = 0;
			for (const o of body.orders as Record<string, unknown>[]) {
				const ref = String(o.reference ?? ''), tn = String(o.trackingNumber ?? '');
				if (!ref || !tn) continue;
				const { data: rows } = await db.from('orders').select('id, checkout_group, tracking_number').eq('number', ref);
				if (!rows?.length) continue;
				matched += rows.length;
				const col = rows[0].checkout_group ? 'checkout_group' : 'id';
				await db.from('orders').update({ tracking_number: tn, tracking_url: trackingPageUrl(tn), labels_generated_at: new Date().toISOString() }).eq(col, rows[0].checkout_group ?? rows[0].id);
			}
			return json({ result: 'OK', matched });
		}
		const r = await applyQaplaUpdate(db, { trackingNumber: String(body.trackingNumber ?? ''), reference: (body.reference as string) ?? null, courier: (body.courier as string) ?? null, date: (body.date as string) ?? null, place: (body.place as string) ?? null, qaplaStatusID: (body.qaplaStatusID as string) ?? '0', qaplaStatus: (body.qaplaStatus as string) ?? null, statusDetails: (body.statusDetails as { id: number; detail: string }[]) ?? [] }, url.origin);
		return json({ result: 'OK', ...r });
	} catch (e) {
		console.error('[qapla webhook]', e);
		return json({ result: 'OK', error: 'internal' }); // OK a Qapla: dopo 100 KO disattiva il webhook
	}
};
export const GET: RequestHandler = async () => json({ result: 'OK', service: 'qapla-webhook' });
