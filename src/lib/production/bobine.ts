/**
 * STAMPA: i compiti della giornata, non l'elenco degli ordini.
 *
 * Regole di Mattia (24/09/2026):
 *  - tre stampanti, ognuna con il suo mestiere:
 *      UV        -> adesivi SENZA laminazione protettiva e adesivi in rilievo;
 *      resinati  -> tutti i resinati;
 *      laminati  -> gli adesivi da laminare (lucida o opaca).
 *  - OTTIMIZZAZIONE: sulla stessa bobina vanno tutti i lavori con la STESSA laminazione, cosi' si fa
 *    una stampa sola e una laminazione sola. Se di quella laminazione c'e' un lavoro solo si aspetta
 *    un giorno per vedere se ne arrivano altri; al secondo giorno si stampa comunque.
 *    Un ordine arrivato dopo, con la stessa laminazione, entra nella bobina gia' aperta.
 *  - MARGINE sulle consegne: gli ordini del sito hanno una data promessa e inderogabile (1 giorno di
 *    margine), quelli scritti a mano ne hanno 2-3 (qui: 2).
 * Il modulo e' puro: prende i dati e restituisce le bobine, senza toccare database o pagine.
 */
import { shiftWorkDays } from './calendar';
import type { Calendar, RiskStatus } from './types';

export type Ruolo = 'uv' | 'resinati' | 'laminati';

/** icona del prodotto, per capire a colpo d'occhio cosa si sta stampando */
export const PRODOTTO_ICON: Record<string, string> = {
	adesivi_personalizzati: '🏷️', adesivi_resinati: '💧', adesivi_rilievo: '✨',
	etichette: '🧾', fogli_adesivi: '📄', vetrofanie: '🪟', kit_adesivi: '🎒', campioni: '🎁'
};
export const iconaProdotto = (slug: string) => PRODOTTO_ICON[(slug ?? '').replace(/-/g, '_')] ?? '📦';

/** come si chiama la protezione: laminazione lucida / opaca (mai "plastifica") */
export function etichettaProtezione(p: string): string {
	const v = (p ?? '').toLowerCase();
	if (!v || v === 'nessuna') return 'Senza laminazione';
	if (v === 'rilievo') return 'Rilievo';
	if (v.includes('lucid')) return 'Laminazione lucida';
	if (v.includes('opac')) return 'Laminazione opaca';
	if (v.includes('plastific') || v.includes('lamin')) return 'Laminazione (tipo non indicato)';
	return `Laminazione ${p}`;
}
/** targhetta colorata: la laminazione si deve leggere a colpo d'occhio */
export function targhettaProtezione(p: string): { testo: string; bg: string; fg: string } {
	const v = (p ?? '').toLowerCase();
	if (v.includes('lucid')) return { testo: 'Lamina lucida', bg: '#7dd3fc', fg: '#06283d' };
	if (v.includes('opac')) return { testo: 'Lamina opaca', bg: '#bef264', fg: '#1a2e05' };
	if (v === 'rilievo') return { testo: 'Rilievo', bg: '#ddd6fe', fg: '#2e1065' };
	if (!v || v === 'nessuna') return { testo: 'Senza lamina', bg: '#e5e7eb', fg: '#374151' };
	return { testo: 'Lamina da indicare', bg: '#fde68a', fg: '#4a2f00' };
}
export const RUOLO: Record<Ruolo, { label: string; cosa: string; icon: string; foto: string }> = {
	uv: { label: 'Stampa UV', cosa: 'adesivi senza laminazione e rilievo', icon: '🟣', foto: '/images/macchine/roland-lg-uv.jpg' },
	resinati: { label: 'Resinati', cosa: 'tutti i resinati', icon: '💧', foto: '/images/macchine/roland-sg3.jpg' },
	laminati: { label: 'Da laminare', cosa: 'adesivi con laminazione lucida o opaca', icon: '🧴', foto: '/images/macchine/roland-sg3.jpg' }
};

/** margine da tenere sulla data di consegna, in giorni lavorativi */
export const MARGINE = { sito: 1, manuale: 2 };
/** giorni di attesa massima per mettere insieme altri lavori con la stessa laminazione */
export const ATTESA_MAX = 2;

export interface LavoroStampa {
	jobId: string;
	faseId: string;
	numero: string;
	cliente: string;
	prodotto: string;
	/** laminazione richiesta: 'nessuna' oppure lucida, opaca, … */
	protezione: string;
	rilievo: boolean;
	resinato: boolean;
	/** 'manuale' = ordine scritto da noi (ha piu' margine) */
	canale: string;
	pezzi: number;
	mq: number;
	minuti: number;
	/** data di consegna promessa (o messa da noi) */
	consegna: string | null;
	/** da quando il lavoro e' in coda (giorno) */
	inCodaDal: string;
	stato: string;
	rischio: RiskStatus;
	/** anteprima dell'ordine (prova, mockup o file del cliente) */
	thumb: string | null;
}

export interface Bobina {
	id: string;
	ruolo: Ruolo;
	/** laminazione della bobina ('nessuna' sulla UV) */
	protezione: string;
	lavori: LavoroStampa[];
	mq: number;
	minuti: number;
	pezzi: number;
	/** ultimo giorno utile per accendere la macchina */
	avviaEntro: string | null;
	/** da quanti giorni il lavoro piu' vecchio aspetta compagni */
	attesaGiorni: number;
	/** si stampa oggi */
	pronta: boolean;
	/** in corso: qualcuno ha gia' avviato la stampa */
	inCorso: boolean;
	/** perche' si stampa (o perche' si aspetta) */
	motivo: string;
}

