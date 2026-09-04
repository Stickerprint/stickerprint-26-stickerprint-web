import webpush from 'web-push';
import { createClient } from '@supabase/supabase-js';
import { env } from '$env/dynamic/private';
import { PUBLIC_SUPABASE_URL, PUBLIC_VAPID_KEY } from '$env/static/public';

/** Notifica push a tutti i dispositivi dello staff (nuovo ordine). Silenziosa se le chiavi mancano. */
export async function pushStaff(payload: { title: string; body: string; url?: string; tag?: string }) {
	const priv = env.VAPID_PRIVATE_KEY;
	const service = env.SUPABASE_SERVICE_ROLE_KEY;
	if (!priv || !PUBLIC_VAPID_KEY || !service) return { sent: 0, skipped: true };
	webpush.setVapidDetails(env.VAPID_SUBJECT || 'mailto:info@stickerprint.it', PUBLIC_VAPID_KEY, priv);
	const admin = createClient(PUBLIC_SUPABASE_URL, service, { auth: { persistSession: false } });
	const { data: subs } = await admin.from('push_subscriptions').select('id, endpoint, keys');
	let sent = 0;
	for (const s of subs ?? []) {
		try {
			await webpush.sendNotification({ endpoint: s.endpoint, keys: s.keys as { p256dh: string; auth: string } }, JSON.stringify(payload), { TTL: 3600 });
			sent++;
		} catch (e) {
			const code = (e as { statusCode?: number }).statusCode;
			if (code === 404 || code === 410) await admin.from('push_subscriptions').delete().eq('id', s.id);
		}
	}
	return { sent, skipped: false };
}
