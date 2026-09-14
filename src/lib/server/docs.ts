import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import { COMPANY } from './company';
import { LOGO_PNG_B64 } from './logo-b64';

export interface LabelOrder { number: string; customer: string; shipping: Record<string, string>; email?: string | null; phone?: string | null; items: { qty: number; name: string; meta?: string }[] }
const b64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const navy = rgb(0.04, 0.04, 0.23); const gray = rgb(0.4, 0.42, 0.5);

/** Etichette 10×15 cm: una pagina per collo, con logo, mittente, destinatario, colli e contenuto */
export async function buildLabelsPdf(orders: (LabelOrder & { parcels: number; courier: string })[]): Promise<Uint8Array> {
	const pdf = await PDFDocument.create();
	const font = await pdf.embedFont(StandardFonts.Helvetica);
	const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
	const logo = await pdf.embedPng(b64(LOGO_PNG_B64));
	const W = 283.46, H = 425.2, M = 16;
	for (const o of orders) {
		const s = o.shipping ?? {};
		const parcels = Math.max(1, o.parcels || 1);
		for (let n = 1; n <= parcels; n++) {
			const page = pdf.addPage([W, H]);
			const t = (txt: string, x: number, y: number, size = 9, f: PDFFont = font, color = navy) => page.drawText(txt, { x, y, size, font: f, color });
			const ld = logo.scale(58 / logo.height);
			page.drawImage(logo, { x: M, y: H - M - ld.height, width: ld.width, height: ld.height });
			t(COMPANY.name, M + ld.width + 8, H - M - 14, 9, bold);
			t(COMPANY.address, M + ld.width + 8, H - M - 26, 6.5, font, gray);
			t(`${COMPANY.email} · ${COMPANY.site}`, M + ld.width + 8, H - M - 36, 6.5, font, gray);
			page.drawLine({ start: { x: M, y: H - M - 66 }, end: { x: W - M, y: H - M - 66 }, thickness: 1, color: rgb(0.85, 0.87, 0.92) });
			if (!/diretta|destinatario|cliente/i.test(o.courier)) t(o.courier.toUpperCase(), M, H - M - 84, 13, bold);
			page.drawText(`COLLO ${n} / ${parcels}`, { x: W - M - bold.widthOfTextAtSize(`COLLO ${n} / ${parcels}`, 13), y: H - M - 84, size: 13, font: bold, color: navy });
			t('DESTINATARIO', M, H - M - 108, 7, bold, gray);
			let y = H - M - 124;
			const who = [s.company, [s.first_name, s.last_name].filter(Boolean).join(' ')].filter(Boolean);
			for (const w of who) { t(w.slice(0, 40), M, y, 14, bold); y -= 17; }
			for (const l of [[s.street, s.street2].filter(Boolean).join(', '), `${s.zip ?? ''} ${s.city ?? ''} ${s.province ? '(' + s.province + ')' : ''}`.trim(), s.country && s.country !== 'IT' ? s.country : 'Italia', s.phone ? `Tel. ${s.phone}` : '']) if (l) { t(l.slice(0, 48), M, y, 11); y -= 14; }
			y -= 6;
			page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 0.7, color: rgb(0.85, 0.87, 0.92) });
			y -= 16;
			t(`ORDINE ${o.number}`, M, y, 11, bold); y -= 14;
			t('Contenuto:', M, y, 7, bold, gray); y -= 11;
			for (const it of o.items.slice(0, 8)) { const line = `${it.qty} × ${it.name}${it.meta ? ' · ' + it.meta : ''}`; t(line.length > 60 ? line.slice(0, 57) + '…' : line, M, y, 8); y -= 10; if (y < 40) break; }
			if (o.items.length > 8) t(`+ altri ${o.items.length - 8} articoli`, M, y, 8, font, gray);
			// mittente in basso
			t(`MITTENTE: ${COMPANY.name} · ${COMPANY.address}`, M, M + 6, 6.5, font, gray);
			// bordo
			page.drawRectangle({ x: 4, y: 4, width: W - 8, height: H - 8, borderColor: rgb(0.85, 0.87, 0.92), borderWidth: 0.8 });
		}
	}
	return pdf.save();
}

