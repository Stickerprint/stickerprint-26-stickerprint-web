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
			t(COMPANY.address, M + ld.width + 8, H - M - 26, 7, font, gray);
			t(`${COMPANY.email} · ${COMPANY.site}`, M + ld.width + 8, H - M - 36, 7, font, gray);
			page.drawLine({ start: { x: M, y: H - M - 66 }, end: { x: W - M, y: H - M - 66 }, thickness: 1, color: rgb(0.85, 0.87, 0.92) });
			t(o.courier.toUpperCase(), M, H - M - 84, 13, bold);
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
	page.drawText(COMPANY.name, { x: M + ld.width + 10, y: top - 6, size: 14, font: bold, color: navy });
	page.drawText(COMPANY.address, { x: M + ld.width + 10, y: top - 20, size: 8.5, font, color: gray });
	page.drawText(`P.IVA ${COMPANY.vat} · ${COMPANY.email} · ${COMPANY.site}`, { x: M + ld.width + 10, y: top - 31, size: 8.5, font, color: gray });
	page.drawText(title, { x: 547 - bold.widthOfTextAtSize(title, 18), y: top - 4, size: 18, font: bold, color: navy });
	page.drawText(`N. ${number}`, { x: 547 - bold.widthOfTextAtSize(`N. ${number}`, 10), y: top - 20, size: 10, font: bold, color: navy });
	page.drawText(`Data: ${date}`, { x: 547 - font.widthOfTextAtSize(`Data: ${date}`, 9), y: top - 32, size: 9, font, color: gray });
	page.drawLine({ start: { x: M, y: top - 56 }, end: { x: 547, y: top - 56 }, thickness: 1, color: rgb(0.85, 0.87, 0.92) });
}
const addrLines = (a: Record<string, string>) => [a.company, [a.first_name, a.last_name].filter(Boolean).join(' '), [a.street, a.street2].filter(Boolean).join(', '), [a.zip, a.city, a.province ? `(${a.province})` : ''].filter(Boolean).join(' '), a.country && a.country !== 'IT' ? a.country : 'Italia', a.vat ? `P.IVA ${a.vat}` : '', a.fiscal_code ? `C.F. ${a.fiscal_code}` : ''].filter(Boolean);
const eur = (v: number) => `${v.toFixed(2).replace('.', ',')} €`;

/** Documento di trasporto A4 */
export async function buildDdtPdf(d: DdtData): Promise<Uint8Array> {
	const pdf = await PDFDocument.create();
	const page = pdf.addPage([595.28, 841.89]);
	const font = await pdf.embedFont(StandardFonts.Helvetica); const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
	const logo = await pdf.embedPng(b64(LOGO_PNG_B64));
	docHeader(page, font, bold, logo, 'DOCUMENTO DI TRASPORTO', d.number, new Date(d.issued_at).toLocaleDateString('it-IT'));
	const M = 48; let y = 720;
	const t = (txt: string, x: number, yy: number, size = 10, f: PDFFont = font, color = navy) => page.drawText(txt, { x, y: yy, size, font: f, color });
	t('Cliente', M, y, 8.5, bold, gray); t('Destinazione', 320, y, 8.5, bold, gray); y -= 14;
	const L = addrLines(d.customer), R = addrLines(d.shipping);
	for (let i = 0; i < Math.max(L.length, R.length); i++) { if (L[i]) t(L[i], M, y, i === 0 ? 11 : 10, i === 0 ? bold : font); if (R[i]) t(R[i], 320, y, i === 0 ? 11 : 10, i === 0 ? bold : font); y -= 13; }
	y -= 10;
	t(`Ordine ${d.order_number} · Causale: ${d.causale} · Trasporto: ${d.trasporto} · Colli: ${d.parcels}${d.weight_kg ? ` · Peso: ${d.weight_kg} kg` : ''}`, M, y, 9, font, gray); y -= 22;
	page.drawRectangle({ x: M, y: y - 6, width: 499, height: 20, color: rgb(0.96, 0.97, 0.99) });
	t('Descrizione', M + 6, y, 9, bold, gray); t('Q.tà', 380 - bold.widthOfTextAtSize('Q.tà', 9), y, 9, bold, gray); t('Prezzo unit.', 460 - bold.widthOfTextAtSize('Prezzo unit.', 9), y, 9, bold, gray); t('Imponibile', 547 - bold.widthOfTextAtSize('Imponibile', 9), y, 9, bold, gray); y -= 24;
	for (const l of d.lines) {
		t(l.description.length > 72 ? l.description.slice(0, 69) + '…' : l.description, M + 6, y, 10);
		t(String(l.qty), 380 - font.widthOfTextAtSize(String(l.qty), 10), y, 10); t(eur(l.unit_net), 460 - font.widthOfTextAtSize(eur(l.unit_net), 10), y, 10); t(eur(l.total_net), 547 - bold.widthOfTextAtSize(eur(l.total_net), 10), y, 10, bold);
		y -= 18; page.drawLine({ start: { x: M, y: y + 6 }, end: { x: 547, y: y + 6 }, thickness: 0.5, color: rgb(0.9, 0.91, 0.94) });
	}
	y -= 8;
	const tot = (label: string, value: string, strong = false) => { t(label, 460 - (strong ? bold : font).widthOfTextAtSize(label, 10), y, 10, strong ? bold : font, strong ? navy : gray); t(value, 547 - (strong ? bold : font).widthOfTextAtSize(value, strong ? 12 : 10), y, strong ? 12 : 10, strong ? bold : font); y -= 16; };
	tot('Imponibile', eur(d.subtotal_net)); tot('IVA 22%', eur(d.vat_amount)); tot('Totale', eur(d.total_gross), true);
	if (d.notes) { y -= 8; t(`Note: ${d.notes}`.slice(0, 120), M, y, 9, font, gray); }
	t('Firma del vettore ______________________      Firma del destinatario ______________________', M, 70, 9, font, gray);
	t('Documento generato da stickerprint.it', M, 40, 8, font, gray);
	return pdf.save();
}
