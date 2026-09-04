import { env } from '$env/dynamic/private';
import { COMPANY } from '../company';
import { b64ToBytes, xmlEsc, xmlTag, type CourierAdapter, type ShipmentInput } from './types';

/**
 * GLS Italia · Web Service "Weblabels" (ilswebservice.asmx).
 * Variabili: GLS_SEDE (sigla sede), GLS_CODICE_CLIENTE, GLS_PASSWORD, GLS_CODICE_CONTRATTO.
 * Metodi usati: AddParcel (crea la spedizione e restituisce numero ed etichetta PDF), CloseWorkDay (conferma/trasmette le spedizioni).
 * I nomi dei campi seguono la documentazione GLS Weblabels: da verificare con l'account di test della sede.
 */
const BASE = env.GLS_ENDPOINT || 'https://weblabels.gls-italy.com/ilswebservice.asmx';
const VARS = ['GLS_SEDE', 'GLS_CODICE_CLIENTE', 'GLS_PASSWORD', 'GLS_CODICE_CONTRATTO'];
const missing = VARS.filter((v) => !env[v]);

async function call(method: string, param: string, xml: string): Promise<string> {
	const r = await fetch(`${BASE}/${method}`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: `${param}=${encodeURIComponent(xml)}` });
	const text = await r.text();
	if (!r.ok) throw new Error(`GLS ${method}: HTTP ${r.status} ${text.slice(0, 200)}`);
	return text.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
}
const auth = () => `<SedeGls>${xmlEsc(env.GLS_SEDE)}</SedeGls><CodiceClienteGls>${xmlEsc(env.GLS_CODICE_CLIENTE)}</CodiceClienteGls><PasswordClienteGls>${xmlEsc(env.GLS_PASSWORD)}</PasswordClienteGls>`;

export const gls: CourierAdapter = {
	id: 'GLS', configured: missing.length === 0, missing,
	async createShipment(s: ShipmentInput) {
		const r = s.recipient;
		const xml = `<Info>${auth()}<Parcel><CodiceContrattoGls>${xmlEsc(env.GLS_CODICE_CONTRATTO)}</CodiceContrattoGls><RagioneSociale>${xmlEsc(r.name.slice(0, 35))}</RagioneSociale><Indirizzo>${xmlEsc(r.street.slice(0, 35))}</Indirizzo><Localita>${xmlEsc(r.city.slice(0, 30))}</Localita><Zipcode>${xmlEsc(r.zip)}</Zipcode><Provincia>${xmlEsc(r.province)}</Provincia><Bda>${xmlEsc(s.orderNumber)}</Bda><DataDocumentoTrasporto>${new Date().toLocaleDateString('it-IT')}</DataDocumentoTrasporto><Colli>${s.parcels}</Colli><Incoterm></Incoterm><PesoReale>${s.weightKg.toFixed(1).replace('.', ',')}</PesoReale><ImportoContrassegno></ImportoContrassegno><NoteSpedizione>${xmlEsc((s.notes ?? s.contents).slice(0, 40))}</NoteSpedizione><TipoPorto>F</TipoPorto><Assicurazione></Assicurazione><ValoreDichiarato></ValoreDichiarato><TipoCollo>0</TipoCollo><Email>${xmlEsc(r.email)}</Email><Cellulare1>${xmlEsc(r.phone)}</Cellulare1><GeneraPdf>4</GeneraPdf><FormatoPdf>A6</FormatoPdf><PersonaRiferimento>${xmlEsc(r.contact ?? '')}</PersonaRiferimento><Riferimento>${xmlEsc(s.reference)}</Riferimento><TelefonoDestinatario>${xmlEsc(r.phone)}</TelefonoDestinatario><StatoDestinatario>${xmlEsc(r.country || 'IT')}</StatoDestinatario><IdentificativoOrdine>${xmlEsc(s.orderNumber)}</IdentificativoOrdine></Parcel></Info>`;
		const res = await call('AddParcel', 'XMLInfo', xml);
		const tracking = xmlTag(res, 'NumeroSpedizione');
		const err = xmlTag(res, 'NoteSpedizione') || xmlTag(res, 'Errore') || xmlTag(res, 'DescrizioneErrore');
		if (!tracking) throw new Error(`GLS: spedizione non creata ${err ? '· ' + err : ''}`.trim());
		const pdf = xmlTag(res, 'PdfLabel');
		return { tracking, labelPdf: pdf ? b64ToBytes(pdf) : null, raw: res.slice(0, 2000) };
	},
	async closeDay(shipments) {
		const xml = `<Info>${auth()}${shipments.map((s) => `<Parcel><CodiceContrattoGls>${xmlEsc(env.GLS_CODICE_CONTRATTO)}</CodiceContrattoGls><NumeroDiSpedizioneGlsDaConfermare>${xmlEsc(s.tracking)}</NumeroDiSpedizioneGlsDaConfermare></Parcel>`).join('')}</Info>`;
		const res = await call('CloseWorkDay', 'XMLCloseInfo', xml);
		// il borderò GLS si stampa dal portale Weblabels; il manifest interno viene generato comunque
		return { manifestPdf: null, raw: res.slice(0, 2000) };
	}
};
export const glsSender = () => ({ name: COMPANY.name, street: COMPANY.street, zip: COMPANY.zip, city: COMPANY.city, province: COMPANY.province });
