/**
 * Home della dashboard: il riepilogo che Mattia apre ogni mattina.
 * Tutte letture leggere: fatture degli ultimi 12 mesi (poche colonne), gli ordini con una scadenza entro oggi,
 * gli ordini creati oggi, i ticket da rispondere e l'ultimo rating dei margini gia' salvato (niente ricalcolo).
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { groupOrders, thumbOf, toShip, ORDER_STATUS, PROD_STAGES, type OrderRow } from '$lib/dashboard/orders';
import { COLONNE_FATTURATO, fatturatoPerMese, sommaMesi, type FatturaRiga, type MeseFatturato } from '$lib/dashboard/fatturato';
import { giornoRoma, inizioGiornoRoma, ultimiMesi } from '$lib/dashboard/tempo';
import { OPEN_TICKET, waitingHours, type Ticket } from '$lib/dashboard/helpdesk';
import { mesePrima, ultimiRating, type RigaRating } from '$lib/server/margini-rating';

type DB = SupabaseClient;

export interface OrdineHome {
	key: string; number: string; customer: string; channel: string; thumb: string | null; prodotto: string; articoli: number; qty: number; gross: number;
	created_at: string; status: string; statoLabel: string; statoColore: string; statoSfondo: string; shipBy: string | null; express: boolean;
	/** per "devono partire": pronto = uscito dalla produzione e da spedire; produzione = ancora in lavorazione; ritardo = la data promessa e' gia' passata */
	pronto: boolean; ritardo: boolean; fase: string | null; href: string;
}
export interface TicketHome { id: string; number: string; subject: string | null; name: string | null; email: string; kind: string; status: string; ore: number | null; order_number: string | null; href: string }
export interface MarginiHome { mese: string; lettera: string; punteggio: number; giudizio: string; definitivo: boolean; datiFinoAl: string; fatturato: number; costoProduzione: number; ads: number | null; margineNetto: number; margineNettoPct: number | null; roas: number | null; ordini: number; prima: { mese: string; lettera: string; margineNettoPct: number | null } | null }