export interface DdtData { number: string; issued_at: string; order_number: string; customer: Record<string, string>; shipping: Record<string, string>; lines: { description: string; qty: number; unit_net: number; total_net: number }[]; parcels: number; weight_kg: number | null; causale: string; trasporto: string; subtotal_net: number; vat_amount: number; total_gross: number; notes?: string | null }

function docHeader(page: PDFPage, font: PDFFont, bold: PDFFont, logo: Awaited<ReturnType<PDFDocument['embedPng']>>, title: string, number: string, date: string) {
	const M = 48; const top = 800;
	const ld = logo.scale(52 / logo.height);
	page.drawImage(logo, { x: M, y: top - ld.height + 8, width: ld.width, height: ld.height });
	const [l1, l2, l3] = COMPANY.headerLines;
	page.drawText(l1, { x: 547 - bold.widthOfTextAtSize(l1, 13), y: top - 4, size: 13, font: bold, color: navy });
	page.drawText(l2, { x: 547 - font.widthOfTextAtSize(l2, 9.5), y: top - 19, size: 9.5, font, color: gray });
	page.drawText(l3, { x: 547 - font.widthOfTextAtSize(l3, 9.5), y: top - 32, size: 9.5, font, color: gray });
	page.drawLine({ start: { x: M, y: top - 56 }, end: { x: 547, y: top - 56 }, thickness: 1, color: rgb(0.85, 0.87, 0.92) });
	page.drawText(title, { x: M, y: top - 76, size: 15, font: bold, color: navy });
	const nd = `N. ${number} · ${date}`;
	page.drawText(nd, { x: 547 - bold.widthOfTextAtSize(nd, 11), y: top - 76, size: 11, font: bold, color: navy });
}
const addrLines = (a: Record<string, string>) => [a.company, [a.first_name, a.last_name].filter(Boolean).join(' '), [a.street, a.street2].filter(Boolean).join(', '), [a.zip, a.city, a.province ? `(${a.province})` : ''].filter(Boolean).join(' '), a.country && a.country !== 'IT' ? a.country : 'Italia', a.vat ? `P.IVA ${a.vat}` : '', a.fiscal_code ? `C.F. ${a.fiscal_code}` : ''].filter(Boolean);
const eur = (v: number) => `${v.toFixed(2).replace('.', ',')} €`;

