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
	return `<a href="${esc(href)}" style="display:inline-block;background:${bg};color:${fg};text-decoration:none;font:800 12px/1 Arial,Helvetica,sans-serif;padding:10px 15px;border-radius:999px;">${esc(testo)}</a>`;
}

export function firmaHtml(d: DatiFirma): string {
	const sito = d.sito.replace(/\/$/, '');
	const assets = (d.assets || sito).replace(/\/$/, '');
	const dominio = sito.replace(/^https?:\/\//, '');
	const r = d.stelle && d.stelle.quante > 0 ? d.stelle : null;
	const claim = d.claim || 'realizzati con cura e passione nel nostro laboratorio';
	const wa = d.whatsapp ? tel(d.whatsapp).replace('+', '') : '';
	return `<table cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;font-family:Arial,Helvetica,sans-serif;color:${C.navy};width:560px;max-width:100%;background:#ffffff;">
<tr><td style="padding:0 0 14px;">
	<table cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
		<tr>
			<td width="120" style="vertical-align:middle;padding:0 18px 0 0;">
				<a href="${esc(sito)}" style="text-decoration:none;"><img src="${esc(assets)}/images/splogo-400.png" alt="Stickerprint" width="116" height="93" style="display:block;border:0;width:116px;height:auto;"></a>
			</td>
			<td style="vertical-align:middle;border-left:4px solid ${C.navy};padding:2px 0 2px 18px;">
				<div style="font:800 20px/1.15 Arial,Helvetica,sans-serif;color:${C.navy};letter-spacing:-.01em;">${esc(d.nome)}</div>
				<div style="font:800 14px/1.4 Arial,Helvetica,sans-serif;padding-top:4px;">
					<span style="color:${C.azzurro};">Stickerprint</span> <span style="color:${C.navy};">${esc(d.ruolo)}</span>
				</div>
				<img src="${esc(assets)}/images/firma-riga-gialla.png" width="${Math.round(88 + d.ruolo.length * 7.6)}" height="8" alt="" style="display:block;border:0;margin:-3px 0 0;width:${Math.round(88 + d.ruolo.length * 7.6)}px;height:8px;">
				<div style="font:400 13px/1.7 Arial,Helvetica,sans-serif;padding-top:7px;">
					<a href="mailto:${esc(d.email)}" style="color:${C.navy};text-decoration:none;font-weight:700;">${esc(d.email)}</a>
					<span style="color:${C.linea};">&nbsp;|&nbsp;</span>
					<a href="${esc(sito)}" style="color:${C.azzurro};text-decoration:none;font-weight:700;">${esc(dominio)}</a>
				</div>
				${wa || r ? `<table cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;margin-top:12px;">
					<tr>
						${wa ? `<td style="vertical-align:middle;padding:0 14px 0 0;">${bottone('💬  WhatsApp', `https://wa.me/${wa}`, '#25d366', '#062b12')}</td>` : ''}
						${r ? `<td style="vertical-align:middle;font:800 13px/1.3 Arial,Helvetica,sans-serif;color:${C.navy};white-space:nowrap;">
							<span style="color:${C.giallo};font-size:16px;letter-spacing:1px;">${stelline(r.media)}</span>&nbsp; ${r.media.toFixed(1).replace('.', ',')}/5
							<span style="font-weight:400;color:${C.grigio};">· Recensioni verificate</span>
						</td>` : ''}
					</tr>
				</table>` : ''}
			</td>
		</tr>
	</table>
</td></tr>

<tr><td style="padding:0 0 12px;font:400 13px/1.55 Arial,Helvetica,sans-serif;color:${C.navy};">
	<span style="font-size:17px;">🥇</span> <b style="background:#ffe9a8;padding:3px 8px;border-radius:6px;">1ª scelta per adesivi premium</b><br>
	<span style="color:${C.navy};font-weight:700;">${esc(claim)}</span><br>
	<img src="${esc(assets)}/images/firma-riga-azzurra.png" width="${Math.round(claim.length * 6.4)}" height="7" alt="" style="display:block;border:0;margin:-2px 0 0;width:${Math.round(claim.length * 6.4)}px;height:7px;">
</td></tr>

<tr><td style="padding:0 0 12px;">
	<table cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate;background:#eaf3ff;border-radius:12px;width:100%;">
		<tr><td style="padding:11px 14px;font:400 12px/1.8 Arial,Helvetica,sans-serif;color:${C.navy};">
			${d.sedi.map((s) => `<b style="color:${C.azzurro};">${esc(s.nome)}:</b> ${esc(s.indirizzo)}`).join('<br>')}
		</td></tr>
	</table>
</td></tr>

<tr><td style="border-top:1px solid ${C.linea};padding:8px 0 0;font:400 10px/1.5 Arial,Helvetica,sans-serif;color:${C.grigio};">
	${esc(d.legale)}<br>
	Le informazioni in questa email sono riservate a chi le riceve. Se ti è arrivata per errore, cancellala e avvisaci.
</td></tr>
</table>`;
}
