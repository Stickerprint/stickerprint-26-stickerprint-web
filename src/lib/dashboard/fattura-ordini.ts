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

/** Perche' un ordine NON si puo' fatturare da qui (null = si puo'). Oltre agli annullati e a quelli che hanno gia' una
 *  fattura nel sistema, restano fuori gli ordini che una fattura ce l'hanno altrove:
 *  - quelli importati da Fatture in Cloud (gennaio-agosto 2026, fatturati la'): le note interne lo dicono;
 *  - quelli arrivati dal vecchio sito (`legacy_id`), fatturati dal vecchio sito;
 *  - quelli del sito, che la fattura la ricevono dal checkout al momento del pagamento.
 *  Senza questa regola «seleziona tutti» su Metrica proponeva 20 ordini gia' fatturati in Fatture in Cloud (27.707 €). */
export function nonFatturabile(g: Pick<OrderGroup, 'key' | 'status' | 'channel' | 'items'>, fatturati: Record<string, string>): string | null {
	if (g.status === 'annullato') return 'Ordine annullato';
	if (fatturati[g.key]) return `Fattura ${fatturati[g.key]}`;
	if (g.items.some((i) => /importato da fatture in cloud/i.test(i.internal_notes ?? ''))) return 'Importato da Fatture in Cloud: già fatturato lì';
	if (g.items.some((i) => i.legacy_id != null) || /^legacy-/.test(g.key)) return 'Ordine del vecchio sito: fatturato dal vecchio sito';
	if (g.channel === 'ecommerce') return 'Ordine del sito: la fattura nasce dal checkout al pagamento';
	return null;
}
/** Un ordine si puo' fatturare da qui (`fatturati`: chiave dell'ordine → numero della fattura) */
export const fatturabile = (g: Pick<OrderGroup, 'key' | 'status' | 'channel' | 'items'>, fatturati: Record<string, string>): boolean => nonFatturabile(g, fatturati) === null;

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
