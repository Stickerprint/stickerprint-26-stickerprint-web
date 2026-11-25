/**
 * Fattura generata dagli ordini selezionati in Ordini (Mattia, 25/11/2026). Stessa costruzione della fattura dai DDT
 * (src/routes/dashboard/fatturazione/ddt/+page.server.ts): numero dalla sequenza, PDF nello storage, riga in `invoices`.
 * Le regole senza database stanno in $lib/dashboard/fattura-ordini.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { groupOrders, type OrderGroup, type OrderRow } from '$lib/dashboard/orders';
import { computeTerms, scadenzeFattura, type PaymentMethod, type PaymentTerm } from '$lib/dashboard/payments';
import { chiaveClienteOrdine, righeDaOrdini, totaliFattura } from '$lib/dashboard/fattura-ordini';
import { buildInvoicePdf } from './invoice';
import { linguaDaPaese } from './fatture';
import { leggiTutto } from './leggi-tutto';
import { metodoDelCliente } from './metodo-cliente';
import { righeDelGruppo } from './ordini-gruppo';

type Db = SupabaseClient;

/** Gli ordini che hanno gia' una fattura: numero d'ordine e chiave dell'ordine → numero della fattura.
 *  Una fattura e' collegata all'ordine dal suo `checkout_group` (una sola) o dai numeri in `order_numbers` (anche piu' ordini). */
export async function ordiniFatturati(db: Db): Promise<{ perNumero: Record<string, string>; perGruppo: Record<string, string> }> {
	const { data } = await leggiTutto<{ id: string; number: string; checkout_group: string | null; order_numbers: string[] | null }>((da, a) =>
		db.from('invoices').select('id, number, checkout_group, order_numbers', { count: 'exact' }).order('issued_at', { ascending: false }).order('id').range(da, a));
	const perNumero: Record<string, string> = {}, perGruppo: Record<string, string> = {};
	for (const f of data) {
		if (f.checkout_group) perGruppo[f.checkout_group] = f.number;
		for (const n of f.order_numbers ?? []) perNumero[n] = f.number;
	}
	return { perNumero, perGruppo };
}
/** per l'elenco Ordini: chiave dell'ordine → numero della fattura che lo copre */
export function fatturaDi(g: Pick<OrderGroup, 'key' | 'numbers'>, f: { perNumero: Record<string, string>; perGruppo: Record<string, string> }): string | null {
	return f.perGruppo[g.key] ?? g.numbers.map((n) => f.perNumero[n]).find(Boolean) ?? null;
}

export type EsitoFattura = { ok: false; error: string } | { ok: true; id: string; number: string; ordini: string[]; ddt: string[]; metodoAnagrafica: string | null; pagata: boolean };

/** Un'unica fattura per gli ordini scelti: stesso cliente, nessuno gia' fatturato. I DDT non ancora fatturati di quegli
 *  ordini entrano nella fattura e risultano fatturati. */
