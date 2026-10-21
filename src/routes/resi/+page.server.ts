import { fail } from '@sveltejs/kit';
import { langOf } from '$lib/i18n';
import { saveRequest } from '$lib/server/requests';
import { t } from '$lib/traduzioni';
import type { Actions } from './$types';

export const actions: Actions = {
	default: async ({ request, url, locals: { supabase, locale } }) => {
		const f = await request.formData();
		const s = (k: string) => String(f.get(k) ?? '').trim();
		if (!s('order_number')) return fail(400, { error: t(locale, 'pagine.resi.ordineObbligatorio') });
		const file = f.get('file');
		if (!(file instanceof File) || file.size === 0) return fail(400, { error: t(locale, 'pagine.resi.fotoObbligatoria') });
		const r = await saveRequest(supabase, 'reso', f, { email: s('email'), order_number: s('order_number'), message: s('message') }, url.origin, langOf(locale));
		if (!r.ok) return fail(400, { error: r.error });
		return { ok: true };
	}
};
