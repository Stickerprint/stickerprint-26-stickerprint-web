/** Orchestrazione spedizioni per corriere: genera etichette (creando le spedizioni via API quando il corriere è collegato) e trasmette con manifest. */
import type { SupabaseClient } from '@supabase/supabase-js';
import { PDFDocument } from 'pdf-lib';
import { groupOrders, deliveryMode, itemMeta, type OrderRow, type OrderGroup } from '$lib/dashboard/orders';
import { adapterFor } from './couriers';
import { buildLabelsPdf, buildManifestPdf } from './docs';

const todayIso = () => new Date().toISOString().slice(0, 10);
const isToday = (d: string | null | undefined) => !!d && d.slice(0, 10) === todayIso();

/** Spedizioni di oggi per corriere: da generare, da trasmettere, trasmesse */
export function courierDay(groups: OrderGroup[], courier: string) {
	const mine = groups.filter((g) => g.items[0].courier === courier && deliveryMode(g) === 'ours');
	const toGenerate = mine.filter((g) => g.status === 'pronto' && !g.items[0].labels_generated_at);
	const toTransmit = mine.filter((g) => g.status === 'pronto' && g.items[0].labels_generated_at && !g.items[0].transmitted_at);
	const transmitted = mine.filter((g) => isToday(g.items[0].transmitted_at));
	const generatedToday = mine.filter((g) => isToday(g.items[0].labels_generated_at) || isToday(g.items[0].transmitted_at) || (g.status === 'pronto' && g.items[0].courier));
	return { toGenerate: toGenerate.map((g) => g.key), toTransmit: toTransmit.map((g) => g.key), transmitted: transmitted.map((g) => g.key), today: generatedToday.length, manifestId: transmitted.find((g) => g.items[0].manifest_id)?.items[0].manifest_id ?? null };
}

function shipmentInput(g: OrderGroup) {
	const f = g.items[0]; const s = f.shipping ?? {};
	return { orderNumber: g.number, group: g.key, reference: g.numbers.join(' '), recipient: { name: (s.company || [s.first_name, s.last_name].filter(Boolean).join(' ') || g.customer).slice(0, 60), contact: [s.first_name, s.last_name].filter(Boolean).join(' '), street: [s.street, s.street2].filter(Boolean).join(', '), zip: s.zip ?? '', city: s.city ?? '', province: s.province ?? '', country: s.country ?? 'IT', phone: s.phone ?? f.billing?.phone ?? '', email: g.email }, parcels: Math.max(1, f.parcels ?? 1), weightKg: Number(f.weight_kg ?? 1) || 1, contents: g.items.map((i) => `${i.qty}x ${i.product_name}`).join(', ') };
}

/** Genera le spedizioni del corriere: via API (tracking + etichetta ufficiale salvata) se collegato, altrimenti etichette interne. Il PDF unico si scarica con labelsPdf. */
export async function generateLabels(supabase: SupabaseClient, courier: string, keys: string[]): Promise<{ count: number; warnings: string[] }> {
	const { data } = await supabase.from('orders').select('*').in('checkout_group', keys);
	const groups = groupOrders((data ?? []) as OrderRow[]);
	const adapter = adapterFor(courier);
	const warnings: string[] = [];
	if (!adapter?.configured) warnings.push(`${courier} non è ancora collegato via API (Setup → Corrieri): etichette interne 10×15.`);
	for (const g of groups) {
		let patch: Record<string, string | null> = { labels_generated_at: new Date().toISOString() };
		if (adapter?.configured) {
			try {
				const r = await adapter.createShipment(shipmentInput(g));
				let labelPath: string | null = null;
				if (r.labelPdf) {
					labelPath = `couriers/${courier}/${g.number}.pdf`;
					const { error } = await supabase.storage.from('order-files').upload(labelPath, r.labelPdf, { contentType: 'application/pdf', upsert: true });
					if (error) labelPath = null;
				}
				patch = { ...patch, tracking_number: r.tracking, courier_label_path: labelPath };
			} catch (e) {
				warnings.push(`${g.number}: ${e instanceof Error ? e.message : 'errore API'} (etichetta interna)`);
			}
		}
		await supabase.from('orders').update(patch).eq('checkout_group', g.key);
	}
	return { count: groups.length, warnings };
}