export async function fatturaDaOrdini(db: Db, keys: string[]): Promise<EsitoFattura> {
	const scelte = [...new Set(keys.filter(Boolean))];
	if (!scelte.length) return { ok: false, error: 'Seleziona almeno un ordine.' };
	const groups: OrderGroup[] = [];
	for (const k of scelte) {
		const righe = (await righeDelGruppo(db, k)).filter((r) => r.status !== 'annullato');
		if (!righe.length) return { ok: false, error: 'Uno degli ordini selezionati non esiste più o è annullato.' };
		groups.push(groupOrders(righe as OrderRow[])[0]);
	}
	groups.sort((a, b) => a.number.localeCompare(b.number));
	if (new Set(groups.map(chiaveClienteOrdine)).size > 1) return { ok: false, error: 'Si possono unire solo ordini dello stesso cliente (stessa partita IVA).' };
	/* nessuno deve avere gia' una fattura */
	const fatt = await ordiniFatturati(db);
	const gia = groups.map((g) => ({ g, n: fatturaDi(g, fatt) })).filter((x) => x.n);
	if (gia.length) return { ok: false, error: `Già fatturati: ${gia.map((x) => `${x.g.number} (${x.n})`).join(', ')}. Toglili dalla selezione.` };
	/* DDT di questi ordini: quelli non fatturati entrano nella fattura; uno gia' fatturato vuol dire ordine gia' fatturato */
	const { data: ddts } = await db.from('ddts').select('id, number, issued_at, checkout_group, invoice_id').in('checkout_group', groups.map((g) => g.key));
	const fatturato = (ddts ?? []).find((d) => d.invoice_id);
	if (fatturato) return { ok: false, error: `Il DDT ${fatturato.number} di uno degli ordini è già in una fattura.` };
	const ddtDi: Record<string, { number: string; issued_at: string }> = {};
	for (const d of (ddts ?? []).sort((a, b) => String(a.number).localeCompare(String(b.number)))) if (!ddtDi[d.checkout_group as string]) ddtDi[d.checkout_group as string] = { number: d.number as string, issued_at: d.issued_at as string };
	const usati = (ddts ?? []).filter((d) => ddtDi[d.checkout_group as string]?.number === d.number).sort((a, b) => String(a.number).localeCompare(String(b.number)));

	const lines = righeDaOrdini(groups, ddtDi);
	if (!lines.length) return { ok: false, error: 'Gli ordini selezionati non hanno righe da fatturare.' };
	const { imponibile: subtotal, iva: vat, totale: gross } = totaliFattura(lines);
	const first = groups[0], f0 = first.items[0];
	const billing = (f0.billing ?? f0.shipping ?? {}) as Record<string, string>;
	const issued = new Date().toISOString().slice(0, 10);

	/* scadenze: metodo abituale del cliente (anagrafica) se c'e' e gli ordini non sono gia' pagati; altrimenti quelle
	   dell'ordine se e' uno solo, oppure ricalcolate sul totale con il metodo del primo ordine */
	const tutteLeRighe = groups.flatMap((g) => g.items);
	const pagato = tutteLeRighe.every((r) => r.payment_status === 'paid');
	const abituale = await metodoDelCliente(db, f0.checkout_group ?? null, billing.vat);
	const metodoOrdine = first.payment_method ?? 'Bonifico bancario vista fattura';
	let ripiego: PaymentTerm[] = [{ due: issued, amount: gross, method: metodoOrdine, xml_code: 'MP05' }];
	const delOrdine = groups.length === 1 && f0.payment_terms?.length ? (f0.payment_terms as PaymentTerm[]) : null;
	if (!delOrdine) {
		const { data: pm } = await db.from('payment_methods').select('*').eq('name', metodoOrdine).maybeSingle();
		if (pm && !(pm as PaymentMethod).custom) ripiego = computeTerms(pm as PaymentMethod, gross, issued);
	}
	const scelta = scadenzeFattura({ abituale: abituale.metodo, pagato, delDdt: delOrdine, ripiego: () => ripiego, totale: gross, data: issued });
	const terms = scelta.terms;
	const metodoFattura = scelta.daAnagrafica ? abituale.metodo!.name : metodoOrdine;

	const { data: num } = await db.rpc('next_invoice_number');
	const number = num as string | null;
	if (!number) return { ok: false, error: 'Numero di fattura non disponibile, riprova.' };
	const orderNumbers = [...new Set(groups.flatMap((g) => g.numbers))];
	const ddtNumbers = usati.map((d) => d.number as string);
	const email = first.email || null;
	const inv = { lang: linguaDaPaese(billing.country), number, issued_at: issued, email: email ?? '', billing, lines, subtotal_net: subtotal, discount_net: 0, discount_code: null, express_net: 0, credit_used: 0, vat_amount: vat, total_gross: gross, to_pay: gross, payment_method: metodoFattura, orders: orderNumbers, payment_terms: terms, ddt_numbers: ddtNumbers };
	let pdfPath: string | null = null;
	try {
		const bytes = await buildInvoicePdf(inv as never);
		const path = `staff/${number}.pdf`;
		const { error } = await db.storage.from('invoices').upload(path, bytes, { contentType: 'application/pdf', upsert: true });
		if (!error) pdfPath = path;
	} catch (e) { console.error('[ordini→fattura] pdf', e); }
	/* ordini gia' pagati (anticipo incassato): la fattura nasce pagata, cosi' al cliente non viene richiesto di pagare ancora */
	const pagataIl = pagato ? new Date().toISOString() : null;
	const { data: row, error } = await db.from('invoices').insert({
		user_id: f0.user_id ?? null, number, issued_at: issued, amount_gross: gross, pdf_path: pdfPath, email, billing, lines, subtotal_net: subtotal, vat_amount: vat,
		payment_method: metodoFattura, payment_terms: terms, checkout_group: first.key, order_numbers: orderNumbers,
		...(usati.length ? { ddt_id: usati[0].id, ddt_number: usati[0].number, ddt_ids: usati.map((d) => d.id), ddt_numbers: ddtNumbers } : {}),
		...(pagataIl ? { paid_at: pagataIl } : {})
	}).select('id').single();
	if (error || !row) return { ok: false, error: `Fattura non creata: ${error?.message ?? 'errore'}` };
	if (usati.length) await db.from('ddts').update({ invoice_id: row.id }).in('id', usati.map((d) => d.id));
	return { ok: true, id: row.id as string, number, ordini: groups.map((g) => g.number), ddt: ddtNumbers, metodoAnagrafica: scelta.daAnagrafica ? metodoFattura : null, pagata: pagato };
}
