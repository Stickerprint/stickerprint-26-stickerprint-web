/**
 * Dati veri per l'assistente automatico: listino (stesso motore del configuratore), FAQ, stato ordini.
 * Tutto in sola lettura, con la chiave di servizio (il bot gira fuori da una sessione utente).
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { PRODUCT_ENGINES, quoteWith, type EngineConfig } from '$lib/pricing/engine';
import { PRODUCTS, KIT } from '$lib/products';
import { ORDER_STATUS, PROD_STAGES } from '$lib/dashboard/orders';
import { loadEngine } from './../pricing';
import { loadFaq } from './../faq';

export const SITO = 'https://stickerprint.it';
export const KIT_PREZZO = KIT.price.replace(/€$/, " €");

export async function caricaListino(db: SupabaseClient): Promise<Record<string, EngineConfig>> {
	const out: Record<string, EngineConfig> = {};
	for (const p of PRODUCT_ENGINES) out[p.slug] = (await loadEngine(db, p.slug)).config;
	return out;
}

/** descrizione compatta del listino per il prompt: prodotti, sagome, materiali, finiture, quantità, misure */
export function descrizioneProdotti(engines: Record<string, EngineConfig>): string {
	return PRODUCT_ENGINES.map((p) => {
		const cfg = engines[p.slug];
		const shapes = cfg.shapes.filter((s) => s.visible).map((s) => s.id).join('/');
		const mats = cfg.materials.filter((m) => m.visible).map((m) => `${m.id} (${m.label})`).join(', ');
		const fins = cfg.finishes.filter((f) => f.visible).map((f) => f.id).join('/');
		const min = cfg.size.minByShape ? Object.entries(cfg.size.minByShape).map(([k, v]) => `${k} ${v}mm`).join(', ') : `${cfg.size.minMm}mm`;
		return `- ${p.name} (slug ${p.slug}, pagina ${SITO}${p.href}): sagome ${shapes}; materiali ${mats}; finiture ${fins || 'nessuna'}; quantità proposte ${cfg.quantities.join('/')} (minimo ${cfg.quantities[0]} pz); misura minima lato corto ${min}, massima ${cfg.size.maxMm} mm.`;
	}).join('\n');
}

export type PrezzoInput = { prodotto: string; larghezza_mm: number; altezza_mm?: number; quantita: number; forma?: string; materiale?: string; finitura?: string };
export function calcolaPrezzo(engines: Record<string, EngineConfig>, i: PrezzoInput) {
	const cfg = engines[i.prodotto];
	if (!cfg) return { errore: `prodotto sconosciuto: ${i.prodotto}. Usa uno tra ${Object.keys(engines).join(', ')}` };
	const w = Number(i.larghezza_mm), h = Number(i.altezza_mm || i.larghezza_mm), qty = Math.round(Number(i.quantita));
	if (!(w > 0) || !(h > 0) || !(qty > 0)) return { errore: 'servono larghezza, altezza (mm) e quantità' };
	const shapeIds = cfg.shapes.filter((s) => s.visible).map((s) => s.id);
	const shape = i.forma && shapeIds.includes(i.forma) ? i.forma : shapeIds[0];
	const mat = cfg.materials.find((m) => m.visible && m.id === i.materiale)?.id ?? cfg.materials.find((m) => m.visible)!.id;
	const fin = cfg.finishes.find((f) => f.visible && f.id === i.finitura)?.id ?? cfg.finishes.find((f) => f.visible)?.id ?? 'nessuna';
	const minQty = cfg.quantities[0];
	const minSide = cfg.size.minByShape?.[shape] ?? cfg.size.minMm;
	const note: string[] = [];
	if (qty < minQty) note.push(`quantità minima ${minQty} pz: prezzo calcolato su ${minQty}`);
	if (Math.min(w, h) < minSide) note.push(`misura minima ${minSide} mm sul lato corto per la sagoma ${shape}`);
	if (Math.max(w, h) > cfg.size.maxMm) note.push(`misura massima ${cfg.size.maxMm} mm`);
	const q = quoteWith(cfg, { w, h, forma: shape, materiale: mat, finitura: fin, qty: Math.max(qty, minQty), vatIncluded: true });
	const p = PRODUCT_ENGINES.find((x) => x.slug === i.prodotto)!;
	const n = Math.max(qty, minQty);
	return {
		prodotto: p.name, misura: `${w}×${h} mm`, sagoma: shape, materiale: mat, finitura: fin, quantita: n,
		totale_iva_inclusa: Math.round(q.gross * 100) / 100, totale_netto: q.net, prezzo_pezzo_iva_inclusa: Math.round((q.gross / n) * 1000) / 1000,
		spedizione: q.gross >= 50 ? 'gratuita' : '10 € (15 € Sicilia/Sardegna/Calabria)', link: `${SITO}${p.href}`, note
	};
}

export async function testoFaq(db: SupabaseClient): Promise<string> {
	const cats = await loadFaq(db);
	const out: string[] = [];
	for (const c of cats) for (const i of c.items) out.push(`Q: ${i.q}\nA: ${i.a}`);
	for (const p of Object.values(PRODUCTS)) for (const f of p.faq ?? []) out.push(`Q: ${f.q}\nA: ${f.a}`);
	return out.join('\n\n');
}

export async function statoOrdine(db: SupabaseClient, { numero, email }: { numero?: string; email?: string }) {
	const n = String(numero ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
	const e = String(email ?? '').trim().toLowerCase();
	if (!n || !e) return { errore: 'servono numero ordine ed email' };
	const { data: rows } = await db.from('orders').select('number,status,prod_stage,product_name,qty,width_mm,height_mm,shipped_at,delivered_at,tracking_url,courier,created_at,ship_by').ilike('number', n).ilike('email', e);
	if (!rows?.length) return { trovato: false, nota: 'nessun ordine con questo numero e questa email (controlla maiuscole e indirizzo usato per ordinare)' };
	const dmy = (s: string | null) => (s ? new Date(s).toLocaleDateString('it-IT') : null);
	return { trovato: true, ordini: rows.map((r) => ({ numero: r.number, data: dmy(r.created_at), stato: ORDER_STATUS[r.status]?.label ?? r.status, fase: r.status === 'in_produzione' && r.prod_stage ? PROD_STAGES[r.prod_stage] ?? r.prod_stage : undefined, prodotto: `${r.product_name} ${r.width_mm}×${r.height_mm} mm × ${r.qty}`, spedizione_prevista: dmy(r.ship_by), spedito_il: dmy(r.shipped_at), consegnato_il: dmy(r.delivered_at), corriere: r.courier, tracking: r.tracking_url })) };
}
