import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { COMPANY } from './company';
import { LOGO_PNG_B64 } from './logo-b64';
import { DOC_COLS, drawTable, drawTotals } from './docs';

export interface InvoiceLine { description: string; qty: number; unit_net: number; total_net: number; ddt?: string | null; ddt_date?: string | null }
export interface InvoiceData {
	number: string;
	issued_at: string; // ISO date
	email: string;
	billing: Record<string, string>;
	lines: InvoiceLine[];
	subtotal_net: number;
	discount_net: number; // codice sconto (imponibile)
	discount_code?: string | null;
	express_net: number;
	credit_used: number; // "Sconto Stickerprint" (IVA inclusa)
	vat_amount: number;
	total_gross: number; // totale documento (prima del credito)
	to_pay: number; // totale pagato
	payment_method: string;
	orders: string[];
	payment_terms?: { due: string; amount: number; method: string }[] | null;
	ddt_numbers?: string[] | null;
	notes?: string | null;
}

/** Gli sconti (codice o credito Stickerprint) non compaiono in fattura: si riducono i prezzi delle righe in proporzione, così l'imponibile dice già tutto. */
export function normalizeLines(lines: InvoiceLine[], discountNet: number, creditUsedGross: number, vatRate = COMPANY.vatRate): InvoiceLine[] {
	const orig = lines.reduce((s, l) => s + l.total_net, 0);
	const target = orig - discountNet - creditUsedGross / (1 + vatRate);
	if (orig <= 0 || target <= 0 || Math.abs(target - orig) < 0.005) return lines;
	const k = target / orig;
	const out = lines.map((l) => ({ ...l, total_net: Math.round(l.total_net * k * 100) / 100 }));
	const diff = Math.round((target - out.reduce((s, l) => s + l.total_net, 0)) * 100) / 100;
	out[out.length - 1].total_net = Math.round((out[out.length - 1].total_net + diff) * 100) / 100;
	return out.map((l) => ({ ...l, unit_net: Math.round((l.total_net / l.qty) * 10000) / 10000 }));
}
export const PAYMENT_TEXT: Record<string, string> = { paypal: 'PayPal', stripe: 'Carta di credito (Stripe)', test: 'Test' };

const eur = (v: number) => `${v.toFixed(2).replace('.', ',')} €`;