/* ---------- tabella condivisa: colonne fisse, testo a capo, righe centrate in verticale ---------- */
export interface TableCol { label: string; width: number; align?: 'left' | 'right' | 'center'; bold?: boolean; maxLines?: number }
export interface TableOpts { page: PDFPage; x: number; y: number; cols: TableCol[]; rows: string[][]; font: PDFFont; bold: PDFFont; size?: number; headSize?: number; minRowH?: number }
export const PAD = 6;
/** spezza il testo in righe che stanno nella larghezza (le parole troppo lunghe vengono tagliate con …) */
export function wrapText(font: PDFFont, text: string, size: number, maxWidth: number, maxLines = 2): string[] {
	const words = (text ?? '').replace(/\s+/g, ' ').trim().split(' ');
	const lines: string[] = [];
	let cur = '';
	const fits = (t: string) => font.widthOfTextAtSize(t, size) <= maxWidth;
	for (const w of words) {
		const next = cur ? `${cur} ${w}` : w;
		if (fits(next)) { cur = next; continue; }
		if (cur) lines.push(cur);
		cur = w;
		while (!fits(cur) && cur.length > 1) cur = cur.slice(0, -1);
		if (lines.length === maxLines - 1) break;
	}
	if (cur) lines.push(cur);
	if (lines.length > maxLines) lines.length = maxLines;
	// se il testo e' stato tagliato, l'ultima riga finisce con …
	const joined = lines.join(' ');
	if (joined.length < (text ?? '').replace(/\s+/g, ' ').trim().length) {
		let last = lines[lines.length - 1];
		while (last.length > 1 && !fits(last + '…')) last = last.slice(0, -1);
		lines[lines.length - 1] = last + '…';
	}
	return lines.length ? lines : [''];
}
/** Disegna intestazione e righe; ritorna la y sotto la tabella. Le celle si allineano alla colonna e stanno centrate in altezza. */
export function drawTable(o: TableOpts): number {
	const { page, cols, font, bold } = o;
	const size = o.size ?? 10, hs = o.headSize ?? 9, lineH = size * 1.3, headH = 22, minRowH = o.minRowH ?? 22;
	let y = o.y;
	const total = cols.reduce((a, c) => a + c.width, 0);
	const xs: number[] = []; let acc = o.x; for (const c of cols) { xs.push(acc); acc += c.width; }
	const put = (txt: string, ci: number, baseline: number, f: PDFFont, sz: number, color = navy) => {
		const c = cols[ci]; const w = f.widthOfTextAtSize(txt, sz);
		const x = c.align === 'right' ? xs[ci] + c.width - PAD - w : c.align === 'center' ? xs[ci] + (c.width - w) / 2 : xs[ci] + PAD;
		page.drawText(txt, { x, y: baseline, size: sz, font: f, color });
	};
	// intestazione: banda chiara, testo centrato in altezza
	page.drawRectangle({ x: o.x, y: y - headH, width: total, height: headH, color: rgb(0.96, 0.97, 0.99) });
	cols.forEach((c, i) => put(c.label, i, y - headH + (headH - hs * 0.72) / 2, bold, hs, gray));
	y -= headH;
	for (const row of o.rows) {
		const cells = row.map((txt, i) => wrapText(cols[i].bold ? bold : font, txt ?? '', size, cols[i].width - PAD * 2, cols[i].maxLines ?? 2));
		const lines = Math.max(1, ...cells.map((c) => c.length));
		const rowH = Math.max(minRowH, lines * lineH + 8);
		cells.forEach((cl, i) => {
			const block = cl.length * lineH;
			const top = y - (rowH - block) / 2; // il blocco di testo sta al centro della riga
			cl.forEach((line, k) => put(line, i, top - lineH * (k + 1) + (lineH - size * 0.72) / 2, cols[i].bold ? bold : font, size));
		});
		y -= rowH;
		page.drawLine({ start: { x: o.x, y }, end: { x: o.x + total, y }, thickness: 0.5, color: rgb(0.9, 0.91, 0.94) });
	}
	return y;
}
/** Blocco totali allineato a destra (etichette e valori sulla stessa colonna) */
export function drawTotals(page: PDFPage, font: PDFFont, bold: PDFFont, y: number, rows: [string, string, boolean?][], xLabel = 460, xValue = 547): number {
	for (const [label, value, strong] of rows) {
		const f = strong ? bold : font; const sz = strong ? 12 : 10;
		page.drawText(label, { x: xLabel - f.widthOfTextAtSize(label, 10), y, size: 10, font: f, color: strong ? navy : gray });
		page.drawText(value, { x: xValue - f.widthOfTextAtSize(value, sz), y, size: sz, font: f, color: navy });
		y -= strong ? 18 : 16;
	}
	return y;
}
export const DOC_COLS = (font?: PDFFont): TableCol[] => [{ label: 'Descrizione', width: 302, maxLines: 3 }, { label: 'Q.tà', width: 50, align: 'right' }, { label: 'Prezzo unit.', width: 70, align: 'right' }, { label: 'Imponibile', width: 77, align: 'right', bold: true }];

/** Documento di trasporto A4 */
export async function buildDdtPdf(d: DdtData): Promise<Uint8Array> {
	const pdf = await PDFDocument.create();
	const page = pdf.addPage([595.28, 841.89]);
	const font = await pdf.embedFont(StandardFonts.Helvetica); const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
	const logo = await pdf.embedPng(b64(LOGO_PNG_B64));
	docHeader(page, font, bold, logo, 'DOCUMENTO DI TRASPORTO', d.number, new Date(d.issued_at).toLocaleDateString('it-IT'));
	const M = 48; let y = 700;
	const t = (txt: string, x: number, yy: number, size = 10, f: PDFFont = font, color = navy) => page.drawText(txt, { x, y: yy, size, font: f, color });
	t('Cliente', M, y, 8.5, bold, gray); t('Destinazione', 320, y, 8.5, bold, gray); y -= 14;
	const L = addrLines(d.customer), R = addrLines(d.shipping);
	for (let i = 0; i < Math.max(L.length, R.length); i++) { if (L[i]) t(L[i], M, y, i === 0 ? 11 : 10, i === 0 ? bold : font); if (R[i]) t(R[i], 320, y, i === 0 ? 11 : 10, i === 0 ? bold : font); y -= 13; }
	y -= 10;
	t(`Ordine ${d.order_number} · Causale: ${d.causale} · Trasporto: ${d.trasporto} · Colli: ${d.parcels}${d.weight_kg ? ` · Peso: ${d.weight_kg} kg` : ''}`, M, y, 9, font, gray); y -= 22;
	y = drawTable({ page, x: M, y: y + 6, cols: DOC_COLS(), rows: d.lines.map((l) => [l.description, String(l.qty), eur(l.unit_net), eur(l.total_net)]), font, bold });
	y -= 18;
	y = drawTotals(page, font, bold, y, [['Imponibile', eur(d.subtotal_net)], ['IVA 22%', eur(d.vat_amount)], ['Totale', eur(d.total_gross), true]]);
	if (d.notes) { y -= 8; t(`Note: ${d.notes}`.slice(0, 120), M, y, 9, font, gray); }
	t('Firma del vettore ______________________      Firma del destinatario ______________________', M, 70, 9, font, gray);
	t('Documento generato da stickerprint.it', M, 40, 8, font, gray);
	return pdf.save();
}

