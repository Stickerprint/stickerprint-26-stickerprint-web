/**
 * Stati di spedizione da Qapla' (webhook e sincronizzazione) → stato ordine, email al cliente,
 * avviso allo staff. La stessa funzione serve al webhook e al controllo orario.
 * Stati Qapla': 0 attesa elaborazione, 1 in sospeso, 2 attesa ritiro, 20 partito, 3 in transito,
 * 50 in lavorazione, 4 in consegna, 5 tentativo fallito, 8 ritardo, 6 eccezione (dettaglio 1 giacenza,
 * 2 rientro/rifiutata, 3 danneggiamento, 4 smarrimento, 5 consegna parziale), 10 punto di ritiro,
 * 95 rientrato, 99 consegnato.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { sendEmail } from './email';
import { shippingUpdateEmail } from './email-templates';
import { pushStaff } from './push';
import { trackingPageUrl } from './couriers/qapla';

export interface QaplaUpdate { trackingNumber: string; reference?: string | null; courier?: string | null; date?: string | null; place?: string | null; qaplaStatusID: number | string; qaplaStatus?: string | null; statusDetails?: { id: number; detail: string }[] | null }

type Kind = 'spedito' | 'in_consegna' | 'consegnato' | 'problema' | 'punto_ritiro' | null;
export function interpret(u: QaplaUpdate): { status: string | null; kind: Kind; detail: string } {
	const id = Number(u.qaplaStatusID);
	const det = (u.statusDetails ?? []).map((d) => d.detail).join(', ');
	const label = [u.qaplaStatus, det].filter(Boolean).join(' · ');
	if (id === 20 || id === 3 || id === 50) return { status: 'spedito', kind: 'spedito', detail: label };
	if (id === 4) return { status: 'in_consegna', kind: 'in_consegna', detail: label };
	if (id === 99) return { status: 'consegnato', kind: 'consegnato', detail: label };
	if (id === 10) return { status: 'in_consegna', kind: 'punto_ritiro', detail: label };
	if (id === 5 || id === 6 || id === 8 || id === 95) return { status: null, kind: 'problema', detail: label };
	return { status: null, kind: null, detail: label }; // 0, 1, 2: ancora niente da dire al cliente
}

/** applica un aggiornamento a tutte le righe dell'ordine; ritorna cosa e' stato fatto */
export async function applyQaplaUpdate(db: SupabaseClient, u: QaplaUpdate, origin: string): Promise<{ matched: number; emailed: string | null }> {
	let { data: rows } = await db.from('orders').select('*').eq('tracking_number', u.trackingNumber);
	if (!rows?.length && u.reference) ({ data: rows } = await db.from('orders').select('*').eq('number', u.reference));
	if (!rows?.length) return { matched: 0, emailed: null };
	const first = rows[0];
	const { status, kind, detail } = interpret(u);
	const when = u.date ? new Date(u.date.replace(' ', 'T') + '+02:00').toISOString() : new Date().toISOString();
	/* non si torna indietro: un "in transito" arrivato dopo "consegnato" non cambia lo stato */
	const rank: Record<string, number> = { in_spedizione: 1, spedito: 2, in_consegna: 3, consegnato: 4 };
	const next = status && (rank[status] ?? 0) > (rank[first.status] ?? 0) ? status : null;
	const patch: Record<string, unknown> = { shipping_status: u.qaplaStatus ?? null, shipping_status_id: Number(u.qaplaStatusID), shipping_detail: detail || null, shipping_place: u.place ?? null, shipping_updated_at: when };
	if (next) patch.status = next;
	if (next === 'consegnato') patch.delivered_at = when;
	if (!first.tracking_url) patch.tracking_url = trackingPageUrl(u.trackingNumber);
	const keys = [...new Set(rows.map((r) => r.checkout_group ?? r.id))];
	const col = first.checkout_group ? 'checkout_group' : 'id';
	for (const k of keys) {
		const { error } = await db.from('orders').update(patch).eq(col, k);
		/* migrazione 0032 non ancora applicata: si aggiornano almeno stato e tracking */
		if (error) await db.from('orders').update({ ...(next ? { status: next } : {}), ...(first.tracking_url ? {} : { tracking_url: trackingPageUrl(u.trackingNumber) }) }).eq(col, k);
	}

	/* email al cliente: una per tipo, mai due volte */
	const sent: string[] = Array.isArray(first.shipping_notified) ? first.shipping_notified : [];
	let emailed: string | null = null;
	if (kind && !sent.includes(kind) && first.email) {
		const ship = first.shipping ?? {};
		const mail = shippingUpdateEmail({ kind, name: ship.first_name || first.customer_name || null, number: first.number, trackingUrl: first.tracking_url || trackingPageUrl(u.trackingNumber), courier: u.courier ?? first.courier ?? null, detail, place: u.place ?? null, items: rows.map((r) => `${r.qty} × ${r.product_name}`), accountUrl: first.user_id ? `${origin}/account/ordini` : null });
		const r = await sendEmail({ to: first.email, subject: mail.subject, html: mail.html, tag: mail.tag, metadata: { order: first.number } });
		if (r.ok) { emailed = kind; for (const k of keys) await db.from('orders').update({ shipping_notified: [...sent, kind] }).eq(first.checkout_group ? 'checkout_group' : 'id', k); }
	}
	if (kind === 'problema') pushStaff({ title: `Spedizione ${first.number}: ${detail || 'problema'}`, body: `${first.customer_name ?? first.email ?? ''} · ${u.place ?? ''}`.trim(), url: `/dashboard/produzione/spedizioni`, tag: `ship-${first.number}` }).catch(() => {});
	return { matched: rows.length, emailed };
}
