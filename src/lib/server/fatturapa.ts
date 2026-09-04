import { COMPANY } from './company';

export interface FpaInvoice {
	number: string; issued_at: string; email: string | null; billing: Record<string, string>;
	lines: { description: string; qty: number; unit_net: number; total_net: number; ddt?: string | null; ddt_date?: string | null }[];
	discount_net: number; discount_code?: string | null; express_net: number; credit_used: number; vat_amount: number; amount_gross: number;
	payment_method: string | null; ddt_number?: string | null; ddt_date?: string | null; order_numbers?: string[] | null; ddt_numbers?: string[] | null; ddt_dates?: Record<string, string> | null;
	payment_terms?: { due: string; amount: number; method: string; xml_code?: string }[] | null;
}
const PAY_LABEL: Record<string, string> = { paypal: 'PayPal', stripe: 'carta di credito (Stripe)', test: 'test' };
const esc = (s: string) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const n2 = (v: number) => (Math.round(v * 100) / 100).toFixed(2);
const n8 = (v: number) => v.toFixed(8).replace(/0+$/, '').replace(/\.$/, '.00');
const VAT = COMPANY.vatRate;

/** XML FatturaPA (FPR12) per lo SDI, da inviare tramite Sibill. Progressivo = numero fattura senza prefisso. */
export function buildFatturaPaXml(inv: FpaInvoice, progressivo: string): { xml: string; filename: string } {
	const b = inv.billing ?? {};
	const isCompany = !!b.vat;
	const sdi = (b.sdi ?? '').trim().toUpperCase();
	const pec = (b.pec ?? '').trim();
	const codiceDest = sdi.length === 7 ? sdi : '0000000';
	const payMode = /bonifico|ricevuta/i.test(inv.payment_method ?? '') ? 'MP05' : 'MP08';
	// righe: prodotti, express, sconto codice (negativo), credito Stickerprint come sconto (negativo, scorporato)
	// le righe arrivano già al netto di sconti e credito (normalizeLines): in fattura non compaiono voci di sconto
	const lines = inv.lines.map((l) => ({ d: l.description, q: l.qty, u: l.unit_net, t: l.total_net, ddt: l.ddt ?? null, ddtDate: l.ddt_date ?? null }));
	if (inv.express_net > 0) lines.push({ d: 'Produzione express (+30%)', q: 1, u: inv.express_net, t: inv.express_net, ddt: null, ddtDate: null });
	const imponibile = lines.reduce((s, l) => s + l.t, 0);
	const imposta = imponibile * VAT;
	const totale = imponibile + imposta;
	const dettaglio = lines.map((l, i) => `<DettaglioLinee><NumeroLinea>${i + 1}</NumeroLinea><Descrizione>${esc(l.d).slice(0, 1000)}</Descrizione><Quantita>${n2(l.q)}</Quantita><PrezzoUnitario>${n8(l.u)}</PrezzoUnitario><PrezzoTotale>${n2(l.t)}</PrezzoTotale><AliquotaIVA>${n2(VAT * 100)}</AliquotaIVA></DettaglioLinee>`).join('');
	const anagrafica = isCompany || b.company ? `<Denominazione>${esc(b.company || `${b.first_name ?? ''} ${b.last_name ?? ''}`.trim())}</Denominazione>` : `<Nome>${esc(b.first_name ?? '')}</Nome><Cognome>${esc(b.last_name ?? '')}</Cognome>`;
	const fiscal = `${isCompany ? `<IdFiscaleIVA><IdPaese>${esc(b.country || 'IT')}</IdPaese><IdCodice>${esc(b.vat.replace(/^IT/i, ''))}</IdCodice></IdFiscaleIVA>` : ''}${b.fiscal_code ? `<CodiceFiscale>${esc(b.fiscal_code.toUpperCase())}</CodiceFiscale>` : ''}`;
	// DDT collegati: uno per documento, con il riferimento alle righe che ne derivano
	const ddtList = inv.ddt_numbers?.length ? inv.ddt_numbers : inv.ddt_number ? [inv.ddt_number] : [];
	const ddt = ddtList.map((n) => {
		const refs = lines.map((l, i) => (l.ddt === n ? i + 1 : 0)).filter(Boolean);
		const date = lines.find((l) => l.ddt === n)?.ddtDate ?? inv.ddt_dates?.[n] ?? inv.ddt_date ?? inv.issued_at;
		return `<DatiDDT><NumeroDDT>${esc(n)}</NumeroDDT><DataDDT>${date}</DataDDT>${refs.map((r) => `<RiferimentoNumeroLinea>${r}</RiferimentoNumeroLinea>`).join('')}</DatiDDT>`;
	}).join('');
	const payText = PAY_LABEL[inv.payment_method ?? ''] ?? inv.payment_method ?? '';
	const causale = `<Causale>${esc([ddtList.length ? `DDT collegati: ${ddtList.join(', ')}` : '', inv.order_numbers?.length ? `Ordine ${inv.order_numbers.join(', ')}` : '', payText && (inv.payment_method === 'paypal' || inv.payment_method === 'stripe') ? `Pagato con ${payText}` : payText ? `Pagamento: ${payText}` : ''].filter(Boolean).join(' - ') || 'Vendita')}</Causale>`;
	const terms = inv.payment_terms?.length ? inv.payment_terms : [{ due: inv.issued_at, amount: 0, method: payText, xml_code: payMode }];
	const xml = `<?xml version="1.0" encoding="UTF-8"?>
<p:FatturaElettronica versione="FPR12" xmlns:p="http://ivaservizi.agenziaentrate.gov.it/docs/xsd/fatture/v1.2" xmlns:ds="http://www.w3.org/2000/09/xmldsig#" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://ivaservizi.agenziaentrate.gov.it/docs/xsd/fatture/v1.2 http://www.fatturapa.gov.it/export/fatturazione/sdi/fatturapa/v1.2/Schema_del_file_xml_FatturaPA_versione_1.2.xsd">
<FatturaElettronicaHeader>
<DatiTrasmissione><IdTrasmittente><IdPaese>IT</IdPaese><IdCodice>${esc(COMPANY.fiscalCode)}</IdCodice></IdTrasmittente><ProgressivoInvio>${esc(progressivo)}</ProgressivoInvio><FormatoTrasmissione>FPR12</FormatoTrasmissione><CodiceDestinatario>${codiceDest}</CodiceDestinatario>${codiceDest === '0000000' && pec ? `<PECDestinatario>${esc(pec)}</PECDestinatario>` : ''}</DatiTrasmissione>
<CedentePrestatore><DatiAnagrafici><IdFiscaleIVA><IdPaese>IT</IdPaese><IdCodice>${esc(COMPANY.vat)}</IdCodice></IdFiscaleIVA><CodiceFiscale>${esc(COMPANY.fiscalCode)}</CodiceFiscale><Anagrafica><Denominazione>${esc(COMPANY.name)}</Denominazione></Anagrafica><RegimeFiscale>${COMPANY.regime}</RegimeFiscale></DatiAnagrafici><Sede><Indirizzo>${esc(COMPANY.street)}</Indirizzo><CAP>${COMPANY.zip}</CAP><Comune>${esc(COMPANY.city)}</Comune><Provincia>${COMPANY.province}</Provincia><Nazione>${COMPANY.country}</Nazione></Sede>${COMPANY.email ? `<Contatti><Email>${esc(COMPANY.email)}</Email></Contatti>` : ''}</CedentePrestatore>
<CessionarioCommittente><DatiAnagrafici>${fiscal}<Anagrafica>${anagrafica}</Anagrafica></DatiAnagrafici><Sede><Indirizzo>${esc([b.street, b.street2].filter(Boolean).join(', ') || '-')}</Indirizzo><CAP>${esc((b.zip ?? '00000').padStart(5, '0'))}</CAP><Comune>${esc(b.city || '-')}</Comune>${b.province ? `<Provincia>${esc(b.province.toUpperCase().slice(0, 2))}</Provincia>` : ''}<Nazione>${esc((b.country || 'IT').toUpperCase())}</Nazione></Sede></CessionarioCommittente>
</FatturaElettronicaHeader>
<FatturaElettronicaBody>
<DatiGenerali><DatiGeneraliDocumento><TipoDocumento>TD01</TipoDocumento><Divisa>EUR</Divisa><Data>${inv.issued_at}</Data><Numero>${esc(inv.number)}</Numero><ImportoTotaleDocumento>${n2(totale)}</ImportoTotaleDocumento>${causale}</DatiGeneraliDocumento>${ddt}</DatiGenerali>
<DatiBeniServizi>${dettaglio}<DatiRiepilogo><AliquotaIVA>${n2(VAT * 100)}</AliquotaIVA><ImponibileImporto>${n2(imponibile)}</ImponibileImporto><Imposta>${n2(imposta)}</Imposta><EsigibilitaIVA>I</EsigibilitaIVA></DatiRiepilogo></DatiBeniServizi>
<DatiPagamento><CondizioniPagamento>${terms.length > 1 ? 'TP01' : 'TP02'}</CondizioniPagamento>${terms.map((t, i) => `<DettaglioPagamento><ModalitaPagamento>${esc(t.xml_code || payMode)}</ModalitaPagamento><DataScadenzaPagamento>${esc(t.due)}</DataScadenzaPagamento><ImportoPagamento>${n2(terms.length === 1 ? totale : i === terms.length - 1 ? totale - terms.slice(0, -1).reduce((s, x) => s + x.amount, 0) : t.amount)}</ImportoPagamento></DettaglioPagamento>`).join('')}</DatiPagamento>
</FatturaElettronicaBody>
</p:FatturaElettronica>`;
	return { xml, filename: `IT${COMPANY.vat}_${progressivo.replace(/[^A-Za-z0-9]/g, '').slice(-5).padStart(5, '0')}.xml` };
}
