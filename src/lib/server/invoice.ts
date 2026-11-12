import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { COMPANY } from './company';
import { LOGO_PNG_B64 } from './logo-b64';
import { DOC_COLS, drawTable, drawTotals, wrapText, eur, eurUnit, qtyFmt, docT, winAnsi, eurIn } from './docs';
import { LOCALES, type Lang } from '$lib/i18n';
import { perLingua } from '$lib/traduzioni';

/** `description_c`: la stessa riga nella lingua del cliente (solo ordini esteri). La descrizione italiana resta quella fiscale (XML, dashboard). */
export interface InvoiceLine { code?: string | null; description: string; description_c?: string | null; qty: number; unit_net: number; total_net: number; ddt?: string | null; ddt_date?: string | null }
export interface InvoiceData {
	number: string;
	issued_at: string; // ISO date
	email: string;
	billing: Record<string, string>;
	lines: InvoiceLine[];
	/** aliquota applicata (default 22%) e natura quando e' 0 (N3.1 export, N3.2 cessione UE) */
	vat_rate?: number | null; natura?: string | null;
	/** lingua del cliente: etichette, date e formato dei numeri del PDF (importi sempre in euro). Default italiano. */
	lang?: Lang | null;
	/** quanto e' stato addebitato al cliente nella sua valuta, se non e' l'euro (ordini dal sito USA) */
	paid_currency?: { currency: string; amount: number } | null;
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


/** aliquota di una fattura: quella registrata (0 per l'estero senza IVA), altrimenti il 22% */
export const aliquotaFattura = (v: unknown): number => (v != null && v !== '' && Number.isFinite(Number(v)) ? Number(v) : COMPANY.vatRate);
/** metodi di pagamento scritti in italiano nelle scadenze → chiave di traduzione (gli altri restano come sono) */
const METODO_CHIAVE: Record<string, string> = { 'Carta di credito (Stripe)': 'fattura.carta', 'Bonifico bancario': 'fattura.bonifico' };

/** Genera il PDF della fattura (A4). `inv.lang`: lingua del cliente (estero); importi sempre in euro, IVA con l'aliquota registrata. */
export async function buildInvoicePdf(inv: InvoiceData): Promise<Uint8Array> {
	const lang: Lang = inv.lang ?? 'it';
	const ita = lang === 'it';
	const D = docT(lang);
	/* in italiano i formati restano quelli di sempre; nelle altre lingue numeri e date col formato della lingua */
	const money = (v: number) => (ita ? eur(v) : eurIn(lang, v));
	const moneyUnit = (v: number) => (ita ? eurUnit(v) : eurIn(lang, v, 4));
	const qty = (v: number) => (ita ? qtyFmt(v) : winAnsi(new Intl.NumberFormat(LOCALES[perLingua(lang)].intl, { useGrouping: 'always', maximumFractionDigits: 0 }).format(v)));
	/* fuori dall'italiano la data ha il mese scritto (8 Nov 2026): 8/11 per un americano e' l'11 agosto */
	const data = (d: string) => (ita ? new Date(d).toLocaleDateString('it-IT') : winAnsi(new Date(d).toLocaleDateString(LOCALES[perLingua(lang)].intl, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })));
	const metodo = (m: string) => (ita || !METODO_CHIAVE[m] ? m : D(METODO_CHIAVE[m]));
	const pdf = await PDFDocument.create();
	const page = pdf.addPage([595.28, 841.89]);
	const font = await pdf.embedFont(StandardFonts.Helvetica);
	const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
	const navy = rgb(0.04, 0.04, 0.23);
	const gray = rgb(0.45, 0.47, 0.55);
	const M = 48;
	let y = 800;
	const text = (t: string, x: number, yy: number, size = 10, f = font, color = navy) => page.drawText(winAnsi(t), { x, y: yy, size, font: f, color });
	const right = (t: string, xRight: number, yy: number, size = 10, f = font, color = navy) => page.drawText(winAnsi(t), { x: xRight - f.widthOfTextAtSize(winAnsi(t), size), y: yy, size, font: f, color });

