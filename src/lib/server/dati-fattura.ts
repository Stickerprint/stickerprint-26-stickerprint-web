/**
 * Dati di fatturazione completati dal cliente (Mattia, 25/11/2026): dalla pagina della conferma d'ordine, prima di
 * pagare, e dalla pagina del preventivo, al momento della conferma. La regola su cosa serve sta in $lib/dati-fattura.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { datiFatturaMancanti, type CampoMancante, type DatiFattura, type DatiFatturaCompleti } from '$lib/dati-fattura';
import type { OrderDraft } from '$lib/dashboard/orderDraft';
import type { OrderGroup } from '$lib/dashboard/orders';
import { upsertContact } from './orders';
import { pushStaff } from './push';

type Db = SupabaseClient;
type Completi = DatiFatturaCompleti;
type Cliente = OrderDraft['customer'];

/** gli ordini e-commerce hanno gia' i dati del checkout: il modulo vale solo per gli ordini inseriti dallo staff */
export const chiedeDatiFattura = (g: Pick<OrderGroup, 'channel' | 'items'>): CampoMancante[] =>
	g.channel === 'ecommerce' ? [] : datiFatturaMancanti(g.items[0]?.billing as DatiFattura | null);

/** i dati di fatturazione come cliente della bozza (ordini, preventivi) e dell'anagrafica */
const comeCliente = (d: Completi, prima: Partial<Cliente>): Cliente => ({
	name: d.company || [d.first_name, d.last_name].filter(Boolean).join(' ') || prima.name || '',
	first_name: d.first_name || prima.first_name || '', last_name: d.last_name || prima.last_name || '',
	address: d.street, city: d.city, cap: d.zip, province: d.province, country: d.country,
	piva: d.vat, cf: d.fiscal_code, sdi: d.sdi, pec: d.pec, email: prima.email ?? '', phone: prima.phone ?? ''
});
/** un preventivo ha il cliente nella bozza: gli stessi dati visti come `billing` */
export const clienteComeFattura = (c: Partial<Cliente> | null | undefined): DatiFattura => ({
	company: c?.name ?? '', first_name: c?.first_name ?? '', last_name: c?.last_name ?? '', vat: c?.piva ?? '', fiscal_code: c?.cf ?? '', sdi: c?.sdi ?? '', pec: c?.pec ?? '',
	street: c?.address ?? '', zip: c?.cap ?? '', city: c?.city ?? '', province: c?.province ?? '', country: c?.country || 'IT'
});

/** Anagrafica del cliente: quella gia' collegata, altrimenti quella con la stessa partita IVA o la stessa email; se non
 *  c'e' se ne crea una. Su un'anagrafica che esiste si scrivono solo i dati fiscali e l'indirizzo: email, telefono e
 *  note restano quelli che ha messo lo staff. */
async function aggiornaAnagrafica(db: Db, id: string | null, c: Cliente): Promise<string | null> {
	let target = id;
	if (!target && c.piva) { const { data } = await db.from('contacts').select('id').eq('vat', c.piva).limit(1); target = (data?.[0]?.id as string | undefined) ?? null; }
	if (!target && c.email) { const { data } = await db.from('contacts').select('id').ilike('email', c.email).limit(1); target = (data?.[0]?.id as string | undefined) ?? null; }
	if (!target) return (await upsertContact(db, c, null)).id;
	await db.from('contacts').update({ kind: c.piva ? 'azienda' : 'privato', name: c.name, first_name: c.first_name || null, last_name: c.last_name || null, street: c.address || null, city: c.city || null, zip: c.cap || null, province: c.province || null, country: c.country || 'IT', vat: c.piva || null, fiscal_code: c.cf || null, sdi: c.sdi || null, pec: c.pec || null, updated_at: new Date().toISOString() }).eq('id', target);
	return target;
}

/** Scrive i dati sull'ordine (tutte le righe), sull'indirizzo di spedizione se era vuoto e sull'anagrafica del cliente */
export async function salvaDatiFatturaOrdine(db: Db, g: OrderGroup, d: Completi): Promise<string | null> {
	const f = g.items[0];
	const prima = (f.billing ?? {}) as Record<string, string>;
	const billing = { ...prima, company: d.company, first_name: d.first_name, last_name: d.last_name, vat: d.vat, fiscal_code: d.fiscal_code, sdi: d.sdi, pec: d.pec, street: d.street, zip: d.zip, city: d.city, province: d.province, country: d.country };
	/* spedizione "uguale alla fatturazione" di un ordine nato senza indirizzo: si completa anche quella */
	const sp = (f.shipping ?? {}) as Record<string, string>;
	const shipping = String(sp.street ?? '').trim() ? sp : { ...sp, company: sp.company || d.company, first_name: sp.first_name || d.first_name, last_name: sp.last_name || d.last_name, street: d.street, zip: d.zip, city: d.city, province: d.province, country: d.country };
	const cliente = comeCliente(d, { name: f.customer_name ?? g.customer, email: g.email, phone: prima.phone ?? '' });
	/* anagrafica: quella collegata all'ordine, altrimenti quella con la stessa partita IVA o email (o una nuova) */
	const contatto = { id: await aggiornaAnagrafica(db, f.contact_id ?? null, cliente) };
	const patch: Record<string, unknown> = { billing, shipping, country: d.country, customer_name: f.customer_name || cliente.name, updated_at: new Date().toISOString() };
	if (contatto.id && !f.contact_id) patch.contact_id = contatto.id;
	const q = db.from('orders').update(patch);
	const { error } = await (f.checkout_group ? q.eq('checkout_group', f.checkout_group) : q.eq('id', f.id));
	if (error) return error.message;
	await pushStaff({ title: `Ordine ${g.number}: dati di fatturazione completati`, body: `${cliente.name}${d.vat ? ` · P.IVA ${d.vat}` : d.fiscal_code ? ` · CF ${d.fiscal_code}` : ''}`, url: `/dashboard/fatturazione/ordini/${g.key}`, tag: `fatt-${g.key}` }).catch(() => {});
	return null;
}

/** Scrive i dati nel cliente della bozza del preventivo (e in anagrafica): l'ordine che ne nasce li ha gia' */
export async function salvaDatiFatturaPreventivo(db: Db, q: { id: string; draft: OrderDraft; contact_id?: string | null }, d: Completi): Promise<string | null> {
	const cliente = comeCliente(d, q.draft.customer);
	const contatto = { id: await aggiornaAnagrafica(db, q.draft.contact_id || q.contact_id || null, cliente) };
	const draft: OrderDraft = { ...q.draft, customer: cliente, contact_id: q.draft.contact_id || contatto.id || null };
	const { error } = await db.from('quotes').update({ draft, contact_id: draft.contact_id || null, updated_at: new Date().toISOString() }).eq('id', q.id);
	return error?.message ?? null;
}
