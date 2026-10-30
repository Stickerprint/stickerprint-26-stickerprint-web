import type { SupabaseClient } from '@supabase/supabase-js';
import { LOCALES, formatAmount, toCurrency, type LocaleCode } from '$lib/i18n';
import { t } from '$lib/traduzioni';

export interface DiscountResult { ok: true; code: string; kind: 'percent' | 'fixed'; value: number; amount: number; description: string | null }
/** Verifica un codice sconto e calcola l'importo sull'imponibile. I messaggi (e l'importo minimo, nella valuta) sono nella lingua del locale. */
export async function checkDiscount(supabase: SupabaseClient, code: string, subtotalNet: number, email?: string | null, locale: LocaleCode = 'it', userId?: string | null): Promise<DiscountResult | { ok: false; error: string }> {
	const msg = (k: string, params?: Record<string, string | number>) => t(locale, `checkout.codice.${k}`, params);
	const c = code.trim().toUpperCase();
	if (!c) return { ok: false, error: msg('inserisci') };
	const { data } = await supabase.from('discount_codes').select('*').ilike('code', c).eq('active', true).maybeSingle();
	if (!data) return { ok: false, error: msg('nonValido') };
	const now = Date.now();
	if (data.valid_from && new Date(data.valid_from).getTime() > now) return { ok: false, error: msg('nonAttivo') };
	if (data.valid_to && new Date(data.valid_to).getTime() < now) return { ok: false, error: msg('scaduto') };
	if (data.max_uses != null && data.uses >= data.max_uses) return { ok: false, error: msg('esaurito') };
	if (data.bound_email && email && data.bound_email.toLowerCase() !== email.trim().toLowerCase()) return { ok: false, error: msg('personale') };
	/* una volta sola per cliente (dal 30/10/2026): se l'account o l'email hanno gia' un ordine con questo codice, niente.
	   Chi non ha ancora scritto l'email passa il primo controllo del carrello e viene fermato all'invio dell'ordine. */
	if (data.once_per_customer !== false && (userId || (email && email.trim()))) {
		const { data: n, error } = await supabase.rpc('discount_code_customer_uses', { p_code: data.code, p_email: email?.trim() || null, p_user: userId ?? null });
		if (!error && Number(n) > 0) return { ok: false, error: msg('giaUsato') };
	}
	if (subtotalNet < Number(data.min_order)) {
		/* minimo in euro netti: in dollari al cambio del listino (senza IVA), nel formato della lingua */
		const loc = LOCALES[locale];
		return { ok: false, error: msg('minimo', { importo: formatAmount(toCurrency(Number(data.min_order), loc.currency, false), loc) }) };
	}
	const amount = data.kind === 'percent' ? (subtotalNet * Number(data.value)) / 100 : Math.min(Number(data.value), subtotalNet);
	/* il codice della recensione ha la descrizione in italiano nel database (dashboard): al cliente si mostra nella sua lingua */
	const description = data.review_id ? msg('grazieRecensione') : data.description;
	return { ok: true, code: data.code, kind: data.kind, value: Number(data.value), amount: Math.round(amount * 100) / 100, description };
}
