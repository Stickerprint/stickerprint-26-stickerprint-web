/**
 * Firma email per Gmail.
 *
 * Gmail butta via i fogli di stile: ogni regola deve stare dentro l'attributo style di ogni tag, e
 * l'impaginazione si fa con le tabelle (i div con flex non reggono nei client di posta).
 * Le immagini devono stare su un indirizzo pubblico: i data:uri Gmail li scarta.
 * Larghezza 560 px: entra nelle finestre di risposta senza barre laterali.
 */
export interface DatiFirma {
	nome: string;
	ruolo: string;
	email: string;
	telefono: string;
	cellulare?: string;
	/** indirizzo del sito, con https e senza barra finale */
	sito: string;
	/** da dove prendere le immagini (di solito lo stesso sito) */
	assets: string;
	/** media e numero delle recensioni vere: senza recensioni la riga non si stampa */
	stelle?: { media: number; quante: number } | null;
	whatsapp?: string;
	/** riga legale: ragione sociale, sede e partita IVA (arriva dai dati dell'azienda) */
	azienda: string;
}

const C = { navy: '#050538', giallo: '#f4b400', rosa: '#ff3bc1', blu: '#0e8bff', verde: '#8be33a', grigio: '#6b7280', linea: '#e6e8f0' };
const esc = (s: string) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const tel = (s: string) => s.replace(/[^\d+]/g, '');

/** stelle piene e mezze, disegnate con i caratteri: si vedono in tutti i client */
export function stelline(media: number): string {
	const n = Math.round(media * 2) / 2;
	let out = '';
	for (let i = 1; i <= 5; i++) out += i <= n ? '★' : i - 0.5 === n ? '⯨' : '☆';
	return out;
}

function bottone(testo: string, href: string, bg: string, fg: string): string {
	return `<a href="${esc(href)}" style="display:inline-block;background:${bg};color:${fg};text-decoration:none;font:700 12px/1 Arial,Helvetica,sans-serif;padding:9px 14px;border-radius:999px;margin:0 6px 6px 0;">${esc(testo)}</a>`;
}

export function firmaHtml(d: DatiFirma): string {
	const sito = d.sito.replace(/\/$/, '');
	const assets = (d.assets || sito).replace(/\/$/, '');
	const dominio = sito.replace(/^https?:\/\//, '');
	const r = d.stelle && d.stelle.quante > 0 ? d.stelle : null;
	return `<table cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;font-family:Arial,Helvetica,sans-serif;color:${C.navy};width:560px;max-width:100%;">
<tr><td style="padding:0 0 12px;">
	<table cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
		<tr>
			<td style="padding:0 16px 0 0;vertical-align:middle;">
				<a href="${esc(sito)}" style="text-decoration:none;"><img src="${esc(assets)}/images/splogo-400.png" alt="Stickerprint" width="64" height="51" style="display:block;border:0;width:64px;height:auto;"></a>
			</td>
			<td style="vertical-align:middle;border-left:3px solid ${C.giallo};padding:0 0 0 16px;">
				<div style="font:800 17px/1.2 Arial,Helvetica,sans-serif;color:${C.navy};">${esc(d.nome)}</div>
				<div style="font:600 12px/1.4 Arial,Helvetica,sans-serif;color:${C.grigio};padding-top:2px;">${esc(d.ruolo)} · <span style="color:${C.navy};font-weight:800;">Sticker</span><span style="color:${C.giallo};font-weight:800;">print</span></div>
				<div style="font:400 12px/1.7 Arial,Helvetica,sans-serif;padding-top:6px;color:${C.navy};">
					<a href="tel:${esc(tel(d.telefono))}" style="color:${C.navy};text-decoration:none;font-weight:700;">${esc(d.telefono)}</a>${d.cellulare ? ` &nbsp;·&nbsp; <a href="tel:${esc(tel(d.cellulare))}" style="color:${C.navy};text-decoration:none;font-weight:700;">${esc(d.cellulare)}</a>` : ''}<br>
					<a href="mailto:${esc(d.email)}" style="color:${C.blu};text-decoration:none;">${esc(d.email)}</a> &nbsp;·&nbsp; <a href="${esc(sito)}" style="color:${C.blu};text-decoration:none;">${esc(dominio)}</a>
				</div>
			</td>
		</tr>
	</table>
</td></tr>

${r ? `<tr><td style="padding:0 0 12px;">
	<table cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;background:#fff9e6;border:1px solid #ffe49a;border-radius:12px;">
		<tr>
			<td style="padding:9px 14px;font:700 13px/1.2 Arial,Helvetica,sans-serif;color:${C.navy};white-space:nowrap;">
				<span style="color:${C.giallo};font-size:15px;letter-spacing:1px;">${stelline(r.media)}</span>
				&nbsp;${r.media.toFixed(1).replace('.', ',')}/5
				<span style="font-weight:400;color:${C.grigio};">&nbsp;·&nbsp;${r.quante} recensioni verificate dei nostri clienti</span>
			</td>
		</tr>
	</table>
</td></tr>` : ''}

<tr><td style="padding:0 0 10px;">
	${bottone('Ordina online', sito, C.navy, '#ffffff')}${bottone('Preventivo aziende', `${sito}/aziende`, C.blu, '#ffffff')}${bottone('Assistenza', `${sito}/support`, '#eef0f6', C.navy)}${d.whatsapp ? bottone('WhatsApp', `https://wa.me/${tel(d.whatsapp).replace('+', '')}`, C.verde, '#0b2e00') : ''}
</td></tr>

<tr><td style="padding:0 0 8px;">
	<table cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;width:100%;">
		<tr>
			<td style="font:700 11px/1.5 Arial,Helvetica,sans-serif;color:${C.navy};background:#f4f5fb;border-radius:10px;padding:8px 12px;">
				🇮🇹 Stampa in Italia &nbsp;·&nbsp; 🚚 Consegna in 24/48 h &nbsp;·&nbsp; ✂️ Sagoma su misura &nbsp;·&nbsp; 💧 Resinati e rilievo
			</td>
		</tr>
	</table>
</td></tr>

<tr><td style="border-top:1px solid ${C.linea};padding:8px 0 0;font:400 10px/1.5 Arial,Helvetica,sans-serif;color:${C.grigio};">
	${esc(d.azienda)}<br>
	Le informazioni in questa email sono riservate a chi le riceve. Se ti è arrivata per errore, cancellala e avvisaci.
</td></tr>
</table>`;
}
