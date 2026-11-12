import { error, fail, redirect } from '@sveltejs/kit';
import { groupOrders, ORDER_STATUS, type OrderRow } from '$lib/dashboard/orders';
import { loadEditorData, parseDraft, saveOrderDraft, upsertContact } from '$lib/server/orders';
import { ensurePlan, operatorName } from '$lib/server/produzione';
import { getConfirmation, loadMessages, markConfirmationRead, remindPayment, replyCustomer, sendConfirmation, setPaymentStatus, syncPayments } from '$lib/server/conferme';
import { sendEmail } from '$lib/server/email';
import { previewIntegration, requestIntegration, cancelIntegration, type ChangeInput } from '$lib/server/integrazioni';
import { shippingUpdateEmail } from '$lib/server/email-templates';
import { thumbOf } from '$lib/dashboard/orders';
import { langOf } from '$lib/i18n';
import type { Actions, PageServerLoad } from './$types';

/** Nome del corriere dal link di tracking, per l'email e la scheda (solo quando l'ordine non ne ha già uno). */
function courierFromUrl(link: string): string | null {
	const h = link.toLowerCase();
	if (!h) return null;
	if (h.includes('fedex.')) return 'FedEx';
	if (h.includes('ups.com')) return 'UPS';
	if (h.includes('dhl.')) return 'DHL';
	if (h.includes('gls-')) return 'GLS';
	if (h.includes('brt.it')) return 'BRT';
	if (h.includes('tnt.')) return 'TNT';
	if (h.includes('poste.it')) return 'Poste Italiane';
	return null;
}

export const load: PageServerLoad = async ({ params, url, locals: { supabase, user } }) => {
	let { data } = await supabase.from('orders').select('*').eq('checkout_group', params.group);
	if (!data?.length) ({ data } = await supabase.from('orders').select('*').eq('id', params.group));
	if (!data?.length) error(404, 'Ordine non trovato');
	const group = groupOrders(data as OrderRow[])[0];
	// file del cliente: link temporanei (1 ora)
	const files: Record<string, string> = {};
	/* kit di adesivi: file_path e' una cartella (cavallotto + adesivo-1..6), si elencano tutti i file */
	const fileLists: Record<string, { name: string; url: string }[]> = {};
	for (const it of group.items) {
		/* prove di stampa importate dal vecchio sito: percorso nel bucket privato, non un URL → link firmato */
		if (it.proof_url && !/^https?:\/\//.test(it.proof_url)) {
			const { data: s } = await supabase.storage.from('order-files').createSignedUrl(it.proof_url, 3600);
			it.proof_url = s?.signedUrl ?? null;
		}
		if (!it.file_path) continue;
		if (it.file_path.endsWith('/')) {
			const dir = it.file_path.replace(/\/$/, '');
			const { data: list } = await supabase.storage.from('order-files').list(dir, { limit: 50 });
			const out: { name: string; url: string }[] = [];
			for (const f of list ?? []) {
				const { data: s } = await supabase.storage.from('order-files').createSignedUrl(`${dir}/${f.name}`, 3600, { download: f.name });
				if (s) out.push({ name: f.name, url: s.signedUrl });
			}
			out.sort((a, b) => (a.name.startsWith('cavallotto') ? -1 : b.name.startsWith('cavallotto') ? 1 : a.name.localeCompare(b.name, 'it', { numeric: true })));
			fileLists[it.id] = out;
		} else {
			const { data: s } = await supabase.storage.from('order-files').createSignedUrl(it.file_path, 3600);
			if (s) files[it.id] = s.signedUrl;
		}
	}
	const [{ data: invoices }, { data: ddts }, editor] = await Promise.all([
		supabase.from('invoices').select('id, number, issued_at, amount_gross').eq('checkout_group', group.key),
		supabase.from('ddts').select('id, number, issued_at').eq('checkout_group', group.key),
		loadEditorData(supabase)
	]);
	// conferma d'ordine come pagina del cliente: scadenze, invio, domande
	await markConfirmationRead(supabase, group.key);
	const [conf, payments, messages, sender] = await Promise.all([getConfirmation(supabase, group.key), syncPayments(supabase, group.key), loadMessages(supabase, group.key), operatorName(supabase, user)]);
	return { group, files, fileLists, invoices: invoices ?? [], ddts: ddts ?? [], created: url.searchParams.get('creato'), mail: url.searchParams.get('mail'), openSend: url.searchParams.get('invia') === '1', conf, payments, messages, sender, ...editor };
};

