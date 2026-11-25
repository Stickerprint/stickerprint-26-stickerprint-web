/** Metodi di pagamento e calcolo delle scadenze (condivisi tra dashboard e server). */
import type { Lang } from '$lib/i18n';
import { perLingua, t as tradotto } from '$lib/traduzioni';
export interface PaymentMethod { id: string; name: string; xml_code: string; days: number; end_of_month: boolean; installments: number; paid_upfront: boolean; custom: boolean; active: boolean; sort: number }
export interface PaymentTerm { due: string; amount: number; method: string; xml_code: string }

/** E-commerce: solo PayPal e carta (Stripe) */
export const ECOMMERCE_METHODS: Record<string, { label: string; xml_code: string; icon: string }> = {
	paypal: { label: 'PayPal', xml_code: 'MP08', icon: '/icons/pay/paypal.svg' },
	stripe: { label: 'Carta di credito (Stripe)', xml_code: 'MP08', icon: '/icons/pay-stripe.svg' },
	wallet: { label: 'Apple Pay / Google Pay (Stripe)', xml_code: 'MP08', icon: '/icons/pay-stripe.svg' },
	test: { label: 'Test (nessun addebito)', xml_code: 'MP08', icon: '' }
};
export const paymentLabel = (m: string | null | undefined) => (m ? (ECOMMERCE_METHODS[m]?.label ?? m) : '—');
/** etichetta nella lingua del cliente (pagine pubbliche): i metodi e-commerce dal catalogo, i nomi dei metodi manuali (dati del DB) restano come sono */
export function paymentLabelFor(m: string | null | undefined, lang: Lang): string {
	if (!m) return '—';
	if (lang === 'it') return paymentLabel(m);
	const k = `account.doc.metodi.${m}`;
	const s = tradotto(perLingua(lang), k);
	return s === k ? paymentLabel(m) : s;
}
export const paymentIcon = (m: string | null | undefined) => (m ? (ECOMMERCE_METHODS[m]?.icon ?? '') : '');

const iso = (d: Date) => d.toISOString().slice(0, 10);
const r2 = (v: number) => Math.round(v * 100) / 100;
/** Scadenze secondo la regola del metodo: "f.m." = fine mese della data documento, poi i giorni per ogni rata */
export function computeTerms(m: Pick<PaymentMethod, 'name' | 'xml_code' | 'days' | 'end_of_month' | 'installments'>, total: number, issued: string | Date): PaymentTerm[] {
	/* I conti sulle date si fanno in UTC. Prima si mescolavano ora locale e UTC: nel browser (Italia) le scadenze "fine mese"
	   uscivano un giorno prima di quelle calcolate dal server (30 gg f.m. dal 25/11: 29/12 nell'editor dell'ordine, 30/12
	   sulla fattura creata dai DDT), e una scadenza a cavallo del cambio dell'ora poteva perdere un giorno.
	   Una data scritta AAAA-MM-GG e' quel giorno; un Date ("adesso") vale per il giorno di chi guarda. */
	const d = new Date(issued);
	const [y, mo, g] = typeof issued === 'string' ? [d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()] : [d.getFullYear(), d.getMonth(), d.getDate()];
	const d0 = new Date(Date.UTC(y, mo, g));
	const base = m.end_of_month ? new Date(Date.UTC(y, mo + 1, 0)) : d0;
	const n = Math.max(1, m.installments || 1);
	const each = r2(total / n);
	return Array.from({ length: n }, (_, i) => {
		const due = new Date(base);
		due.setUTCDate(due.getUTCDate() + m.days * (i + 1 === 1 && !m.end_of_month && m.days === 0 ? 0 : i + 1));
		return { due: iso(m.days === 0 ? d0 : due), amount: i === n - 1 ? r2(total - each * (n - 1)) : each, method: m.name, xml_code: m.xml_code };
	});
}

/** Metodo proposto nei preventivi nuovi (Mattia, 25/11/2026): «Pagamento anticipato», non «Bonifico bancario vista
 *  fattura». Con il bonifico a vista fattura il cliente aspettava la fattura per pagare e noi il pagamento per partire.
 *  E' un metodo di Setup > Metodi di pagamento con «incassato prima della spedizione»: il cliente paga con carta,
 *  PayPal o bonifico dalla pagina dell'ordine. Se in Setup non c'e', vale il primo metodo come prima. */
export const METODO_PREVENTIVI = 'Pagamento anticipato';
/** un metodo che si paga prima: lo dice il nome (i testi proposti allo staff non hanno sotto mano i metodi di Setup) */
export const metodoAnticipato = (nome: string | null | undefined): boolean => /anticipat/i.test(nome ?? '');

/* ---------- metodo di pagamento salvato in anagrafica (Mattia, 25/11/2026) ---------- */
/** Solo le aziende hanno un metodo di pagamento abituale: in anagrafica e' azienda chi ha la partita IVA */
export const clienteAzienda = (c: { kind?: string | null; vat?: string | null } | null | undefined): boolean => !!c && (c.kind === 'azienda' || !!String(c.vat ?? '').trim());
/** Il metodo abituale del cliente fra quelli attivi: null se non e' un'azienda, non l'ha scelto o il metodo non c'e' piu' */
export function metodoAbituale(c: { kind?: string | null; vat?: string | null; payment_method_id?: string | null } | null | undefined, methods: PaymentMethod[]): PaymentMethod | null {
	if (!clienteAzienda(c) || !c?.payment_method_id) return null;
	return methods.find((m) => m.id === c.payment_method_id && m.active !== false) ?? null;
}
/** Scadenze della fattura creata dai DDT. Vince il metodo abituale del cliente, a meno che l'ordine sia gia' pagato
 *  (allora restano le scadenze dell'ordine) o il metodo sia "a rate personalizzate" (le date non si calcolano).
 *  Senza metodo abituale vale la regola di prima: le scadenze del DDT se e' uno solo, altrimenti quelle di `ripiego`. */
export function scadenzeFattura(o: { abituale: PaymentMethod | null; pagato: boolean; delDdt: PaymentTerm[] | null; ripiego: () => PaymentTerm[]; totale: number; data: string }): { terms: PaymentTerm[]; daAnagrafica: boolean } {
	if (o.abituale && !o.abituale.custom && !o.pagato) return { terms: computeTerms(o.abituale, o.totale, o.data), daAnagrafica: true };
	return { terms: o.delDdt?.length ? o.delDdt : o.ripiego(), daAnagrafica: false };
}
