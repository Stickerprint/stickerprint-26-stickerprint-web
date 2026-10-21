import type { Session, SupabaseClient, User } from '@supabase/supabase-js';

declare global {
	namespace App {
		interface Locals {
			locale: import('$lib/i18n').LocaleCode;
			/** lingua che paese e browser suggeriscono (per l'avviso in pagina, mai un redirect) */
			localeSuggerito: import('$lib/i18n').LocaleCode;
			supabase: SupabaseClient;
			safeGetSession: () => Promise<{ session: Session | null; user: User | null }>;
			session: Session | null;
			user: User | null;
		}
		interface PageData {
			session: Session | null;
			user: User | null;
		}
		// interface Error {}
		// interface Platform {}
	}
}

export {};
