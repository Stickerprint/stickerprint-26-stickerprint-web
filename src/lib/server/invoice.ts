import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { COMPANY } from './company';
import { LOGO_PNG_B64 } from './logo-b64';

export interface InvoiceLine { description: string; qty: number; unit_net: number; total_net: number }
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

	// tabella righe
	const colQty = 380, colUnit = 460, colTot = 547;
	page.drawRectangle({ x: M, y: y - 6, width: 547 - M, height: 20, color: rgb(0.96, 0.97, 0.99) });
	text('Descrizione', M + 6, y, 9, bold, gray);
	right('Q.tà', colQty, y, 9, bold, gray);
	right('Prezzo unit.', colUnit, y, 9, bold, gray);
	right('Imponibile', colTot, y, 9, bold, gray);
	y -= 24;
	const rows: [string, string, string, string][] = inv.lines.map((l) => [l.description, String(l.qty), eur(l.unit_net), eur(l.total_net)]);
	if (inv.express_net > 0) rows.push(['Produzione express (+30%)', '1', eur(inv.express_net), eur(inv.express_net)]);
	for (const [d, q, u, t] of rows) {
		const desc = d.length > 70 ? d.slice(0, 67) + '…' : d;
		text(desc, M + 6, y, 10);
		right(q, colQty, y, 10);
		right(u, colUnit, y, 10);
		right(t, colTot, y, 10, bold);
		y -= 18;
		page.drawLine({ start: { x: M, y: y + 6 }, end: { x: 547, y: y + 6 }, thickness: 0.5, color: rgb(0.9, 0.91, 0.94) });
	}
	y -= 10;

	// totali
	const tot = (label: string, value: string, strong = false) => { right(label, colUnit, y, 10, strong ? bold : font, strong ? navy : gray); right(value, colTot, y, strong ? 12 : 10, strong ? bold : font); y -= 16; };
	const taxable = inv.lines.reduce((s, l) => s + l.total_net, 0) + inv.express_net;
	const vat = Math.round(taxable * COMPANY.vatRate * 100) / 100;
	tot('Imponibile', eur(taxable));
	tot(`IVA ${Math.round(COMPANY.vatRate * 100)}%`, eur(vat));
	tot('Totale', eur(Math.round((taxable + vat) * 100) / 100), true);
	y -= 10;
	// pagamento e scadenze
	const pm = PAYMENT_TEXT[inv.payment_method] ?? inv.payment_method;
	text(`Pagamento: ${pm}${inv.payment_method === 'paypal' || inv.payment_method === 'stripe' ? ' · pagato' : ''} · Ordini: ${inv.orders.join(', ')}`, M, y, 9, bold);
	y -= 14;
	if (inv.payment_terms?.length) {
		text('Scadenze', M, y, 9, bold, gray); y -= 13;
		for (const t of inv.payment_terms) { text(`${new Date(t.due).toLocaleDateString('it-IT')}  ${eur(t.amount)}  ${t.method}`, M, y, 9); y -= 12; }
		if (COMPANY.iban) { text(`IBAN ${COMPANY.iban} · ${COMPANY.name}`, M, y, 9, font, gray); y -= 12; }
	}
	text('Prova di stampa gratuita inviata via email. Spedizione con corriere espresso tracciato.', M, y, 9, font, gray);
	text('Documento generato automaticamente da stickerprint.it', M, 40, 8, font, gray);
	return pdf.save();
}
