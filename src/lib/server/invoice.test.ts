import { describe, expect, it } from 'vitest';
import { inflateSync } from 'node:zlib';
import { buildInvoicePdf, aliquotaFattura, importiFattura, type InvoiceData } from './invoice';

/** testo disegnato nel PDF: i flussi di pdf-lib sono compressi e le stringhe sono in esadecimale (WinAnsi) */
function testoPdf(bytes: Uint8Array): string {
	const buf = Buffer.from(bytes); const s = buf.toString('latin1'); const out: string[] = [];
	let i = 0;
	for (;;) {
		const a = s.indexOf('stream', i); if (a < 0) break;
		let st = a + 6; if (s[st] === '\r') st++; if (s[st] === '\n') st++;
		const e = s.indexOf('endstream', st); if (e < 0) break; i = e + 9;
		try { const txt = inflateSync(buf.subarray(st, e)).toString('latin1'); for (const m of txt.matchAll(/<([0-9A-Fa-f]+)>\s*Tj/g)) out.push(Buffer.from(m[1], 'hex').toString('latin1')); } catch { /* non e' un flusso di testo */ }
	}
	return out.join(' | ');
}
const base: InvoiceData = {
	number: 'SPF09999', issued_at: '2026-11-08', email: 'cliente@example.com',
	billing: { company: 'Harbor Test LLC', street: '1 Main Street', zip: '33461', city: 'Lake Worth', province: 'FL', country: 'US' },
	lines: [{ code: 'ADR', description: 'Adesivi resinati rettangolare Vinile bianco 76.2×38.1 mm', description_c: 'Dome stickers rectangle White vinyl 76.2×38.1 mm', qty: 100, unit_net: 0.8709, total_net: 87.09 }],
	subtotal_net: 87.09, discount_net: 0, express_net: 0, credit_used: 0, vat_amount: 0, total_gross: 87.09, to_pay: 87.09,
	payment_method: 'stripe', orders: ['SP09999'], payment_terms: [{ due: '2026-11-08', amount: 87.09, method: 'Carta di credito (Stripe)' }]
};

