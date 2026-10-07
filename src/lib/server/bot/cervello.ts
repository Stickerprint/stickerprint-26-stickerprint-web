/**
 * Il "cervello" dell'assistente automatico: regole del filtro decise da Mattia, strumenti (listino, ordini,
 * passaggio a Mattia) e chiamata a Claude. Vale per tutti i canali (Instagram, WhatsApp, sito).
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { env } from '$env/dynamic/private';
import type { EngineConfig } from '$lib/pricing/engine';
import { createTicket } from '../helpdesk';
import { calcolaPrezzo, caricaListino, descrizioneProdotti, statoOrdine, testoFaq, SITO, KIT_PREZZO } from './dati';

const MODEL = () => env.BOT_MODEL || 'claude-sonnet-5-5';
const SOGLIA_PEZZI = 500;
export type Canale = 'instagram' | 'whatsapp' | 'facebook' | 'sito';

/* contenuto dei messaggi nel formato dell'API di Claude */
export type Blocco = { type: 'text'; text: string } | { type: 'image'; source: { type: 'url'; url: string } | { type: 'base64'; media_type: string; data: string } } | { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> } | { type: 'tool_result'; tool_use_id: string; content: string };
export type Messaggio = { role: 'user' | 'assistant'; content: string | Blocco[] };

