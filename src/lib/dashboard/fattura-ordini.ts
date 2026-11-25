/**
 * Fattura generata dagli ordini selezionati (Mattia, 25/11/2026). In Ordini si cercano i documenti di un cliente,
 * si spuntano quelli senza fattura e un bottone genera un'unica fattura. Il DDT e' facoltativo: se un ordine ne ha
 * uno non ancora fatturato, entra nella stessa fattura. Qui le regole, senza database: quali ordini si possono
 * spuntare, chi e' "lo stesso cliente", come nascono le righe.
 */
import { CATS, itemMeta, type OrderGroup } from './orders';

export interface RigaFattura { code: string | null; description: string; qty: number; unit_net: number; total_net: number; ddt?: string | null; ddt_date?: string | null }
const r2 = (v: number) => Math.round(v * 100) / 100;

/** Stesso cliente = stessa partita IVA (con o senza IT davanti); senza partita IVA, stesso nome. E' la regola dei DDT. */
export function chiaveCliente(cliente: Record<string, string> | null | undefined, nome: string | null | undefined): string {
	const piva = String(cliente?.vat ?? '').replace(/^IT/i, '').replace(/\s+/g, '').trim();
	return piva ? 'vat:' + piva : 'name:' + String(cliente?.company || nome || '').toLowerCase().trim();
}
export const chiaveClienteOrdine = (g: Pick<OrderGroup, 'items' | 'customer'>) => chiaveCliente(g.items[0]?.billing as Record<string, string> | null, g.customer);

/** Un ordine si puo' fatturare da qui se non e' annullato e non ha gia' una fattura (`fatturati`: chiave dell'ordine → numero della fattura) */
export const fatturabile = (g: Pick<OrderGroup, 'key' | 'status'>, fatturati: Record<string, string>): boolean => g.status !== 'annullato' && !fatturati[g.key];

/** Righe della fattura: una per riga d'ordine, con il riferimento al DDT se l'ordine ne ha uno. Con piu' ordini,
 *  le righe senza DDT dicono da quale ordine arrivano. */
export function righeDaOrdini(groups: Pick<OrderGroup, 'key' | 'number' | 'items'>[], ddtDi: Record<string, { number: string; issued_at: string }> = {}): RigaFattura[] {
	const piu = groups.length > 1;
	return groups.flatMap((g) => g.items.filter((i) => i.status !== 'annullato').map((i) => {
		const ddt = ddtDi[g.key] ?? null;
		const base = `${i.product_name}${itemMeta(i) ? ' · ' + itemMeta(i) : ''}`;
		return {
			code: i.product_code ?? CATS[i.product_slug]?.code ?? null,
			description: piu && !ddt ? `${base} (ordine ${i.number || g.number})` : base,
			/* prezzo unitario fino a 4 decimali (0,295 €), come nella modifica a mano della fattura */
			qty: i.qty, unit_net: Math.round(Number(i.unit_net ?? Number(i.total_net) / i.qty) * 10000) / 10000, total_net: r2(Number(i.total_net)),
			ddt: ddt?.number ?? null, ddt_date: ddt?.issued_at ?? null
		};
	}));
}
export function totaliFattura(righe: RigaFattura[], aliquota = 0.22): { imponibile: number; iva: number; totale: number } {
	const imponibile = r2(righe.reduce((s, l) => s + Number(l.total_net), 0));
	const iva = r2(imponibile * aliquota);
	return { imponibile, iva, totale: r2(imponibile + iva) };
}