describe('PDF della fattura', () => {
	it('estero senza IVA: aliquota 0, natura, totale uguale all\'imponibile, in inglese', async () => {
		const t = testoPdf(await buildInvoicePdf({ ...base, vat_rate: 0, natura: 'N3.1', lang: 'en', paid_currency: { currency: 'USD', amount: 94.06 } }));
		expect(t).toContain('INVOICE');
		expect(t).toContain('VAT 0% (N3.1)');
		expect(t).toContain('art. 8 DPR 633/72');
		expect(t).toContain('Dome stickers rectangle');
		expect(t).toContain('United States');
		expect(t).toContain('Credit card (Stripe)');
		expect(t).toContain('$94.06');
		expect(t).toContain('8 Nov 2026');
		expect(t).toContain('VAT no. IT11308040960');
		expect(t).not.toContain('22%');
		expect(t).not.toContain('106');
		expect(t).not.toContain('FATTURA');
	});
	it('l\'aliquota 0 registrata non diventa mai 22% (era il difetto: il PDF rigenerato aggiungeva l\'IVA)', async () => {
		const t = testoPdf(await buildInvoicePdf({ ...base, vat_rate: aliquotaFattura(0), natura: 'N3.1' }));
		expect(t).toContain('IVA 0% (N3.1)');
		expect(t).not.toContain('19,16');
		expect(t).not.toContain('106,25');
	});
	it('cessione UE con VIES: N3.2 in tedesco', async () => {
		const t = testoPdf(await buildInvoicePdf({ ...base, billing: { ...base.billing, country: 'DE', province: '' }, vat_rate: 0, natura: 'N3.2', lang: 'de' }));
		expect(t).toContain('RECHNUNG');
		expect(t).toContain('MwSt. 0 % (N3.2)');
		expect(t).toContain('innergemeinschaftliche Lieferung');
		expect(t).toContain('Deutschland');
	});
	it('Italia: resta com\'era, in italiano con IVA 22%', async () => {
		const t = testoPdf(await buildInvoicePdf({ ...base, billing: { company: 'Cliente Srl', street: 'Via Roma 1', zip: '20100', city: 'Milano', province: 'MI', country: 'IT', vat: '01234567890' }, vat_amount: 19.16, total_gross: 106.25, to_pay: 106.25 }));
		expect(t).toContain('FATTURA');
		expect(t).toContain('IVA 22%');
		expect(t).toContain('19,16');
		expect(t).toContain('106,25');
		expect(t).toContain('Adesivi resinati rettangolare');
		expect(t).toContain('Italia');
		expect(t).toContain('P.IVA 01234567890');
	});
	it('aliquotaFattura: valore registrato, altrimenti 22%', () => {
		expect(aliquotaFattura(0)).toBe(0);
		expect(aliquotaFattura('0')).toBe(0);
		expect(aliquotaFattura(null)).toBe(0.22);
		expect(aliquotaFattura(undefined)).toBe(0.22);
		expect(aliquotaFattura(0.22)).toBe(0.22);
	});
	/* Regola di Mattia del 26/11/2026: «il cliente ricevera' la sua fattura in dollari»; da noi e allo SDI resta in euro */
	it('pagata in dollari: la copia del cliente e\' tutta in dollari, con l\'importo registrato in euro', async () => {
		const t = testoPdf(await buildInvoicePdf({ ...base, vat_rate: 0, natura: 'N3.1', lang: 'en', paid_currency: { currency: 'USD', amount: 94.06 } }));
		expect(t).toContain('$0.9406'); // prezzo unitario
		expect(t.match(/\$94\.06/g)?.length).toBeGreaterThanOrEqual(3); // riga, imponibile, totale (e la scadenza)
		expect(t).toContain('Amount recorded in euros for Italian tax purposes');
		/* l'unico importo in euro e' quello registrato: nessuna riga e nessun totale in euro */
		expect(t.match(/87\.09/g)?.length).toBe(1);
		expect(t).not.toContain('0.8709');
	});
	it('la nostra copia della stessa fattura resta in italiano e in euro', async () => {
		const t = testoPdf(await buildInvoicePdf({ ...base, vat_rate: 0, natura: 'N3.1' }));
		expect(t).toContain('FATTURA');
		expect(t).toContain('87,09');
		expect(t).not.toContain('$');
		expect(t).not.toContain('94');
	});
	it('importi in valuta: righe, express e totale tornano al centesimo con quanto addebitato', () => {
		const I = importiFattura({ lines: [{ description: 'A', qty: 3, unit_net: 3.3333, total_net: 10 }, { description: 'B', qty: 7, unit_net: 2.8571, total_net: 20 }, { description: 'C', qty: 1, unit_net: 33.33, total_net: 33.33 }], express_net: 19, vat_rate: 0, vat_amount: 0, paid_currency: { currency: 'USD', amount: 101.45 }, payment_terms: [{ due: '2026-11-08', amount: 82.33, method: 'Carta' }] });
		expect(I.currency).toBe('USD');
		const somma = Math.round((I.righe.reduce((s, r) => s + r.total, 0) + I.express) * 100) / 100;
		expect(somma).toBe(101.45);
		expect(I.imponibile).toBe(101.45);
		expect(I.iva).toBe(0);
		expect(I.totale).toBe(101.45);
		expect(I.scadenze).toEqual([101.45]);
		expect(I.euro.totale).toBe(82.33);
	});
	it('importi in euro: quelli registrati, senza toccarli', () => {
		const I = importiFattura({ lines: [{ description: 'A', qty: 100, unit_net: 0.8709, total_net: 87.09 }], express_net: 0, vat_rate: 0.22, vat_amount: 19.16, paid_currency: null, payment_terms: [{ due: '2026-11-08', amount: 106.25, method: 'Bonifico' }] });
		expect(I).toMatchObject({ currency: 'EUR', estera: false, imponibile: 87.09, iva: 19.16, totale: 106.25, scadenze: [106.25] });
		expect(I.righe[0]).toEqual({ unit: 0.8709, total: 87.09 });
	});
});