/** anteprime: i proof importati dal vecchio sito sono percorsi nel bucket privato, vanno firmati */
async function firmaAnteprime(db: DB, groups: ReturnType<typeof groupOrders>): Promise<Map<string, string | null>> {
	const out = new Map<string, string | null>();
	const daFirmare: { key: string; path: string }[] = [];
	for (const g of groups) {
		const item = g.items.find((i) => thumbOf(i)) ?? g.items[0];
		const t = thumbOf(item);
		if (t && !/^https?:\/\//.test(t)) daFirmare.push({ key: g.key, path: t }); else out.set(g.key, t);
	}
	if (daFirmare.length) {
		const { data } = await db.storage.from('order-files').createSignedUrls(daFirmare.map((x) => x.path), 3600);
		daFirmare.forEach((x, i) => out.set(x.key, data?.[i]?.signedUrl ?? null));
	}
	return out;
}
function daGruppo(g: ReturnType<typeof groupOrders>[number], thumb: string | null, oggi: string): OrdineHome {
	const st = ORDER_STATUS[g.status] ?? { label: g.status, color: '#6b7280', soft: '#eceef3' };
	const pronto = g.items.every((i) => toShip(i) || ['spedito', 'in_consegna', 'consegnato'].includes(i.status));
	const inLav = g.items.find((i) => i.status === 'in_produzione');
	const first = g.items[0];
	return {
		key: g.key, number: g.number, customer: g.customer, channel: g.channel, thumb, prodotto: first.product_name, articoli: g.items.length, qty: g.qty, gross: g.gross,
		created_at: g.created_at, status: g.status, statoLabel: st.label, statoColore: st.color, statoSfondo: st.soft, shipBy: g.shipBy, express: g.express,
		pronto, ritardo: !!g.shipBy && g.shipBy < oggi, fase: inLav?.prod_stage ? (PROD_STAGES[inLav.prod_stage] ?? inLav.prod_stage) : null,
		href: `/dashboard/fatturazione/ordini/${g.key}`
	};
}

/** fatturato netto degli ultimi 12 mesi, e-commerce e manuale, piu' il totale dell'anno in corso */
export async function fatturatoHome(db: DB, oggi: string): Promise<{ mesi: MeseFatturato[]; anno: MeseFatturato; meseCorrente: string }> {
	const mesi = ultimiMesi(oggi.slice(0, 7), 12);
	const { data } = await db.from('invoices').select(COLONNE_FATTURATO).gte('issued_at', `${mesi[0]}-01`).order('issued_at').limit(5000);
	const perMese = fatturatoPerMese((data ?? []) as FatturaRiga[], mesi);
	const anno = sommaMesi(perMese.filter((m) => m.mese.startsWith(oggi.slice(0, 4))));
	return { mesi: perMese, anno, meseCorrente: oggi.slice(0, 7) };
}

/** ordini con data di spedizione promessa entro oggi e non ancora partiti: pronti da spedire o ancora in lavorazione (in ritardo se la data e' passata) */
export async function ordiniDaPartire(db: DB, oggi: string): Promise<OrdineHome[]> {
	const { data } = await db.from('orders').select('*').in('status', ['in_produzione', 'pronto', 'in_spedizione']).lte('ship_by', oggi).is('transmitted_at', null).order('ship_by').limit(400);
	const groups = groupOrders((data ?? []) as OrderRow[]).filter((g) => g.items.some((i) => i.status === 'in_produzione' || toShip(i)));
	const thumbs = await firmaAnteprime(db, groups);
	return groups.map((g) => daGruppo(g, thumbs.get(g.key) ?? null, oggi)).sort((a, b) => (a.shipBy ?? '').localeCompare(b.shipBy ?? '') || a.created_at.localeCompare(b.created_at));
}

/** ordini arrivati oggi (ora italiana), senza i checkout abbandonati e gli annullati */
export async function nuoviOrdiniOggi(db: DB, oggi: string): Promise<OrdineHome[]> {
	const { data } = await db.from('orders').select('*').gte('created_at', inizioGiornoRoma(oggi).toISOString()).or('channel.neq.ecommerce,status.neq.attesa_pagamento').neq('status', 'annullato').order('created_at', { ascending: false }).limit(400);
	const groups = groupOrders((data ?? []) as OrderRow[]);
	const thumbs = await firmaAnteprime(db, groups);
	return groups.map((g) => daGruppo(g, thumbs.get(g.key) ?? null, oggi));
}

/** richieste di aiuto che aspettano una nostra risposta (nuove o con un messaggio del cliente non letto), le piu' vecchie prima */
export async function assistenzaDaRispondere(db: DB): Promise<{ ticket: TicketHome[]; aperti: number; aziendeNuove: number }> {
	const [{ data }, { count }] = await Promise.all([
		db.from('tickets').select('*').in('status', OPEN_TICKET).order('last_message_at', { ascending: true }).limit(200),
		db.from('contact_requests').select('id', { count: 'exact', head: true }).eq('kind', 'aziende').eq('status', 'new')
	]);
	const tutti = (data ?? []) as Ticket[];
	const ticket = tutti.filter((t) => t.status === 'nuovo' || t.unread).map((t) => ({ id: t.id, number: t.number, subject: t.subject, name: t.name, email: t.email, kind: t.kind, status: t.status, ore: waitingHours(t), order_number: t.order_number, href: `/dashboard/supporto/ticket/${t.id}` }));
	return { ticket, aperti: tutti.length, aziendeNuove: count ?? 0 };
}

/** il rating dei margini gia' salvato: il mese in corso se c'e' (provvisorio, aggiornato ogni lunedi'), altrimenti il mese scorso */
export async function marginiHome(db: DB, oggi: string): Promise<MarginiHome | null> {
	const mese = oggi.slice(0, 7), prima = mesePrima(mese);
	const righe = await ultimiRating(db, [mese, prima, mesePrima(prima)]);
	const r = righe[mese] ?? righe[prima];
	if (!r) return null;
	const p = righe[mesePrima(r.mese)] ?? null;
	const conv = (x: RigaRating): MarginiHome => ({
		mese: x.mese, lettera: x.lettera, punteggio: Number(x.punteggio), giudizio: x.dati.rating.giudizio, definitivo: x.definitivo, datiFinoAl: x.dati_fino_al,
		fatturato: x.dati.input.fatturato, costoProduzione: x.dati.input.costoProduzione, ads: x.dati.input.ads, margineNetto: x.dati.rating.metriche.margineNetto, margineNettoPct: x.dati.rating.metriche.margineNettoPct,
		roas: x.dati.rating.metriche.roas, ordini: x.dati.input.ordini, prima: null
	});
	const out = conv(r);
	if (p) out.prima = { mese: p.mese, lettera: p.lettera, margineNettoPct: p.dati.rating.metriche.margineNettoPct };
	return out;
}

export async function caricaHome(db: DB) {
	const oggi = giornoRoma();
	const [fatturato, daPartire, nuovi, assistenza, margini] = await Promise.all([fatturatoHome(db, oggi), ordiniDaPartire(db, oggi), nuoviOrdiniOggi(db, oggi), assistenzaDaRispondere(db), marginiHome(db, oggi).catch(() => null)]);
	return { oggi, fatturato, daPartire, nuovi, assistenza, margini };
}