/** su quale macchina va un lavoro */
export function ruoloDi(l: { resinato: boolean; rilievo: boolean; protezione: string }): Ruolo {
	if (l.resinato) return 'resinati';
	if (l.rilievo) return 'uv';
	return l.protezione && l.protezione !== 'nessuna' ? 'laminati' : 'uv';
}

/** ultimo giorno utile per stampare, tenuto il margine del canale */
export function avviaEntro(l: LavoroStampa, cal: Calendar): string | null {
	if (!l.consegna) return null;
	const giorni = l.canale === 'manuale' ? MARGINE.manuale : MARGINE.sito;
	return shiftWorkDays(l.consegna, -giorni, cal);
}

/** giorni (di calendario) fra due giorni in formato 2026-09-24 */
export const giorniFra = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 864e5);

/**
 * I lavori diventano bobine: una per macchina e per tipo di laminazione.
 * `oggi` e' il giorno di lavoro corrente (2026-09-24).
 */
export function bobine(lavori: LavoroStampa[], oggi: string, cal: Calendar): Bobina[] {
	const map = new Map<string, Bobina>();
	for (const l of lavori) {
		const ruolo = ruoloDi(l);
		/* sulla UV si distinguono comunque rilievo e adesivi normali: sono due lavorazioni diverse */
		const chiave = ruolo === 'uv' ? (l.rilievo ? 'uv|rilievo' : 'uv|senza') : `${ruolo}|${l.protezione}`;
		let b = map.get(chiave);
		if (!b) {
			b = { id: chiave, ruolo, protezione: ruolo === 'uv' ? (l.rilievo ? 'rilievo' : 'nessuna') : l.protezione, lavori: [], mq: 0, minuti: 0, pezzi: 0, avviaEntro: null, attesaGiorni: 0, pronta: false, inCorso: false, motivo: '' };
			map.set(chiave, b);
		}
		b.lavori.push(l);
		b.mq += l.mq;
		b.minuti += l.minuti;
		b.pezzi += l.pezzi;
		const e = avviaEntro(l, cal);
		if (e && (!b.avviaEntro || e < b.avviaEntro)) b.avviaEntro = e;
		b.attesaGiorni = Math.max(b.attesaGiorni, Math.max(0, giorniFra(l.inCodaDal, oggi)));
		if (l.stato === 'in_corso') b.inCorso = true;
	}
	const out = [...map.values()];
	for (const b of out) {
		b.lavori.sort((x, y) => (avviaEntro(x, cal) ?? '9').localeCompare(avviaEntro(y, cal) ?? '9'));
		if (b.inCorso) { b.pronta = true; b.motivo = 'lavorazione già avviata'; continue; }
		if (b.avviaEntro && b.avviaEntro <= oggi) {
			b.pronta = true;
				b.motivo = b.avviaEntro < oggi ? 'in ritardo: va fatta subito' : 'ultimo giorno utile per la consegna';
			continue;
		}
		if (b.lavori.length > 1) { b.pronta = true; b.motivo = `${b.lavori.length} lavori con la stessa laminazione: una passata sola`; continue; }
		if (b.attesaGiorni >= ATTESA_MAX) { b.pronta = true; b.motivo = `aspetta da ${b.attesaGiorni} giorni: si fa da sola`; continue; }
		b.pronta = false;
		const restano = ATTESA_MAX - b.attesaGiorni;
		b.motivo = `lavoro solo: aspetto ancora ${restano} ${restano === 1 ? 'giorno' : 'giorni'} un altro con la stessa laminazione`;
	}
	/* prima quelle da fare, poi per scadenza */
	return out.sort((a, b) =>
		Number(b.pronta) - Number(a.pronta) || (a.avviaEntro ?? '9').localeCompare(b.avviaEntro ?? '9') || b.mq - a.mq
	);
}

/**
 * TAGLIO: i lavori si dividono fra i due plotter, tenendo il carico in pari (quello piu' scarico
 * prende il lavoro successivo). L'ordine di partenza e' quello dell'urgenza.
 */
export function suiPlotter<T extends { minuti: number }>(lavori: T[], plotter: number = 2): T[][] {
	const code: T[][] = Array.from({ length: plotter }, () => []);
	const carico = new Array(plotter).fill(0);
	for (const l of lavori) {
		let k = 0;
		for (let i = 1; i < plotter; i++) if (carico[i] < carico[k]) k = i;
		code[k].push(l);
		carico[k] += Math.max(1, l.minuti);
	}
	return code;
}

/**
 * LAMINAZIONE: una sola macchina, e ogni tipo di pellicola vuole il suo cambio bobina.
 * Quindi i lavori si mettono in fila per pellicola: prima quelli che scadono, e dentro la giornata
 * si fanno tutti quelli della stessa pellicola di seguito, cosi' la bobina si monta una volta sola.
 */
export interface PassataLaminazione extends Bobina {
	/** va montata una pellicola diversa da quella della passata prima */
	cambioBobina: boolean;
	ordine: number;
}
export function pianoLaminazione(lavori: LavoroStampa[], oggi: string, cal: Calendar): PassataLaminazione[] {
	const gruppi = bobine(lavori.map((l) => ({ ...l, resinato: false, rilievo: false })), oggi, cal);
	/* le passate pronte per prime (per scadenza), poi quelle che aspettano compagni */
	let prima = '';
	return gruppi.map((b, i) => {
		const cambio = b.protezione !== prima;
		prima = b.protezione;
		return { ...b, cambioBobina: cambio, ordine: i + 1 };
	});
}
