import { COMPANY } from '$lib/server/company';
import type { PageServerLoad } from './$types';

/** Firma per Gmail: si compila qui, si copia e si incolla nelle impostazioni di Gmail. */
export const load: PageServerLoad = async ({ url, locals: { supabase, user } }) => {
	const [{ data: prof }, { data: rev }] = await Promise.all([
		user ? supabase.from('profiles').select('full_name, role').eq('id', user.id).maybeSingle() : Promise.resolve({ data: null }),
		/* solo recensioni vere e pubblicate: le stelle non si inventano mai */
		supabase.from('reviews').select('rating').eq('is_public', true)
	]);
	const voti = (rev ?? []).map((r) => Number(r.rating)).filter((n) => n >= 1 && n <= 5);
	const stelle = voti.length ? { media: voti.reduce((s, n) => s + n, 0) / voti.length, quante: voti.length } : null;
	return {
		origin: url.origin,
		stelle,
		azienda: `${COMPANY.name} · ${COMPANY.street}, ${COMPANY.zip} ${COMPANY.city} (${COMPANY.province}) · P.IVA ${COMPANY.vat}`,
		io: { nome: prof?.full_name ?? '', email: user?.email ?? '', ruolo: prof?.role === 'admin' ? 'Titolare' : 'Stampa e produzione' }
	};
};