export interface OrderDocData { kind?: 'ordine' | 'preventivo'; valid_until?: string | null; lead_time?: string | null; number: string; numbers: string[]; issued_at: string; customer: Record<string, string>; shipping: Record<string, string>; email: string | null; lines: { description: string; qty: number; unit_net: number; total_net: number }[]; subtotal_net: number; vat_amount: number; total_gross: number; payment_method: string; payment_terms: { due: string; amount: number; method: string }[]; shipping_method: string; delivery_date: string | null; notes?: string | null }

/** Conferma d'ordine A4: articoli, riepilogo con totali e scadenze di pagamento */
export async function buildOrderPdf(d: OrderDocData): Promise<Uint8Array> {
	const pdf = await PDFDocument.create();
	const page = pdf.addPage([595.28, 841.89]);
	const font = await pdf.embedFont(StandardFonts.Helvetica); const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
	const logo = await pdf.embedPng(b64(LOGO_PNG_B64));
	const quote = d.kind === 'preventivo';
	docHeader(page, font, bold, logo, quote ? 'PREVENTIVO' : "CONFERMA D'ORDINE", d.number, new Date(d.issued_at).toLocaleDateString('it-IT'));
	const M = 48; let y = 700;
	const t = (txt: string, x: number, yy: number, size = 10, f: PDFFont = font, color = navy) => page.drawText(txt, { x, y: yy, size, font: f, color });
	t('Cliente', M, y, 8.5, bold, gray); t('Spedizione', 320, y, 8.5, bold, gray); y -= 14;
	const L = addrLines(d.customer), R = addrLines(d.shipping);
	if (d.email) L.push(d.email);
	for (let i = 0; i < Math.max(L.length, R.length); i++) { if (L[i]) t(L[i], M, y, i === 0 ? 11 : 10, i === 0 ? bold : font); if (R[i]) t(R[i], 320, y, i === 0 ? 11 : 10, i === 0 ? bold : font); y -= 13; }
	y -= 8;
	t(`Spedizione: ${d.shipping_method}${d.delivery_date ? ` · prevista il ${new Date(d.delivery_date).toLocaleDateString('it-IT')}` : ''}${d.lead_time ? ` · Tempi: ${d.lead_time}` : ''}`.slice(0, 150), M, y, 9, font, gray); y -= 22;
	y = drawTable({ page, x: M, y: y + 6, cols: DOC_COLS(), rows: d.lines.map((l) => [l.description, l.qty.toLocaleString('it-IT'), eur(l.unit_net), eur(l.total_net)]), font, bold });
	y -= 14;
	if (d.notes) { t(`Note: ${d.notes}`.slice(0, 140), M, y, 9, font, gray); y -= 13; }
	if (quote) {
		t(`Preventivo valido fino al ${d.valid_until ? new Date(d.valid_until).toLocaleDateString('it-IT') : '30 giorni dalla data'}. Prezzi IVA esclusa salvo diversa indicazione.${d.lead_time ? ` Tempi: ${d.lead_time}.` : ''}`.slice(0, 160), M, y, 9, font, gray); y -= 13;
		t('Per accettare basta un clic sul link ricevuto via email, oppure rispondere "confermo il preventivo".', M, y, 9, font, gray); y -= 13;
	}
	// in fondo alla pagina: metodo di pagamento e scadenze a sinistra, imponibile / IVA / totale a destra
	const base = Math.min(y - 10, 200);
	t(quote ? 'Condizioni di pagamento' : 'Scadenze di pagamento', M, base, 9, bold, gray);
	const terms = d.payment_terms.length ? d.payment_terms.map((p) => [new Date(p.due).toLocaleDateString('it-IT'), eur(p.amount), p.method]) : [['—', '—', d.payment_method || '—']];
	let yl = drawTable({ page, x: M, y: base - 8, cols: [{ label: 'Scadenza', width: 70 }, { label: 'Importo', width: 70, align: 'right' }, { label: 'Metodo', width: 160 }], rows: terms, font, bold, size: 9, headSize: 8, minRowH: 18 });
	yl -= 12;
	if (COMPANY.iban) t(`IBAN ${COMPANY.iban} · ${COMPANY.name}`, M, yl, 9, font, gray);
	drawTotals(page, font, bold, base - 4, [['Imponibile', eur(d.subtotal_net)], ['IVA 22%', eur(d.vat_amount)], ['Totale IVA inclusa', eur(d.total_gross), true]]);
	t('Documento generato da stickerprint.it', M, 40, 8, font, gray);
	return pdf.save();
}