	// intestazione: logo a sinistra, i tre dati aziendali a destra
	const logo = await pdf.embedPng(Uint8Array.from(atob(LOGO_PNG_B64), (c) => c.charCodeAt(0)));
	const ld = logo.scale(64 / logo.height);
	page.drawImage(logo, { x: M, y: y - ld.height + 12, width: ld.width, height: ld.height });
	const [l1, l2, l3it] = COMPANY.headerLines;
	/* per l'estero la partita IVA col prefisso del paese (IT...), come serve sulle fatture intracomunitarie */
	const l3 = ita ? l3it : `${D('piva', { v: `IT${COMPANY.vat}` })} - ${COMPANY.email} - ${COMPANY.site}`;
	right(l1, 547, y, 13, bold);
	right(l2, 547, y - 16, 9.5, font, gray);
	right(l3, 547, y - 29, 9.5, font, gray);
	y -= 62;
	page.drawLine({ start: { x: M, y }, end: { x: 547, y }, thickness: 1, color: rgb(0.85, 0.87, 0.92) });
	y -= 24;
	text(D('fattura.titolo'), M, y, 16, bold);
	right(`${D('numero')} ${inv.number} · ${data(inv.issued_at)}`, 547, y, 11, bold);
	y -= 26;

	// cliente
	const b = inv.billing;
	text(D('fattura.intestatario'), M, y, 9, bold, gray);
	y -= 14;
	const who = [b.company, [b.first_name, b.last_name].filter(Boolean).join(' ')].filter(Boolean);
	for (const w of who) { text(w, M, y, 11, bold); y -= 14; }
	/* paese per esteso nella lingua del documento (US → Stati Uniti / United States); se il codice non e' riconosciuto resta il codice */
	const paese = (() => { const c = (b.country || 'IT').toUpperCase(); if (c === 'IT') return D('paese'); try { return new Intl.DisplayNames([LOCALES[perLingua(lang)].intl], { type: 'region' }).of(c) ?? c; } catch { return c; } })();
	const addr = [[b.street, b.street2].filter(Boolean).join(', '), [b.zip, b.city, b.province ? `(${b.province})` : ''].filter(Boolean).join(' '), paese].filter(Boolean);
	for (const a of addr) { text(a, M, y, 10); y -= 13; }
	const fisc = [b.vat ? D('piva', { v: b.vat }) : '', b.fiscal_code ? D('cf', { v: b.fiscal_code }) : '', b.sdi ? D('fattura.sdi', { v: b.sdi }) : '', inv.email].filter(Boolean).join(' · ');
	if (fisc) { text(fisc, M, y, 9, font, gray); y -= 13; }
	y -= 12;

