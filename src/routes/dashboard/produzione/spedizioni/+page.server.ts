import { qaplaCouriers } from '$lib/server/couriers/qapla';
import { fail } from '@sveltejs/kit';
import { groupOrders, itemMeta, thumbOf, type OrderRow } from '$lib/dashboard/orders';
import { generateLabels } from '$lib/server/shipping';
import { sendEmail } from '$lib/server/email';
import { shippingUpdateEmail } from '$lib/server/email-templates';
import { getConfirmation } from '$lib/server/conferme';
import { env } from '$env/dynamic/private';

/* stati Qapla': oltre al webhook, quando lo staff apre questa pagina si rileggono le spedizioni in viaggio
   (al massimo ogni 20 minuti). Il cron di Vercel gira solo una volta al giorno sul piano attuale. */
let lastSync = 0;
function syncQapla(origin: string) {
	if (!env.QAPLA_API_KEY || !env.INTERNAL_API_KEY || Date.now() - lastSync < 20 * 60 * 1000) return;
	lastSync = Date.now();
	fetch(`${origin}/api/qapla/sync`, { headers: { 'x-internal-key': env.INTERNAL_API_KEY } }).catch(() => {});
}
import type { Actions, PageServerLoad } from './$types';

/** giorno (Europe/Rome) di una data ISO, come AAAA-MM-GG */
const romeDay = (iso: string) => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Rome' }).format(new Date(iso));

export const load: PageServerLoad = async ({ locals: { supabase }, url }) => {
	syncQapla(url.origin);
	const view = url.searchParams.get('vista') === 'spediti' ? 'spediti' : 'da-spedire';
	const today = romeDay(new Date().toISOString());
	/* IN SPEDIZIONE: ordini nello stato «in spedizione» non ancora inviati a Qapla. Appena si inviano escono da qui; quelli
	   consegnati a mano escono quando dalla scheda dell'ordine si segnano spediti o consegnati */
	const { data: todo } = await supabase.from('orders').select('*').in('status', ['pronto', 'in_spedizione']).is('transmitted_at', null).order('created_at', { ascending: false });
	const groups = groupOrders((todo ?? []) as OrderRow[]);
	if (view === 'da-spedire') return { view, groups, couriers: await qaplaCouriers(), defaultCourier: env.QAPLA_COURIER || 'GLS-ITA', qaplaOk: !!env.QAPLA_API_KEY, today, month: today.slice(0, 7), day: today, days: {} as Record<string, number>, shipped: [] as ReturnType<typeof groupOrders>, todoCount: groups.length };

	/* ORDINI SPEDITI: calendario del mese; per ogni giorno gli ordini partiti quel giorno (data di invio a Qapla o di conclusione) */
	const month = /^\d{4}-\d{2}$/.test(url.searchParams.get('mese') ?? '') ? String(url.searchParams.get('mese')) : today.slice(0, 7);
	const [y, m] = month.split('-').map(Number);
	const from = new Date(Date.UTC(y, m - 1, 1) - 3 * 3600 * 1000).toISOString();   // margine per il fuso: si filtra poi sul giorno di Roma
	const to = new Date(Date.UTC(y, m, 1) + 3 * 3600 * 1000).toISOString();
	const { data: sent } = await supabase.from('orders').select('*').not('shipped_at', 'is', null).gte('shipped_at', from).lt('shipped_at', to).neq('status', 'annullato').order('shipped_at', { ascending: false });
	const all = groupOrders((sent ?? []) as OrderRow[]).filter((g) => romeDay(g.items[0].shipped_at!).startsWith(month));
	const days: Record<string, number> = {};
	for (const g of all) { const d = romeDay(g.items[0].shipped_at!); days[d] = (days[d] ?? 0) + 1; }
	const asked = url.searchParams.get('giorno');
	const day = asked && /^\d{4}-\d{2}-\d{2}$/.test(asked) && asked.startsWith(month) ? asked : (month === today.slice(0, 7) && days[today] ? today : (Object.keys(days).sort().pop() ?? `${month}-01`));
	const shipped = all.filter((g) => romeDay(g.items[0].shipped_at!) === day);
	return { view, groups: [] as typeof groups, couriers: await qaplaCouriers(), defaultCourier: env.QAPLA_COURIER || 'GLS-ITA', qaplaOk: !!env.QAPLA_API_KEY, today, month, day, days, shipped, todoCount: groups.length };
};
/* Dal 25/11/2026 (Mattia) in Spedizioni c'e' solo Qapla: niente piu' scelta fra nostro corriere, consegna diretta e corriere
   del cliente, e nessun DDT creato da qui. Il DDT si genera, se serve, dalla scheda dell'ordine (src/lib/server/ddt.ts);
   un ordine consegnato a mano si chiude cambiando lo stato dalla sua scheda. */