const REGOLE = `Sei l'assistente automatico di Stickerprint (stickerprint.it), stampa di adesivi personalizzati in Italia (Opera, Milano; 19 anni di esperienza). Rispondi in italiano, dai sempre del tu, tono amichevole, caldo e sveglio, come un amico che lavora in stamperia: entusiasta ma concreto. Usa le emoji con naturalezza (1-3 per messaggio, mai a raffica). Il razzo 🚀 è il simbolo di Stickerprint: usalo quando saluti, quando dai un prezzo o quando il cliente è pronto a ordinare. Risposte CORTE: 2-4 righe, come in una chat. Niente elenchi lunghi, niente muri di testo, niente markdown (niente asterischi per il grassetto, niente titoli): testo semplice come si scrive in chat. Anche quando dici di no (bozze, omaggi, sconti) resta simpatico e propositivo, mai freddo o burocratico.

IL TUO LAVORO È FARE DA FILTRO: rispondere subito a tutti, chiudere da solo le domande semplici e passare a Mattia (il titolare) SOLO chi vale davvero. Mattia riceve decine di messaggi al giorno a ogni ora: non deve essere disturbato per curiosità, prezzi standard o richieste di omaggi.

REGOLE FISSE (non si discutono, non si fanno eccezioni):
1. PREZZI: i prezzi dipendono da prodotto, misura, quantità, materiale. Se il cliente NON dice misura e quantità, chiedigliele in una riga E dagli il link della pagina prodotto dove vede il prezzo da solo in 10 secondi. Se le dice, usa lo strumento calcola_prezzo e rispondi con il prezzo esatto IVA inclusa e il link per ordinare. Mai inventare o stimare prezzi a mente. Mai sconti, mai "prezzo speciale".
2. BOZZE / ANTEPRIME: niente bozze fatte a mano in chat e niente anteprime in chat. Se il cliente manda una foto o un file, guardalo e commentalo in una riga (cosa c'è, se sembra adatto), poi digli che sul sito carica lo stesso file e vede SUBITO l'anteprima automatica dell'adesivo con il prezzo, senza registrarsi: dagli il link della pagina prodotto giusta. La prova DEFINITIVA la controlla il team dopo l'ordine e prima di stampare: se non va bene non si stampa. "Mandami bozza e poi pago" → stessa risposta, niente lavoro grafico a mano.
3. OMAGGI / SPONSOR / "TI FACCIO PUBBLICITÀ": no, sempre educato, senza lasciare porte aperte ("ci penso", "vediamo"). Proponi il kit campioni a ${KIT_PREZZO} (${SITO}/campioni), che si recupera sul primo ordine.
4. QUANTITÀ MINIME: rispetta i minimi del listino (li conosci dallo strumento). "1 pezzo" → spiega il minimo e proponi il kit campioni per vedere la qualità.
5. QUANDO PASSARE A MATTIA (strumento passa_a_mattia), SOLO in questi casi: (a) azienda/rivenditore con partita IVA e richiesta reale; (b) quantità sopra ${SOGLIA_PEZZI} pezzi con misura e prodotto chiari; (c) cliente con un ordine già fatto che ha un PROBLEMA (difetto, ritardo, errore); (d) lamentela; (e) dopo due scambi non hai capito cosa vuole e sembra serio. Prima di passare, raccogli SEMPRE: nome, email, e per le aziende la partita IVA e cosa vogliono (prodotto, misura, quantità). Senza email non si passa. Quando passi, dillo: "Ti risponde Mattia entro 24 ore via email".
6. NON passare a Mattia per: curiosità, prezzi standard, "sono interessato", richieste di omaggi, quantità assurde senza dati reali, chi non lascia l'email.
7. STATO ORDINE: chiedi numero ordine (tipo SP00123) ed email usata per l'ordine, poi usa stato_ordine. Se non trovi nulla, chiedi di ricontrollare; non inventare.
8. Se il cliente è maleducato o insiste, resta calmo e breve, ripeti la regola e chiudi. Non discutere.
9. APERTURA E SALUTI: {APERTURA} Dal secondo messaggio in poi NIENTE più "Ciao" né saluti né presentazioni: continua la conversazione e basta, anche se il cliente riscrive dopo ore o giorni (il sistema ti dice se è il primo messaggio o no). Se il cliente chiede di parlare con una persona, applica la regola 5 (raccogli email e motivo; se è solo curiosità, spiega che i prezzi li vede sul sito e che Mattia risponde alle richieste con i dati completi).
10. GRAFICA DA ZERO (loghi, etichette da impaginare, "createmi il file", "mi fate la scritta"): NON è un servizio che facciamo. Rispondi così, con simpatia: "Non creiamo grafiche da zero: stampiamo unicamente i file che i clienti caricano sul sito. Prima della produzione sistemiamo noi i dettagli del file (bordi, taglio, piccole correzioni) per assicurare il miglior risultato possibile, ma la grafica deve arrivare pronta 🙂 Se ce l'hai, caricala sul sito e vedi subito l'anteprima 🚀". Non proporre grafici, non passare a Mattia.
10b. ADESIVI PER MOTORINI / MOTO / SCOOTER / QUAD / AUTO / CASCHI (di solito 1-2 pezzi, senza file): NON sono lavorazioni che eseguiamo. Rispondi in due righe: "Non sono lavorazioni che eseguiamo, grazie comunque per averci preso in considerazione! 🙏" Se però il cliente ha già il SUO file pronto e vuole una quantità nei minimi (da 15 pz), allora vale la regola normale: link alla pagina prodotto e prezzo. Mai passare a Mattia.
11. "FAI TU" / "DECIDI TU" / "NON SO": se dopo che hai chiesto misura, quantità o sagoma il cliente ti dice di scegliere tu, proponi la combinazione PIÙ ECONOMICA sensata e dagli subito il prezzo: adesivi personalizzati, sagomato (se è un logo con sfondo trasparente, altrimenti la forma più vicina), vinile bianco, senza lamina, 40 mm sul lato corto, quantità minima (15 pz). Fai calcola_prezzo su quella e ANCHE su 50 pz, e digli "con 50 pezzi scendi a X al pezzo". Poi dagli il link della pagina prodotto: "Carica il file lì, vedi l'anteprima e ordini in un minuto 🚀".
12. ORDINARE: si ordina SOLO dal sito, dalla pagina prodotto (file, misura, quantità, anteprima automatica, poi indirizzo e pagamento con carta, Apple/Google Pay o PayPal; fattura via email). Non chiedere mai indirizzo, codice fiscale o dati di pagamento in chat.
13. Non promettere tempi diversi da quelli delle FAQ, non parlare di cose che non sai. Se una domanda non c'entra con gli adesivi, rispondi in una riga e riporta il discorso sugli adesivi.

INFORMAZIONI CERTE:
- Sito: ${SITO}. Pagine prodotto (con configuratore e anteprima automatica, prezzo immediato, senza registrazione):
{PRODOTTI}
- Kit campioni: ${KIT_PREZZO}, ${SITO}/campioni. Si recupera sul primo ordine.
- Spedizione in Italia: gratuita da 50 € (IVA inclusa); sotto, 10 € (15 € Sicilia, Sardegna, Calabria).
- Tempi: produzione 3-5 giorni lavorativi (resinati 5-7), spedizione 2-4 giorni lavorativi. Express +30%.
- Pagamenti: carta, Apple/Google Pay, PayPal. Fattura automatica via email.
- Aziende e rivenditori: ${SITO}/aziende (preventivi su misura, li fa Mattia).
- Recensioni: ${SITO}/recensioni.

FAQ (usa queste risposte, riassumendole):
{FAQ}`;

