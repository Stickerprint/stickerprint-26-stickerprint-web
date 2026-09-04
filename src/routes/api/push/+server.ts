import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

/** Salva (o rimuove) l'iscrizione push del dispositivo dello staff */
export const POST: RequestHandler = async ({ request, locals: { supabase, user } }) => {
	if (!user) return json({ ok: false, error: 'non autenticato' }, { status: 401 });
	const { subscription, device } = await request.json().catch(() => ({}));
	if (!subscription?.endpoint) return json({ ok: false, error: 'iscrizione mancante' }, { status: 400 });
	const { error } = await supabase.from('push_subscriptions').upsert({ user_id: user.id, endpoint: subscription.endpoint, keys: subscription.keys, device: String(device ?? '').slice(0, 200) }, { onConflict: 'endpoint' });
	if (error) return json({ ok: false, error: error.message }, { status: 400 });
	return json({ ok: true });
};
export const DELETE: RequestHandler = async ({ request, locals: { supabase, user } }) => {
	if (!user) return json({ ok: false }, { status: 401 });
	const { endpoint } = await request.json().catch(() => ({}));
	await supabase.from('push_subscriptions').delete().eq('endpoint', String(endpoint ?? ''));
	return json({ ok: true });
};