/** Genera il PDF della fattura (A4) */
export async function buildInvoicePdf(inv: InvoiceData): Promise<Uint8Array> {
	const pdf = await PDFDocument.create();
	const page = pdf.addPage([595.28, 841.89]);
	const font = await pdf.embedFont(StandardFonts.Helvetica);
	const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
	const navy = rgb(0.04, 0.04, 0.23);
	const gray = rgb(0.45, 0.47, 0.55);
	const M = 48;
	let y = 800;
	const text = (t: string, x: number, yy: number, size = 10, f = font, color = navy) => page.drawText(t, { x, y: yy, size, font: f, color });
	const right = (t: string, xRight: number, yy: number, size = 10, f = font, color = navy) => page.drawText(t, { x: xRight - f.widthOfTextAtSize(t, size), y: yy, size, font: f, color });

	// intestazione: logo a sinistra, i tre dati aziendali a destra
	const logo = await pdf.embedPng(Uint8Array.from(atob(LOGO_PNG_B64), (c) => c.charCodeAt(0)));
	const ld = logo.scale(64 / logo.height);
	page.drawImage(logo, { x: M, y: y - ld.height + 12, width: ld.width, height: ld.height });
	const [l1, l2, l3] = COMPANY.headerLines;
	right(l1, 547, y, 13, bold);
	right(l2, 547, y - 16, 9.5, font, gray);
	right(l3, 547, y - 29, 9.5, font, gray);
	y -= 62;
	page.drawLine({ start: { x: M, y }, end: { x: 547, y }, thickness: 1, color: rgb(0.85, 0.87, 0.92) });
	y -= 24;
	text('FATTURA', M, y, 16, bold);
	right(`N. ${inv.number} · ${new Date(inv.issued_at).toLocaleDateString('it-IT')}`, 547, y, 11, bold);
	y -= 26;

	// cliente
	const b = inv.billing;
	text('Intestatario', M, y, 9, bold, gray);
	y -= 14;
	const who = [b.company, [b.first_name, b.last_name].filter(Boolean).join(' ')].filter(Boolean);
	for (const w of who) { text(w, M, y, 11, bold); y -= 14; }
	const addr = [[b.street, b.street2].filter(Boolean).join(', '), [b.zip, b.city, b.province ? `(${b.province})` : ''].filter(Boolean).join(' '), b.country === 'IT' || !b.country ? 'Italia' : b.country].filter(Boolean);
	for (const a of addr) { text(a, M, y, 10); y -= 13; }
	const fisc = [b.vat ? `P.IVA ${b.vat}` : '', b.fiscal_code ? `C.F. ${b.fiscal_code}` : '', b.sdi ? `SDI ${b.sdi}` : '', inv.email].filter(Boolean).join(' · ');
	if (fisc) { text(fisc, M, y, 9, font, gray); y -= 13; }
	y -= 12;

	// tabella righe (colonne fisse, testo a capo, righe centrate)
	const colTot = 547;
	const rows: [string, string, string, string, string | null][] = inv.lines.map((l) => [l.description, l.qty.toLocaleString('it-IT'), eur(l.unit_net), eur(l.total_net), l.ddt ? `DDT ${l.ddt}${l.ddt_date ? ' del ' + new Date(l.ddt_date).toLocaleDateString('it-IT') : ''}` : null]);
	if (inv.express_net > 0) rows.push(['Produzione express (+30%)', '1', eur(inv.express_net), eur(inv.express_net), null]);
	const multiDdt = new Set(rows.map((r) => r[4]).filter(Boolean)).size > 1;
	y = drawTable({ page, x: M, y: y + 6, cols: DOC_COLS(), rows: rows.map(([d, q, u, t, ddt]) => [multiDdt && ddt ? `${d} (${ddt})` : d, q, u, t]), font, bold });
	y -= 18;
	// totali
	const taxable = inv.lines.reduce((s, l) => s + l.total_net, 0) + inv.express_net;
	const vat = Math.round(taxable * COMPANY.vatRate * 100) / 100;
	y = drawTotals(page, font, bold, y, [['Imponibile', eur(taxable)], [`IVA ${Math.round(COMPANY.vatRate * 100)}%`, eur(vat)], ['Totale', eur(Math.round((taxable + vat) * 100) / 100), true]]);
	void colTot;
	y -= 10;
	// pagamento e scadenze
	const pm = PAYMENT_TEXT[inv.payment_method] ?? inv.payment_method;
	text(`Pagamento: ${pm}${inv.payment_method === 'paypal' || inv.payment_method === 'stripe' ? ' · pagato' : ''}${inv.orders.length ? ` · Ordini: ${inv.orders.join(', ')}` : ''}`, M, y, 9, bold);
	y -= 14;
	if (inv.ddt_numbers?.length) { text(`DDT collegati: ${inv.ddt_numbers.join(', ')}`, M, y, 9, bold); y -= 14; }
	if (inv.payment_terms?.length) {
		text('Scadenze', M, y, 9, bold, gray); y -= 8;
		y = drawTable({ page, x: M, y, cols: [{ label: 'Scadenza', width: 70 }, { label: 'Importo', width: 70, align: 'right' }, { label: 'Metodo', width: 200 }], rows: inv.payment_terms.map((t) => [new Date(t.due).toLocaleDateString('it-IT'), eur(t.amount), t.method]), font, bold, size: 9, headSize: 8, minRowH: 18 });
		y -= 12;
		if (COMPANY.iban) { text(`IBAN ${COMPANY.iban} · ${COMPANY.name}`, M, y, 9, font, gray); y -= 12; }
	}
	if (inv.notes) { text(`Note: ${inv.notes}`.slice(0, 140), M, y, 9, font, gray); y -= 13; }
	text('Prova automatica immediata inviata via email. Spedizione con corriere espresso tracciato.', M, y, 9, font, gray);
	text('Documento generato automaticamente da stickerprint.it', M, 40, 8, font, gray);
	return pdf.save();
}
