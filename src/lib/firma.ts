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
	/** indirizzo del sito, con https e senza barra finale */
	sito: string;
	/** da dove prendere le immagini (di solito lo stesso sito) */
	assets: string;
	/** media delle recensioni vere: senza recensioni la riga non si stampa (il numero non si mostra) */
	stelle?: { media: number; quante: number } | null;
	/** le sedi, una per riga: nome dell'azienda e indirizzo */
	sedi: { nome: string; indirizzo: string }[];
	/** riga legale piccola in fondo (P.IVA) */
	legale: string;
	claim?: string;
	/** numero WhatsApp: senza numero il bottone non compare */
	whatsapp?: string;
}

/* i colori del sito: il navy e' quello dell'header, l'azzurro e' quello della scritta STICKER nel logo */
const C = { navy: '#050538', azzurro: '#0a95ff', giallo: '#f4b400', grigio: '#6b7280', linea: '#e6e8f0' };
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
	return `<a href="${esc(href)}" style="display:inline-block;background:${bg};color:${fg};text-decoration:none;font:800 12px/1 Arial,Helvetica,sans-serif;padding:11px 16px;border-radius:999px;margin:0 8px 0 0;">${esc(testo)}</a>`;
}

export function firmaHtml(d: DatiFirma): string {
	const sito = d.sito.replace(/\/$/, '');
	const assets = (d.assets || sito).replace(/\/$/, '');
	const dominio = sito.replace(/^https?:\/\//, '');
	const r = d.stelle && d.stelle.quante > 0 ? d.stelle : null;
	const claim = d.claim || 'Prodotti con cura nel nostro laboratorio';
	const wa = d.whatsapp ? tel(d.whatsapp).replace('+', '') : '';
	return `<table cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;font-family:Arial,Helvetica,sans-serif;color:${C.navy};width:560px;max-width:100%;">
<tr><td style="padding:0 0 12px;">
	<!-- il riquadro scuro con il bordo bianco: sembra uno dei nostri adesivi fustellati -->
	<table cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate;background:${C.navy};border:4px solid #ffffff;border-radius:22px;width:100%;">
		<tr>
			<td style="padding:16px 18px;">
				<table cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;width:100%;">
					<tr>
						<td width="112" style="vertical-align:middle;padding:0 16px 0 0;">
							<a href="${esc(sito)}" style="text-decoration:none;"><img src="${esc(assets)}/images/splogo-400.png" alt="Stickerprint" width="108" height="86" style="display:block;border:0;width:108px;height:auto;"></a>
						</td>
						<td style="vertical-align:middle;border-left:4px solid ${C.azzurro};padding:2px 0 2px 16px;">
							<div style="font:800 20px/1.15 Arial,Helvetica,sans-serif;color:#ffffff;letter-spacing:-.01em;">${esc(d.nome)}</div>
							<div style="font:800 14px/1.4 Arial,Helvetica,sans-serif;padding-top:4px;">
								<span style="color:${C.azzurro};">Stickerprint</span> <span style="color:#ffffff;">${esc(d.ruolo)}</span>
							</div>
							<div style="font:400 13px/1.7 Arial,Helvetica,sans-serif;padding-top:8px;">
								<a href="mailto:${esc(d.email)}" style="color:#ffffff;text-decoration:none;font-weight:700;">${esc(d.email)}</a><br>
								<a href="${esc(sito)}" style="color:${C.azzurro};text-decoration:none;font-weight:700;">${esc(dominio)}</a>
							</div>
						</td>
					</tr>
				</table>
				${r ? `<table cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate;background:#ffffff;border-radius:999px;margin-top:14px;">
					<tr><td style="padding:7px 14px;font:800 13px/1.2 Arial,Helvetica,sans-serif;color:${C.navy};white-space:nowrap;">
						<span style="color:${C.giallo};font-size:15px;letter-spacing:1px;">${stelline(r.media)}</span>&nbsp; ${r.media.toFixed(1).replace('.', ',')}/5
						<span style="font-weight:400;color:${C.grigio};">· Recensioni verificate</span>
					</td></tr>
				</table>` : ''}
			</td>
		</tr>
	</table>
</td></tr>

<tr><td style="padding:0 0 12px;font:800 14px/1.5 Arial,Helvetica,sans-serif;color:${C.navy};">
	<span style="background:#ffe9a8;padding:3px 8px;border-radius:6px;">${esc(claim)}</span>
</td></tr>

${wa ? `<tr><td style="padding:0 0 14px;">
	${bottone('💬  Scrivimi su WhatsApp', `https://wa.me/${wa}`, '#25d366', '#062b12')}
</td></tr>` : ''}

<tr><td style="padding:0 0 10px;font:400 12px/1.8 Arial,Helvetica,sans-serif;color:${C.navy};">
	${d.sedi.map((s) => `<b style="color:${C.azzurro};">${esc(s.nome)}:</b> ${esc(s.indirizzo)}`).join('<br>')}
</td></tr>

<tr><td style="padding:0 0 10px;">
	<table cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;width:100%;">
		<tr>
			<td style="font:800 11px/1.5 Arial,Helvetica,sans-serif;color:${C.navy};background:#f4f5fb;border-radius:10px;padding:9px 12px;">
				🇮🇹 Stampati in Italia &nbsp;·&nbsp; 🚚 Consegna in 24/48 h &nbsp;·&nbsp; ✂️ Sagoma su misura &nbsp;·&nbsp; 💧 Resinati e rilievo
			</td>
		</tr>
	</table>
</td></tr>

<tr><td style="border-top:1px solid ${C.linea};padding:8px 0 0;font:400 10px/1.5 Arial,Helvetica,sans-serif;color:${C.grigio};">
	${esc(d.legale)}<br>
	Le informazioni in questa email sono riservate a chi le riceve. Se ti è arrivata per errore, cancellala e avvisaci.
</td></tr>
</table>`;
}