export const actions: Actions = {
	save: async ({ request, params, locals: { supabase } }) => {
		const f = await request.formData();
		const d = parseDraft(f.get('payload'));
		if (!d) return fail(400, { error: 'Dati non leggibili.' });
		const ed = await loadEditorData(supabase);
		const r = await saveOrderDraft(supabase, d, params.group, ed);
		if (r.error) return fail(400, { error: r.error });
		return { ok: true, saved: true, message: 'Ordine salvato.' };
	},
	confirm: async ({ request, params, locals: { supabase } }) => {
		const f = await request.formData();
		const d = parseDraft(f.get('payload'));
		if (d) {
			const ed = await loadEditorData(supabase);
			const r = await saveOrderDraft(supabase, d, params.group, ed);
			if (r.error) return fail(400, { error: r.error });
		}
		// dall'editor: si salva e si apre il popup dell'email (niente invio a freddo)
		redirect(303, `/dashboard/fatturazione/ordini/${params.group}?invia=1`);
	},
	/** Dal popup: email scritta dallo staff con il bottone "Apri la conferma d'ordine" */
	invia: async ({ request, params, url, locals }) => {
		const f = await request.formData();
		const sender = String(f.get('sender') ?? '').trim() || (await operatorName(locals.supabase, locals.user));
		const m = await sendConfirmation(locals.supabase, params.group, url.origin, { to: String(f.get('to') ?? ''), cc: String(f.get('cc') ?? ''), subject: String(f.get('subject') ?? ''), message: String(f.get('message') ?? ''), sender });
		return m.ok ? { ok: true, sent: true, message: m.message } : fail(400, { error: m.message, sendError: true });
	},
	pagamento: async ({ request, params, locals }) => {
		const f = await request.formData();
		const op = await operatorName(locals.supabase, locals.user);
		const e = await setPaymentStatus(locals.supabase, params.group, Number(f.get('seq')), f.get('stato') === 'pagato' ? 'pagato' : 'da_pagare', op, String(f.get('rif') ?? ''));
		return e ? fail(400, { error: e }) : { ok: true, message: 'Scadenza aggiornata.' };
	},
	rispondi: async ({ request, params, url, locals }) => {
		const op = await operatorName(locals.supabase, locals.user);
		const e = await replyCustomer(locals.supabase, params.group, String((await request.formData()).get('body') ?? ''), op, url.origin);
		return e ? fail(400, { error: e }) : { ok: true, message: 'Risposta inviata.' };
	},
	/** Ritardo nostro: scuse al cliente con motivo e nuova data di spedizione (aggiorna anche la data prevista) */
	ritardo: async ({ request, params, url, locals: { supabase } }) => {
		const f = await request.formData();
		const { data } = await supabase.from('orders').select('*').eq('checkout_group', params.group);
		const g = data?.length ? groupOrders(data as OrderRow[])[0] : null;
		if (!g?.email) return fail(400, { error: "L'ordine non ha un'email." });
		const newDate = String(f.get('nuova_data') ?? '').trim() || null;
		const first = g.items[0];
		const mail = shippingUpdateEmail({ kind: 'ritardo_nostro', name: first.billing?.first_name || first.shipping?.first_name || g.customer, number: g.number, trackingUrl: `${url.origin}`, reason: String(f.get('motivo') ?? '').trim() || null, newDate: newDate ? new Date(newDate + 'T12:00:00').toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' }) : null, items: g.items.map((i) => ({ name: i.product_name, qty: i.qty, meta: i.description ?? null, preview: thumbOf(i) })), accountUrl: first.user_id ? `${url.origin}/account/ordini` : null });
		const r = await sendEmail({ to: g.email, ...mail, metadata: { order: g.number } });
		if (!r.ok) return fail(400, { error: r.error ?? 'Email non inviata.' });
		const patch: Record<string, unknown> = { shipping_notified: [...new Set([...(first.shipping_notified ?? []), 'ritardo_nostro'])] };
		if (newDate) { patch.delivery_date = newDate; patch.ship_by = newDate; }
		await supabase.from('orders').update(patch).eq('checkout_group', params.group);
		return { ok: true, message: `Email di scuse inviata a ${g.email}${newDate ? ', data di spedizione aggiornata' : ''}.` };
	},
	promemoria: async ({ params, url, locals: { supabase } }) => {
		const r = await remindPayment(supabase, params.group, url.origin);
		return r.ok ? { ok: true, message: r.message } : fail(400, { error: r.message });
	},
	contact: async ({ request, locals: { supabase } }) => {
		const f = await request.formData();
		const d = parseDraft(f.get('payload'));
		if (!d) return fail(400, { error: 'Dati non leggibili.' });
		const r = await upsertContact(supabase, d.customer, d.contact_id);
		if (r.error) return fail(400, { error: r.error });
		return { ok: true, contactId: r.id, contactMsg: 'Cliente salvato in anagrafica.' };
	},
	/** "Inizia produzione": stato in produzione, prima lavorazione stampa, piano delle lavorazioni */
	/** Integrazione: anteprima del ricalcolo (righe modificate → nuovo prezzo → differenza) */
	integrazionePreview: async ({ request, params, locals: { supabase } }) => {
		const f = await request.formData();
		let inputs: ChangeInput[] = [];
		try { inputs = JSON.parse(String(f.get('changes') ?? '[]')); } catch { return fail(400, { error: 'Modifiche non valide.' }); }
		const r = await previewIntegration(supabase, params.group, inputs);
		if ('error' in r) return fail(400, { error: r.error });
		return { preview: r };
	},
	/** Integrazione: crea la scadenza, ferma l'ordine e manda l'email al cliente (o applica subito se non c'e' differenza) */
	integrazione: async ({ request, params, url, locals }) => {
		const f = await request.formData();
		let inputs: ChangeInput[] = [];
		try { inputs = JSON.parse(String(f.get('changes') ?? '[]')); } catch { return fail(400, { error: 'Modifiche non valide.' }); }
		const amountRaw = String(f.get('amount') ?? '').replace(',', '.').trim();
		const amount = amountRaw === '' ? null : Number(amountRaw);
		if (amount !== null && !Number.isFinite(amount)) return fail(400, { error: 'Importo non valido.' });
		const r = await requestIntegration(locals.supabase, params.group, inputs, amount, String(f.get('reason') ?? ''), await operatorName(locals.supabase, locals.user), url.origin);
		if (r.error) return fail(400, { error: r.error });
		return { ok: true, message: r.applied ? `Modifica applicata subito${(r.amount ?? 0) < 0 ? `: da rimborsare ${(-(r.amount ?? 0)).toFixed(2)} € al cliente (Stripe/PayPal)` : ', nessuna differenza da chiedere'}.` : `Richiesta inviata: il cliente deve pagare ${(r.amount ?? 0).toFixed(2)} €; l'ordine è fermo finché non arriva.` };
	},
	integrazioneAnnulla: async ({ params, locals }) => {
		const e = await cancelIntegration(locals.supabase, params.group, await operatorName(locals.supabase, locals.user));
		return e ? fail(400, { error: e }) : { ok: true, message: 'Richiesta di integrazione annullata: l’ordine riparte com’era.' };
	},
	produzione: async ({ params, locals }) => {
		const { supabase } = locals;
		const { error: e } = await supabase.from('orders').update({ status: 'in_produzione', prod_stage: 'stampa' }).eq('checkout_group', params.group).neq('status', 'annullato');
		if (e) return fail(400, { error: e.message });
		const { data: rows } = await supabase.from('orders').select('*').eq('checkout_group', params.group);
		await ensurePlan(supabase, (rows ?? []) as OrderRow[], await operatorName(supabase, locals.user));
		return { ok: true, message: 'Ordine in produzione: la trovi in Produzione › Coda ordini.' };
	},
	status: async ({ request, params, locals }) => {
		const { supabase } = locals;
		const f = await request.formData();
		const status = String(f.get('status'));
		if (!ORDER_STATUS[status]) return fail(400, { error: 'Stato non valido.' });
		const stage = String(f.get('prod_stage') ?? '') || null;
		const patch: Record<string, unknown> = { status, prod_stage: stage };
		if (status === 'consegnato') patch.delivered_at = new Date().toISOString();
		if (status === 'spedito') patch.shipped_at = new Date().toISOString();
		const q = f.get('item') ? supabase.from('orders').update(patch).eq('id', String(f.get('item'))) : supabase.from('orders').update(patch).eq('checkout_group', params.group);
		const { error: e } = await q;
		if (e) return fail(400, { error: e.message });
		// la produzione a lavorazioni si allinea al nuovo stato (commessa pianificata o attivata)
		const { data: rows } = await supabase.from('orders').select('*').eq('checkout_group', params.group);
		await ensurePlan(supabase, (rows ?? []) as OrderRow[], await operatorName(supabase, locals.user));
		return { ok: true, message: 'Stato aggiornato.' };
	},
	/** Tracking scritto a mano (spedizione fatta fuori da Qapla', es. dal portale FedEx per l'estero): si accetta il link
	    completo oppure il solo numero FedEx (12/15 cifre) o UPS (1Z…). Con «avvisa» l'ordine passa a Spedito e al cliente
	    parte la stessa email «il tuo ordine è partito» che manderebbe il webhook Qapla', nella sua lingua. 5/11/2026 */
	tracking: async ({ request, params, url, locals }) => {
		const { supabase } = locals;
		const f = await request.formData();
		let link = String(f.get('tracking') ?? '').trim();
		const avvisa = f.get('avvisa') === '1';
		if (link && !/^https?:\/\//i.test(link)) {
			if (/^\d{12}(\d{3})?$/.test(link)) link = `https://www.fedex.com/fedextrack/?trknbr=${link}`;
			else if (/^1Z[0-9A-Z]{16}$/i.test(link)) link = `https://www.ups.com/track?tracknum=${link.toUpperCase()}`;
			else return fail(400, { error: 'Incolla il link completo del tracking (https://…), oppure il solo numero FedEx o UPS.' });
		}
		const { data: rows } = await supabase.from('orders').select('*').eq('checkout_group', params.group);
		if (!rows?.length) return fail(404, { error: 'Ordine non trovato.' });
		const g = groupOrders(rows as OrderRow[])[0];
		const first = g.items[0];
		const courier = courierFromUrl(link) ?? first.courier ?? null;
		const patch: Record<string, unknown> = { tracking_url: link || null, ...(courier && !first.courier ? { courier } : {}) };
		if (avvisa) {
			if (!link) return fail(400, { error: 'Scrivi prima il link del tracking.' });
			if (!g.email) return fail(400, { error: "L'ordine non ha un'email: il cliente non si può avvisare." });
			if (!['spedito', 'in_consegna', 'consegnato'].includes(g.status)) { patch.status = 'spedito'; patch.prod_stage = null; patch.shipped_at = new Date().toISOString(); }
		}
		const { error: e } = await supabase.from('orders').update(patch).eq('checkout_group', params.group).neq('status', 'annullato');
		if (e) return fail(400, { error: e.message });
		if (!avvisa) return { ok: true, message: 'Tracking salvato: il cliente lo vede nel suo ordine, nessuna email inviata.' };
		if (patch.status) {
			const { data: upd } = await supabase.from('orders').select('*').eq('checkout_group', params.group);
			await ensurePlan(supabase, (upd ?? []) as OrderRow[], await operatorName(supabase, locals.user));
		}
		const ship = first.shipping ?? {};
		const mail = shippingUpdateEmail({ kind: 'spedito', name: ship.first_name || first.customer_name || null, number: g.number, trackingUrl: link, courier, shippedAt: new Date().toLocaleDateString('it-IT'), items: g.items.map((i) => ({ name: i.product_name, qty: i.qty, preview: thumbOf(i) })), accountUrl: first.user_id ? `${url.origin}/account/ordini` : null }, langOf(first.locale));
		const r = await sendEmail({ to: g.email, subject: mail.subject, html: mail.html, tag: mail.tag, metadata: { order: g.number } });
		if (!r.ok) return fail(400, { error: `Tracking salvato ma l'email non è partita: ${r.error ?? 'errore Postmark'}.` });
		const sent: string[] = Array.isArray(first.shipping_notified) ? first.shipping_notified : [];
		if (!sent.includes('spedito')) await supabase.from('orders').update({ shipping_notified: [...sent, 'spedito'] }).eq('checkout_group', params.group);
		return { ok: true, message: `Tracking salvato${patch.status ? ', ordine in Spedito' : ''} e cliente avvisato: email «${mail.subject}» a ${g.email}.` };
	},
	/** Collega l'ordine (tutte le righe del gruppo e la fattura) a un cliente registrato: serve quando un ospite si registra
	    dopo con un'email diversa da quella scritta nel checkout. L'email dell'ordine diventa quella dell'account. */
	collega: async ({ request, params, locals: { supabase } }) => {
		const f = await request.formData();
		const email = String(f.get('email') ?? '').trim().toLowerCase();
		if (!email) return fail(400, { error: "Scrivi l'email dell'account." });
		const { data: prof } = await supabase.from('profiles').select('id, email, full_name').ilike('email', email).maybeSingle();
		if (!prof) return fail(400, { error: `Nessun account registrato con ${email}.` });
		const { error: e1 } = await supabase.from('orders').update({ user_id: prof.id, email: prof.email }).eq('checkout_group', params.group);
		if (e1) return fail(400, { error: e1.message });
		await supabase.from('invoices').update({ user_id: prof.id, email: prof.email }).eq('checkout_group', params.group);
		return { ok: true, message: `Ordine collegato all'account di ${prof.full_name || prof.email} (${prof.email}): ora lo vede in "I miei ordini".` };
	},
	delete: async ({ params, locals: { supabase } }) => {
		const { error: e } = await supabase.from('orders').delete().eq('checkout_group', params.group);
		if (e) return fail(400, { error: e.message });
		redirect(303, '/dashboard/fatturazione/ordini');
	}
};