export interface ManifestData { courier: string; number: string; day: string; shipments: { order_number: string; customer: string; city: string; zip?: string; parcels: number; weight_kg: number | null; tracking: string | null }[] }
/** Manifest (borderò) di consegna al corriere: elenco dei colli affidati nella giornata, con firme */
export async function buildManifestPdf(m: ManifestData): Promise<Uint8Array> {
	const pdf = await PDFDocument.create();
	const font = await pdf.embedFont(StandardFonts.Helvetica); const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
	const logo = await pdf.embedPng(b64(LOGO_PNG_B64));
	const M = 48; const perPage = 28;
	for (let p = 0; p < Math.max(1, Math.ceil(m.shipments.length / perPage)); p++) {
		const page = pdf.addPage([595.28, 841.89]);
		docHeader(page, font, bold, logo, `MANIFEST SPEDIZIONI ${m.courier.toUpperCase()}`, m.number, new Date(m.day).toLocaleDateString('it-IT'));
		const t = (txt: string, x: number, yy: number, size = 9, f: PDFFont = font, color = navy) => page.drawText(txt, { x, y: yy, size, font: f, color });
		let y = 700;
		t(`Mittente: ${COMPANY.name} · ${COMPANY.address} · Ritiro del ${new Date(m.day).toLocaleDateString('it-IT')}`, M, y, 9, font, gray); y -= 22;
		const slice = m.shipments.slice(p * perPage, (p + 1) * perPage);
		y = drawTable({ page, x: M, y: y + 6, cols: [{ label: '#', width: 24, align: 'center' }, { label: 'Ordine', width: 60, bold: true }, { label: 'Destinatario', width: 150 }, { label: 'Città', width: 95 }, { label: 'Colli', width: 36, align: 'right' }, { label: 'Peso', width: 44, align: 'right' }, { label: 'Tracking', width: 90 }],
			rows: slice.map((s, i) => [String(p * perPage + i + 1), s.order_number, s.customer, `${s.zip ? s.zip + ' ' : ''}${s.city}`, String(s.parcels), s.weight_kg ? `${s.weight_kg} kg` : '—', s.tracking ?? '—']), font, bold, size: 9, headSize: 8.5, minRowH: 18 });
		if (p === Math.ceil(m.shipments.length / perPage) - 1 || !m.shipments.length) {
			y -= 22;
			const tot = m.shipments.reduce((a, s) => a + s.parcels, 0); const kg = m.shipments.reduce((a, s) => a + Number(s.weight_kg ?? 0), 0);
			t(`Totale: ${m.shipments.length} spedizioni · ${tot} colli${kg ? ` · ${kg.toFixed(1)} kg` : ''}`, M, y, 10, bold); y -= 40;
			t('Firma del mittente ______________________________', M, Math.max(y, 90), 9, font, gray);
			t('Firma dell\'autista / ora ritiro ______________________________', 300, Math.max(y, 90), 9, font, gray);
		}
		t(`Documento generato da stickerprint.it · pagina ${p + 1}`, M, 40, 8, font, gray);
	}
	return pdf.save();
}
