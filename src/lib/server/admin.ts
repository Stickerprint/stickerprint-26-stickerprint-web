import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env } from '$env/dynamic/private';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';

/** Client con chiave di servizio (solo server): pagine pubbliche che leggono per token (preventivi, ticket) e scritture fuori dalle RLS. */
export function adminClient(): SupabaseClient | null {
	const key = env.SUPABASE_SERVICE_ROLE_KEY;
	return key ? createClient(PUBLIC_SUPABASE_URL, key, { auth: { persistSession: false } }) : null;
}