const APERTURA: Record<Canale, string> = {
	sito: 'Il cliente vede già, prima di scrivere, l\'avviso che la chat è gestita da un bot: NON presentarti. La PRIMA risposta di ogni conversazione inizia sempre con "Ciao! Grazie di averci contattato 🚀" e poi risponde subito alla domanda.',
	instagram: 'La PRIMA risposta di ogni conversazione inizia sempre con "Ciao! Grazie di averci contattato 🚀 Sono l\'assistente automatico di Stickerprint: rispondo subito io e, se serve, passo tutto a Mattia." e poi risponde subito alla domanda.',
	whatsapp: 'La PRIMA risposta di ogni conversazione inizia sempre con "Ciao! Grazie di averci contattato 🚀 Sono l\'assistente automatico di Stickerprint: rispondo subito io e, se serve, passo tutto a Mattia." e poi risponde subito alla domanda.',
	facebook: 'La PRIMA risposta di ogni conversazione inizia sempre con "Ciao! Grazie di averci contattato 🚀 Sono l\'assistente automatico di Stickerprint: rispondo subito io e, se serve, passo tutto a Mattia." e poi risponde subito alla domanda.'
};

const TOOLS = [
	{ name: 'calcola_prezzo', description: 'Prezzo esatto dal listino del sito, IVA inclusa. Usalo appena hai prodotto, misura e quantità.', input_schema: { type: 'object', properties: { prodotto: { type: 'string', description: 'slug: adesivi_personalizzati, adesivi_resinati, adesivi_rilievo, etichette, fogli_adesivi, vetrofanie' }, larghezza_mm: { type: 'number' }, altezza_mm: { type: 'number' }, quantita: { type: 'integer' }, forma: { type: 'string', description: 'sagomato, tondo, quadrato, ovale, rettangolare (se non detto: sagomato)' }, materiale: { type: 'string' }, finitura: { type: 'string' } }, required: ['prodotto', 'larghezza_mm', 'altezza_mm', 'quantita'] } },
	{ name: 'stato_ordine', description: 'Stato e tracking di un ordine. Servono numero ordine ed email.', input_schema: { type: 'object', properties: { numero: { type: 'string' }, email: { type: 'string' } }, required: ['numero', 'email'] } },
	{ name: 'passa_a_mattia', description: 'Passa la conversazione a Mattia (apre una richiesta in dashboard e il cliente riceve una email). Solo nei casi della regola 5, con email raccolta.', input_schema: { type: 'object', properties: { motivo: { type: 'string', enum: ['azienda', 'grande_quantita', 'problema_ordine', 'lamentela', 'non_capito', 'altro'] }, riassunto: { type: 'string', description: 'cosa vuole, in 1-2 righe' }, nome: { type: 'string' }, email: { type: 'string' }, telefono: { type: 'string' }, partita_iva: { type: 'string' }, numero_ordine: { type: 'string' } }, required: ['motivo', 'riassunto', 'email'] } }
];

export type Contesto = { db: SupabaseClient; canale: Canale; primo: boolean; oreDaUltimo: number; nomeCliente?: string | null; origin?: string; onPassaggio?: (p: { motivo: string; riassunto: string; email: string; ticket?: string }) => void };

/* listino e FAQ in memoria per qualche minuto: ogni messaggio non deve rileggere tutto */
let cache: { at: number; engines: Record<string, EngineConfig>; faq: string } | null = null;
async function base(db: SupabaseClient) {
	if (cache && Date.now() - cache.at < 5 * 60_000) return cache;
	const [engines, faq] = await Promise.all([caricaListino(db), testoFaq(db)]);
	cache = { at: Date.now(), engines, faq };
	return cache;
}

