import { PUBLIC_SITE_URL } from '$env/static/public';
import type { Lang } from '$lib/i18n';
import { adminClient } from './admin';
import { sendEmail } from './email';
import { areaPersonaleEmail } from './email-templates';

/**
 * Area personale creata dallo staff per un cliente che non riesce a registrarsi (scheda cliente in dashboard).
 *  - se l'account non esiste lo crea gia' confermato; se esiste ma l'email non era confermata, la conferma
 *  - collega al cliente gli ordini e le fatture fatti da ospite con la sua email (e con le altre email indicate,
 *    es. un indirizzo scritto con un refuso), compresi quelli finiti sotto un altro profilo con quelle email
 *  - manda la nostra email con il link per scegliere la password (token di recupero di Supabase, vale un'ora)
 * Serve SUPABASE_SERVICE_ROLE_KEY: senza, torna un errore chiaro.
 */
const SITE = PUBLIC_SITE_URL || 'https://stickerprint.it';

export interface AreaPersonaleEsito {
	userId: string;
	esisteva: boolean;
	confermataOra: boolean;
	ordiniCollegati: number;
	fattureCollegate: number;
	emailInviata: boolean;
	erroreEmail?: string;
}

const pulisci = (e: string) => e.trim().toLowerCase();

export function anteprimaAreaPersonale(o: { email: string; name?: string | null; orders: number; lang?: Lang }) {
	return areaPersonaleEmail({ name: o.name, email: pulisci(o.email), href: `${SITE}/auth/callback?next=%2Faccount%2Fpassword&type=recovery&token_hash=ANTEPRIMA`, orders: o.orders }, o.lang ?? 'it');
}

export async function creaAreaPersonale(o: { email: string; name?: string | null; phone?: string | null; altreEmail?: string[]; lang?: Lang }): Promise<{ ok: true; esito: AreaPersonaleEsito } | { ok: false; error: string }> {
	const admin = adminClient();
	if (!admin) return { ok: false, error: 'Manca SUPABASE_SERVICE_ROLE_KEY sul server: non posso creare account.' };
	const email = pulisci(o.email);
	if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { ok: false, error: 'Email del cliente non valida.' };
	const altre = (o.altreEmail ?? []).map(pulisci).filter((e) => e && e !== email && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e));
	const lang = o.lang ?? 'it';

	// 1. account: esiste gia'? (il profilo nasce col trigger alla creazione dell'utente)
	const { data: prof } = await admin.from('profiles').select('id, full_name, phone').ilike('email', email).maybeSingle();
	let userId: string;
	let esisteva = false, confermataOra = false;
	if (prof) {
		esisteva = true;
		userId = prof.id;
		const { data: u } = await admin.auth.admin.getUserById(userId);
		if (u?.user && !u.user.email_confirmed_at) {
			const { error } = await admin.auth.admin.updateUserById(userId, { email_confirm: true });
			if (error) return { ok: false, error: `Conferma email fallita: ${error.message}` };
			confermataOra = true;
		}
		const patch: Record<string, string> = {};
		if (!prof.full_name && o.name) patch.full_name = o.name;
		if (!prof.phone && o.phone) patch.phone = o.phone;
		if (Object.keys(patch).length) await admin.from('profiles').update(patch).eq('id', userId);
	} else {
		const { data, error } = await admin.auth.admin.createUser({ email, email_confirm: true, user_metadata: { full_name: o.name ?? '', phone: o.phone ?? '', locale: lang === 'it' ? 'it' : lang } });
		if (error || !data.user) return { ok: false, error: `Creazione account fallita: ${error?.message ?? 'nessun utente'}` };
		userId = data.user.id;
	}

	// 2. ordini e fatture: quelli da ospite con le sue email, e quelli sotto altri profili con le email "altre"
	const emails = [email, ...altre];
	let ordiniCollegati = 0, fattureCollegate = 0;
	for (const e of emails) {
		const { data: o1 } = await admin.from('orders').update({ user_id: userId }).is('user_id', null).ilike('email', e).select('id');
		ordiniCollegati += o1?.length ?? 0;
		const { data: f1 } = await admin.from('invoices').update({ user_id: userId }).is('user_id', null).ilike('email', e).select('id');
		fattureCollegate += f1?.length ?? 0;
		await admin.from('contacts').update({ user_id: userId }).is('user_id', null).ilike('email', e);
	}
	if (altre.length) {
		const { data: altri } = await admin.from('profiles').select('id').in('email', altre).neq('id', userId);
		for (const p of altri ?? []) {
			const { data: o2 } = await admin.from('orders').update({ user_id: userId }).eq('user_id', p.id).select('id');
			ordiniCollegati += o2?.length ?? 0;
			const { data: f2 } = await admin.from('invoices').update({ user_id: userId }).eq('user_id', p.id).select('id');
			fattureCollegate += f2?.length ?? 0;
		}
	}
	const { count } = await admin.from('orders').select('id', { count: 'exact', head: true }).eq('user_id', userId).neq('status', 'annullato');

	// 3. link per scegliere la password (non manda nulla da solo: l'email e' la nostra)
	const { data: link, error: linkErr } = await admin.auth.admin.generateLink({ type: 'recovery', email, options: { redirectTo: `${SITE}/auth/callback?next=%2Faccount%2Fpassword` } });
	const token = link?.properties?.hashed_token;
	if (linkErr || !token) return { ok: false, error: `Link password non generato: ${linkErr?.message ?? 'token mancante'}` };
	const href = `${SITE}/auth/callback?next=%2Faccount%2Fpassword&token_hash=${encodeURIComponent(token)}&type=recovery`;
	const mail = areaPersonaleEmail({ name: o.name, email, href, orders: count ?? 0 }, lang);
	const r = await sendEmail({ to: email, subject: mail.subject, html: mail.html, tag: mail.tag, metadata: { user_id: userId } });
	return { ok: true, esito: { userId, esisteva, confermataOra, ordiniCollegati, fattureCollegate, emailInviata: r.ok, erroreEmail: r.ok ? undefined : (r.error ?? 'invio fallito') } };
}

/** Elimina un account registrato (es. profilo doppio con l'email sbagliata): solo se non ha ordini ne' fatture.
    Cancellando l'utente di Supabase Auth cadono a cascata profilo, fedelta', credito e indirizzi. */
export async function eliminaAccount(userId: string): Promise<{ ok: true; email: string } | { ok: false; error: string }> {
	const admin = adminClient();
	if (!admin) return { ok: false, error: 'Manca SUPABASE_SERVICE_ROLE_KEY sul server: non posso eliminare account.' };
	const { data: prof } = await admin.from('profiles').select('id, email, role').eq('id', userId).maybeSingle();
	if (!prof) return { ok: false, error: 'Account non trovato.' };
	if (prof.role !== 'customer') return { ok: false, error: 'Questo e\' un account dello staff: non si elimina da qui.' };
	const [{ count: ordini }, { count: fatture }] = await Promise.all([
		admin.from('orders').select('id', { count: 'exact', head: true }).eq('user_id', userId),
		admin.from('invoices').select('id', { count: 'exact', head: true }).eq('user_id', userId)
	]);
	if ((ordini ?? 0) > 0 || (fatture ?? 0) > 0) return { ok: false, error: `L'account ha ${ordini ?? 0} ordini e ${fatture ?? 0} fatture: prima spostali su un altro account (campo "altre email").` };
	const { error } = await admin.auth.admin.deleteUser(userId);
	if (error) return { ok: false, error: `Eliminazione fallita: ${error.message}` };
	return { ok: true, email: prof.email };
}
