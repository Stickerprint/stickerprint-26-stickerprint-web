import type { PageServerLoad } from './$types';

/** Conversazioni dell'assistente automatico (Instagram, WhatsApp, sito): sola lettura, per controllare cosa risponde */
export const load: PageServerLoad = async ({ locals: { supabase } }) => {
	const { data } = await supabase.from('bot_conversations').select('id, channel, external_id, name, chat, handed_off, ticket_number, last_at, created_at').order('last_at', { ascending: false }).limit(200);
	return { conversazioni: (data ?? []) as { id: string; channel: string; external_id: string; name: string | null; chat: { da: 'cliente' | 'bot'; testo: string; ora: string; strumenti?: { nome: string }[] }[]; handed_off: boolean; ticket_number: string | null; last_at: string; created_at: string }[] };
};