/** PDF unico delle etichette: quelle ufficiali del corriere quando salvate, altrimenti le nostre 10×15 */
export async function labelsPdf(supabase: SupabaseClient, courier: string, keys: string[]): Promise<Uint8Array> {
	const { data } = await supabase.from('orders').select('*').in('checkout_group', keys);
	const groups = groupOrders((data ?? []) as OrderRow[]);
	const merged = await PDFDocument.create();
	const internal: OrderGroup[] = [];
	for (const g of groups) {
		const path = g.items[0].courier_label_path;
		if (path) {
			const { data: f } = await supabase.storage.from('order-files').download(path);
			if (f) { const src = await PDFDocument.load(await f.arrayBuffer()); for (const p of await merged.copyPages(src, src.getPageIndices())) merged.addPage(p); continue; }
		}
		internal.push(g);
	}
	if (internal.length) {
		const pdf = await buildLabelsPdf(internal.map((g) => ({ number: g.number, customer: g.customer, shipping: g.items[0].shipping ?? {}, email: g.email, parcels: g.items[0].parcels ?? 1, courier, items: g.items.map((i) => ({ qty: i.qty, name: i.product_name, meta: itemMeta(i) })) })));
		const src = await PDFDocument.load(pdf);
		for (const p of await merged.copyPages(src, src.getPageIndices())) merged.addPage(p);
	}
	return merged.save();
}

/** Trasmette al corriere le spedizioni con etichette generate e crea il manifest (borderò) da consegnare all'autista */
export async function transmitShipments(supabase: SupabaseClient, courier: string, keys: string[]): Promise<{ manifestId: string; number: string; count: number; warnings: string[] }> {
	const { data } = await supabase.from('orders').select('*').in('checkout_group', keys);
	const groups = groupOrders((data ?? []) as OrderRow[]);
	if (!groups.length) throw new Error('Nessuna spedizione da trasmettere.');
	const adapter = adapterFor(courier);
	const warnings: string[] = [];
	let apiRaw: unknown = null; let officialPdf: Uint8Array | null = null;
	if (adapter?.configured) {
		try { const r = await adapter.closeDay(groups.map((g) => ({ tracking: g.items[0].tracking_number ?? '', orderNumber: g.number })).filter((s) => s.tracking)); apiRaw = r.raw ?? null; officialPdf = r.manifestPdf; }
		catch (e) { warnings.push(`Trasmissione API ${courier}: ${e instanceof Error ? e.message : 'errore'} (manifest interno generato comunque)`); }
	} else warnings.push(`${courier} non è ancora collegato via API: manifest interno da consegnare all'autista.`);
	const day = todayIso();
	const { count } = await supabase.from('courier_manifests').select('id', { count: 'exact', head: true }).eq('courier', courier).eq('day', day);
	const number = `${courier.toUpperCase()}-${day}-${(count ?? 0) + 1}`;
	const shipments = groups.map((g) => { const s = g.items[0].shipping ?? {}; return { group: g.key, order_number: g.number, customer: g.customer, city: s.city ?? '', zip: s.zip ?? '', parcels: g.items[0].parcels ?? 1, weight_kg: g.items[0].weight_kg, tracking: g.items[0].tracking_number ?? null }; });
	const { data: row, error } = await supabase.from('courier_manifests').insert({ courier, number, day, shipments, api_response: apiRaw }).select('id').single();
	if (error || !row) throw new Error(error?.message ?? 'Manifest non salvato');
	if (officialPdf) { const path = `manifests/${row.id}.pdf`; const { error: ue } = await supabase.storage.from('order-files').upload(path, officialPdf, { contentType: 'application/pdf', upsert: true }); if (!ue) await supabase.from('courier_manifests').update({ pdf_path: path }).eq('id', row.id); }
	await supabase.from('orders').update({ transmitted_at: new Date().toISOString(), manifest_id: row.id }).in('checkout_group', keys);
	return { manifestId: row.id, number, count: groups.length, warnings };
}

export async function manifestPdf(supabase: SupabaseClient, id: string): Promise<{ pdf: Uint8Array; number: string } | null> {
	const { data: m } = await supabase.from('courier_manifests').select('*').eq('id', id).maybeSingle();
	if (!m) return null;
	if (m.pdf_path) { const { data: f } = await supabase.storage.from('order-files').download(m.pdf_path); if (f) return { pdf: new Uint8Array(await f.arrayBuffer()), number: m.number }; }
	return { pdf: await buildManifestPdf({ courier: m.courier, number: m.number, day: m.day, shipments: m.shipments ?? [] }), number: m.number };
}