export const actions: Actions = {
	/** Rimanda a Qapla' un ordine gia' inviato ma non ancora ritirato, con un altro corriere (stesso riferimento: Qapla' aggiorna l'ordine) */
	ricorriere: async ({ request, locals: { supabase } }) => {
		const f = await request.formData();
		const group = String(f.get('group') ?? ''); const courierCode = String(f.get('courier') ?? '').trim() || null;
		const { data } = await supabase.from('orders').select('number, tracking_number, courier').eq('checkout_group', group);
		if (!data?.length) return fail(404, { error: 'Ordine non trovato.' });
		if (data[0].tracking_number) return fail(400, { error: 'La spedizione ha già un tracking: il corriere non si cambia più da qui.' });
		let r: { count: number; warnings: string[] };
		try { r = await generateLabels(supabase, 'Qapla', [group], courierCode); } catch (e) { return fail(400, { error: e instanceof Error ? e.message : 'Errore Qapla' }); }
		const hard = r.warnings.filter((w) => !/Ordine inviato a Qapla/.test(w));
		if (hard.length) return fail(400, { error: hard.join(' · ') + ' — se Qapla rifiuta il riferimento doppio, elimina l\'ordine dal pannello Qapla (Etichette → Crea) e riprova.' });
		return { ok: true, qapla: data[0].number, emailed: false, notes: [] as string[], reshipped: courierCode };
	},
	/** Invia a Qapla': l'ordine passa a Qapla' (sezione Crea, etichetta dal pannello) ed esce da "In spedizione". Resta IN SPEDIZIONE
	    finche' il corriere non lo ritira: da li' spedito, in consegna e consegnato arrivano da Qapla' (webhook e sincronizzazione).
	    Il cliente riceve l'email "in attesa di ritiro". */
	qapla: async ({ request, url, locals: { supabase } }) => {
		const f = await request.formData();
		const group = String(f.get('group') ?? '');
		const { data } = await supabase.from('orders').select('*').eq('checkout_group', group);
		if (!data?.length) return fail(404, { error: 'Ordine non trovato.' });
		const g = groupOrders(data as OrderRow[])[0];
		if (!env.QAPLA_API_KEY) return fail(400, { error: "Qapla non è ancora collegato: manca QAPLA_API_KEY su Vercel." });
		/* colli e peso (dal popup) servono a Qapla per l'etichetta */
		if (f.has('parcels')) await supabase.from('orders').update({ parcels: Math.max(1, Number(f.get('parcels') ?? 1)), weight_kg: Number(f.get('weight') ?? 0) || null }).eq('checkout_group', group);
		let r: { count: number; warnings: string[] };
		const courierCode = String(f.get('courier') ?? '').trim() || null;
		try { r = await generateLabels(supabase, 'Qapla', [group], courierCode); } catch (e) { return fail(400, { error: e instanceof Error ? e.message : 'Errore Qapla' }); }
		const hard = r.warnings.filter((w) => !/Ordine inviato a Qapla/.test(w));
		if (hard.length) return fail(400, { error: hard.join(' · ') });
		const now = new Date().toISOString();
		await supabase.from('orders').update({ status: 'in_spedizione', courier: 'Qapla', shipped_at: now, transmitted_at: now }).eq('checkout_group', group);
		// email al cliente: ordine concluso, in attesa del ritiro del corriere
		const first = g.items[0];
		let emailed = false;
		if (g.email) {
			/* dove il cliente rivede l'ordine: l'area personale se ha un account. Chi ha un ordine inserito da noi di solito non
			   ce l'ha: il bottone lo porta alla pagina della sua conferma d'ordine, non alla pagina di accesso (25/11/2026) */
			let paginaOrdine: string | null = first.user_id ? `${url.origin}/account/ordini` : null;
			if (!paginaOrdine && g.channel !== 'ecommerce') { const conf = await getConfirmation(supabase, group); if (conf?.token) paginaOrdine = `${url.origin}/conferma/${conf.token}`; }
			const mail = shippingUpdateEmail({ kind: 'affidato', name: first.shipping?.first_name || g.customer, number: g.number, trackingUrl: paginaOrdine ?? `${url.origin}/account/ordini`, items: g.items.map((i) => ({ name: i.product_name, qty: i.qty, meta: itemMeta(i) || null, preview: thumbOf(i) })), accountUrl: paginaOrdine });
			const res = await sendEmail({ to: g.email, subject: mail.subject, html: mail.html, tag: mail.tag, metadata: { order: g.number } });
			emailed = res.ok;
			if (res.ok) await supabase.from('orders').update({ shipping_notified: ['affidato'] }).eq('checkout_group', group);
		}
		return { ok: true, qapla: g.number, emailed, notes: r.warnings };
	},
	status: async ({ request, locals: { supabase } }) => {
		const f = await request.formData();
		const status = String(f.get('status'));
		const patch: Record<string, string | null> = { status };
		if (f.has('tracking')) patch.tracking_url = String(f.get('tracking')).trim() || null;
		if (status === 'consegnato') patch.delivered_at = new Date().toISOString();
		const { error } = await supabase.from('orders').update(patch).eq('checkout_group', String(f.get('group')));
		if (error) return fail(400, { error: error.message });
		return { ok: true };
	}
};