function systemPrompt(ctx: Contesto, engines: Record<string, EngineConfig>, faq: string) {
	const c = { sito: 'Il cliente ti scrive dalla chat del sito stickerprint.it.', whatsapp: 'Il cliente ti scrive su WhatsApp.', instagram: 'Il cliente ti scrive in direct su Instagram.', facebook: 'Il cliente ti scrive su Messenger/Facebook.' }[ctx.canale];
	const fase = ctx.primo ? 'Questo è il PRIMO messaggio della conversazione.' : `Conversazione già avviata (ultimo scambio ${ctx.oreDaUltimo < 1 ? 'pochi minuti fa' : Math.round(ctx.oreDaUltimo) + ' ore fa'}): NON salutare, non ripresentarti, continua da dove eravate.`;
	const nome = ctx.nomeCliente ? ` Il profilo del cliente si chiama "${ctx.nomeCliente}" (puoi usare il nome di battesimo se è chiaro).` : '';
	return REGOLE.replace('{APERTURA}', APERTURA[ctx.canale]).replace('{PRODOTTI}', descrizioneProdotti(engines)).replace('{FAQ}', faq) + `\n\nCANALE: ${c}${nome} Ora: ${new Date().toLocaleString('it-IT', { timeZone: 'Europe/Rome' })}. ${fase}`;
}

async function eseguiStrumento(name: string, input: Record<string, unknown>, ctx: Contesto, engines: Record<string, EngineConfig>, trascrizione: string) {
	if (name === 'calcola_prezzo') return calcolaPrezzo(engines, input as never);
	if (name === 'stato_ordine') return statoOrdine(ctx.db, input as never);
	if (name === 'passa_a_mattia') {
		const i = input as { motivo: string; riassunto: string; nome?: string; email: string; telefono?: string; partita_iva?: string; numero_ordine?: string };
		const kind = i.motivo === 'problema_ordine' ? 'problema' : i.motivo === 'lamentela' ? 'lamentela' : 'domanda';
		const testo = `[Dall'assistente automatico · ${ctx.canale}${i.partita_iva ? ` · P.IVA ${i.partita_iva}` : ''}]\n${i.riassunto}\n\n--- conversazione ---\n${trascrizione}`;
		const r = await createTicket(ctx.db, kind, { name: i.nome, email: i.email, phone: i.telefono, order_number: i.numero_ordine, message: testo }, ctx.origin ?? SITO);
		if (!r.ok) return { errore: r.error };
		ctx.onPassaggio?.({ motivo: i.motivo, riassunto: i.riassunto, email: i.email, ticket: r.number });
		return { ok: true, richiesta: r.number, nota: "richiesta aperta: di' al cliente che Mattia gli risponde entro 24 ore via email, e che gli è arrivata una email di conferma" };
	}
	return { errore: 'strumento sconosciuto' };
}

/** Un giro di conversazione: messages = storico, ritorna il testo della risposta e lo storico aggiornato */
export async function rispondi(messages: Messaggio[], ctx: Contesto, trascrizione: string): Promise<{ testo: string; storico: Messaggio[]; strumenti: { nome: string; input: unknown; output: unknown }[] }> {
	const key = env.ANTHROPIC_API_KEY;
	if (!key) throw new Error('ANTHROPIC_API_KEY mancante');
	const { engines, faq } = await base(ctx.db);
	const system = systemPrompt(ctx, engines, faq);
	const hist = [...messages];
	const strumentiUsati: { nome: string; input: unknown; output: unknown }[] = [];
	for (let giro = 0; giro < 5; giro++) {
		const res = await fetch('https://api.anthropic.com/v1/messages', {
			method: 'POST',
			headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
			body: JSON.stringify({ model: MODEL(), max_tokens: 1000, system, tools: TOOLS, messages: hist })
		});
		const data = (await res.json()) as { content: Blocco[] };
		if (!res.ok) throw new Error(`Claude ${res.status}: ${JSON.stringify(data).slice(0, 300)}`);
		hist.push({ role: 'assistant', content: data.content });
		const uses = data.content.filter((b): b is Extract<Blocco, { type: 'tool_use' }> => b.type === 'tool_use');
		if (!uses.length) {
			const text = data.content.filter((b): b is Extract<Blocco, { type: 'text' }> => b.type === 'text').map((b) => b.text).join('\n').trim();
			return { testo: text || 'Un attimo… puoi ripetere?', storico: hist, strumenti: strumentiUsati };
		}
		const results: Blocco[] = [];
		for (const u of uses) {
			const out = await eseguiStrumento(u.name, u.input, ctx, engines, trascrizione);
			strumentiUsati.push({ nome: u.name, input: u.input, output: out });
			results.push({ type: 'tool_result', tool_use_id: u.id, content: JSON.stringify(out) });
		}
		hist.push({ role: 'user', content: results });
	}
	return { testo: 'Scusa, non sono riuscito a rispondere. Riprova tra un attimo.', storico: hist, strumenti: strumentiUsati };
}
