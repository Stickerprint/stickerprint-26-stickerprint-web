/** Metodi di pagamento e calcolo delle scadenze (condivisi tra dashboard e server). */
export interface PaymentMethod { id: string; name: string; xml_code: string; days: number; end_of_month: boolean; installments: number; paid_upfront: boolean; custom: boolean; active: boolean; sort: number }
export interface PaymentTerm { due: string; amount: number; method: string; xml_code: string }

/** E-commerce: solo PayPal e carta (Stripe) */
export const ECOMMERCE_METHODS: Record<string, { label: string; xml_code: string; icon: string }> = {
	paypal: { label: 'PayPal', xml_code: 'MP08', icon: '/icons/footer/paypal.webp' },
	stripe: { label: 'Carta di credito (Stripe)', xml_code: 'MP08', icon: '/icons/pay-stripe.svg' },
	test: { label: 'Test (nessun addebito)', xml_code: 'MP08', icon: '' }
};
export const paymentLabel = (m: string | null | undefined) => (m ? (ECOMMERCE_METHODS[m]?.label ?? m) : '—');
export const paymentIcon = (m: string | null | undefined) => (m ? (ECOMMERCE_METHODS[m]?.icon ?? '') : '');

const iso = (d: Date) => d.toISOString().slice(0, 10);
const r2 = (v: number) => Math.round(v * 100) / 100;
/** Scadenze secondo la regola del metodo: "f.m." = fine mese della data documento, poi i giorni per ogni rata */
export function computeTerms(m: Pick<PaymentMethod, 'name' | 'xml_code' | 'days' | 'end_of_month' | 'installments'>, total: number, issued: string | Date): PaymentTerm[] {
	const d0 = new Date(issued);
	const base = m.end_of_month ? new Date(d0.getFullYear(), d0.getMonth() + 1, 0) : d0;
	const n = Math.max(1, m.installments || 1);
	const each = r2(total / n);
	return Array.from({ length: n }, (_, i) => {
		const due = new Date(base);
		due.setDate(due.getDate() + m.days * (i + 1 === 1 && !m.end_of_month && m.days === 0 ? 0 : i + 1));
		return { due: iso(m.days === 0 ? d0 : due), amount: i === n - 1 ? r2(total - each * (n - 1)) : each, method: m.name, xml_code: m.xml_code };
	});
}