	// tabella righe (colonne fisse, testo a capo, righe centrate)
	const rows: [string, string, string, string, string, string | null][] = inv.lines.map((l) => [l.code ?? '', (!ita && l.description_c) || l.description, qty(l.qty), moneyUnit(l.unit_net), money(l.total_net), l.ddt ? `${D('fattura.ddtRiga', { n: l.ddt })}${l.ddt_date ? D('fattura.ddtDel', { data: data(l.ddt_date) }) : ''}` : null]);
	if (inv.express_net > 0) rows.push(['', D('fattura.express'), '1', money(inv.express_net), money(inv.express_net), null]);
	const multiDdt = new Set(rows.map((r) => r[4]).filter(Boolean)).size > 1;
	y = drawTable({ page, x: M, y: y + 6, cols: DOC_COLS(undefined, lang), rows: rows.map(([c, d, q, u, t, ddt]) => [c, winAnsi(multiDdt && ddt ? `${d} (${ddt})` : d), q, u, t]), font, bold });
	y -= 14;
	if (inv.notes) { text(D('note', { note: inv.notes }).slice(0, 140), M, y, 9, font, gray); y -= 13; }
	// in fondo alla pagina: pagamento e scadenze a sinistra, totali a destra
	const taxable = Math.round((inv.lines.reduce((s, l) => s + l.total_net, 0) + inv.express_net) * 100) / 100;
	/* IVA: quella registrata sulla fattura (scorporo dal prezzo IVA inclusa: totale = incassato al centesimo); se manca, il 22% dell'imponibile */
	const rate = aliquotaFattura(inv.vat_rate);
	const vat = rate === 0 ? 0 : Number.isFinite(inv.vat_amount) && Math.abs(inv.vat_amount - taxable * rate) < 0.05 ? Math.round(inv.vat_amount * 100) / 100 : Math.round(taxable * rate * 100) / 100;
	const natura = inv.natura ?? 'N3.1';
	const base = Math.min(y - 10, 200);
	const pm = PAYMENT_TEXT[inv.payment_method] ?? inv.payment_method;
	let yl = base;
	// blocco sinistro largo al massimo 340 pt (i totali stanno a destra): testi lunghi vanno a capo, mai sovrapposti
	const LEFT_W = 340;
	const para = (label: string, value: string) => { for (const line of wrapText(bold, winAnsi(`${label}: ${value}`), 9, LEFT_W, 4)) { text(line, M, yl, 9, bold); yl -= 12; } yl -= 2; };
	para(D('fattura.pagamento'), `${metodo(pm)}${inv.payment_method === 'paypal' || inv.payment_method === 'stripe' ? D('fattura.pagato') : ''}`);
	if (inv.orders.length) para(D('fattura.ordini'), inv.orders.join(', '));
	if (inv.ddt_numbers?.length) para(D('fattura.ddt'), inv.ddt_numbers.join(', '));
	if (inv.payment_terms?.length) {
		yl = drawTable({ page, x: M, y: yl - 2, cols: [{ label: D('colScadenza'), width: 70 }, { label: D('colImporto'), width: 70, align: 'right' }, { label: D('colMetodo'), width: 200, maxLines: 2 }], rows: inv.payment_terms.map((t) => [data(t.due), money(t.amount), winAnsi(metodo(t.method))]), font, bold, size: 9, headSize: 8, minRowH: 18 });
		yl -= 12;
		if (COMPANY.iban) { text(`IBAN ${COMPANY.iban} · ${COMPANY.name}`, M, yl, 9, font, gray); yl -= 12; }
	}
	/* pagato in un'altra valuta (sito USA): il documento resta in euro, ma si dice quanto e' stato addebitato */
	if (inv.paid_currency && inv.paid_currency.currency !== 'EUR' && inv.paid_currency.amount > 0) {
		let importo = `${inv.paid_currency.amount.toFixed(2)} ${inv.paid_currency.currency}`;
		try { importo = new Intl.NumberFormat(inv.paid_currency.currency === 'USD' ? 'en-US' : LOCALES[perLingua(lang)].intl, { style: 'currency', currency: inv.paid_currency.currency }).format(inv.paid_currency.amount); } catch { /* resta il formato semplice */ }
		text(D('fattura.addebitato', { importo }), M, yl, 9, font, gray); yl -= 12;
	}
	if (['paypal', 'stripe', 'test'].includes(inv.payment_method)) text(D('fattura.prova'), M, 56, 8.5, font, gray);
	drawTotals(page, font, bold, base - 4, [[D('imponibile'), money(taxable)], [rate === 0 ? D('fattura.ivaZero', { natura }) : D('fattura.ivaAliquota', { p: Math.round(rate * 100) }), money(vat)], [D('fattura.totale'), money(Math.round((taxable + vat) * 100) / 100), true]]);
	/* nota di non imponibilita' sopra la riga della prova: una o due righe secondo la lingua */
	if (rate === 0) {
		const nota = wrapText(font, winAnsi(natura === 'N3.2' ? D('fattura.n32') : natura === 'N3.1' ? D('fattura.n31') : D('fattura.nonImponibile')), 8.5, 499, 2);
		nota.forEach((line, k) => text(line, M, 68 + 10 * (nota.length - 1 - k), 8.5, font, gray));
	}
	text(D('fattura.generato'), M, 40, 8, font, gray);
	return pdf.save();
}
