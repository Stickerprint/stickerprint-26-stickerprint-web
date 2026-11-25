/**
 * Costi e margini di un preventivo (Mattia, 25/11/2026): quanto ci costa il lavoro che stiamo quotando, fra materiale
 * e manodopera, a pezzo e in tutto, quanto ci si guadagna al prezzo scritto e a che prezzo conviene uscire.
 * Serve per i preventivi aziendali che vanno studiati: fino a dove possiamo spingerci.
 *
 * Non rifa' niente da capo:
 *  - i MATERIALI sono quelli dell'Analisi margini (`costoRiga`: bobina impaginata come nello Studio, inchiostro, lamina,
 *    resina, ai costi dei preventivatori);
 *  - la MANODOPERA e' quella del Preventivatore (listino 2027, `listino.ts`): secondi di lavoro a pezzo, per i resinati i
 *    minuti di un carrello pieno, e il costo orario (generale o del prodotto). Sono i numeri che Mattia tiene li':
 *    qui non si riscrivono, e il pannello non chiede il costo orario;
 *  - dalla produzione (`routeOrder`) si prendono solo le ATTESE (asciugatura, maturazione della resina);
 *  - il LISTINO del sito per la stessa riga fa da confronto: e' il prezzo pieno.
 * Le voci FUORI CATALOGO (un materiale che non vendiamo sul sito ma di cui sappiamo il costo) si scrivono a mano:
 * costo del materiale al metro quadro o a pezzo, minuti di lavoro, altri costi.
 * Regola dell'Analisi margini, valida anche qui: non si inventa mai un numero. Quello che manca si dice.
 */
import type { EngineConfig } from '$lib/pricing/engine';
import type { Calendar, Machine, MachineProfile } from '$lib/production/types';
import { routeOrder, routingInputFrom } from '$lib/production/routing';
import { costoCm2, costoPezzo, finituraListino, num as numL, orario as orarioListino, prezzo as prezzoListino, secCm2, type Listino } from '$lib/pricing/listino';
import { COSTO_SPEDIZIONE_NETTO, costoRiga, type StatoCosto } from './costi';

const r2 = (v: number) => Math.round(v * 100) / 100;
const r4 = (v: number) => Math.round(v * 10000) / 10000;
const num = (v: unknown) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const it2 = (v: number) => r2(v).toLocaleString('it-IT');

/* ------------------------------------------------------------------ cosa si salva col preventivo */

/** impostazioni del calcolo per una riga del preventivo (`item.costo`) */
export interface VoceCosto {
	/** 'auto' = prodotto a catalogo, calcolato da codice e descrizione; 'manuale' = voce fuori catalogo */
	modo?: 'auto' | 'manuale';
	/* catalogo: correzioni quando la descrizione non dice misura o materiale */
	w?: number | null; h?: number | null; materiale?: string | null;
	/* fuori catalogo */
	materialeNome?: string | null;
	/** costo del materiale al metro quadro (serve la misura); in alternativa `costoPezzo` */
	costoM2?: number | null;
	/** materiale che si butta fra margini, spazi e scarti, in percento (di solito 25) */
	sfrido?: number | null;
	/** costo del materiale per ogni pezzo, se lo si conosce gia' cosi' */
	costoPezzo?: number | null;
	/** la stampiamo noi: si aggiunge l'inchiostro al metro quadro */
	stampa?: boolean;
	/** minuti di lavoro di tutto il lavoro (fuori catalogo), oppure correzione del tempo calcolato (catalogo) */
	minuti?: number | null;
	/** altri costi del lavoro: lavorazione esterna, impianto, fustella, trasporto del materiale… */
	altri?: number | null;
	altriNota?: string | null;
}
/** impostazioni del calcolo per tutto il preventivo (`draft.costi`) */
export interface CostiBozza { /** margine a cui si vuole uscire, in percento sul prezzo */ margine?: number | null; /** il pannello mostra i prezzi al cliente IVA inclusa (true) o esclusa (false); null = come i prezzi della bozza */ iva?: boolean | null }
export const MARGINE_DEFAULT = 50;
export const SFRIDO_DEFAULT = 25;

export interface RigaBozza { code?: string | null; description?: string | null; qty: number | string; price: number | string; lamination?: string | null; costo?: VoceCosto | null }
export interface Contesto {
	engines: Record<string, EngineConfig>;
	/** descrizione dei codici prodotto (Setup → Codici prodotto), per leggere la misura quando la riga non la dice */
	codici: Record<string, string>;
	/** dal codice della riga al prodotto (`categoryOf`) */
	prodottoDi: (code: string) => string | null;
	machines: Machine[]; profiles: MachineProfile[]; calendar: Calendar;
}

/* ------------------------------------------------------------------ risultato */

export interface Fase { label: string; minuti: number; attesa: number; passiva: boolean; stimata: boolean }
export interface AnalisiRiga {
	i: number;
	tipo: 'prodotto' | 'manuale' | 'servizio';
	titolo: string;
	qty: number;
	stato: StatoCosto;
	/** quello che manca o che e' presunto, scritto per chi legge */
	note: string[];
	/** da cosa e' fatto il costo del materiale */
	materiali: { nome: string; valore: number }[];
	materiale: number;
	/** minuti di lavoro attivo e di attesa (asciugatura, maturazione della resina) */
	minuti: number; attesa: number; fasi: Fase[];
	/** null solo se il Preventivatore non si legge */
	manodopera: number | null;
	/** costo orario usato per questa riga (del prodotto, altrimenti quello generale) */
	orario: number | null;
	/** prezzo di listino del sito per questa riga, IVA esclusa (null fuori catalogo) */
	listino: number | null;
	altri: number;
	/** costo del lavoro finito con quello che si sa (la manodopera vale 0 se manca il costo orario) */
	costo: number; costoPezzo: number;
	/** quanto incassiamo al prezzo scritto nel preventivo, IVA esclusa */
	ricavo: number; prezzoPezzo: number;
	margine: number; marginePct: number | null;
	/** si puo' ragionare sui margini: c'e' un costo e non manca niente di essenziale */
	completo: boolean;
	/** dati letti dalla riga (catalogo), per mostrarli e correggerli */
	letto: { w: number; h: number; materiale: string; materialeLabel: string; lamina: string; pezziDaFare: number; bobinaM: number; resaPct: number } | null;
	/** i materiali fra cui scegliere per questo prodotto */
	materialiCatalogo: { id: string; label: string }[];
}
export interface Consiglio { nome: string; margine: number; prezzo: number; guadagno: number }
export interface AnalisiPreventivo {
	righe: AnalisiRiga[];
	materiale: number; manodopera: number | null; altri: number; spedizione: number;
	costo: number; ricavo: number; margine: number; marginePct: number | null;
	minuti: number; attesa: number;
	/** minuti di lavoro in una giornata (dal calendario di lavoro) */
	minutiGiorno: number;
	/** giornate di lavoro piene e giorni lavorativi prima che sia pronto (attese comprese) */
	giorniLavoro: number; giorniConsegna: number;
	/** costo orario generale del Preventivatore */
	orario: number | null; margineObiettivo: number;
	/** prezzo di listino del sito per tutto il lavoro, se tutte le righe sono a catalogo */
	listino: number | null;
	/** pezzi di tutti i lavori (senza i servizi): servono per il costo e il prezzo «cad.» */
	pezzi: number;
	/** tutte le righe hanno un costo: i totali sono affidabili */
	completo: boolean;
	avvisi: string[];
	consigli: Consiglio[];
}

/* ------------------------------------------------------------------ calcolo */

/** minuti di lavoro in una giornata: orario di apertura meno la pausa */
export function minutiGiorno(c: Calendar): number {
	const m = (t: string | null) => { if (!t) return null; const [h, mi] = t.split(':').map(Number); return h * 60 + (mi || 0); };
	const a = m(c.open_time) ?? 510, b = m(c.close_time) ?? 1050;
	const p0 = m(c.break_start), p1 = m(c.break_end);
	return Math.max(60, b - a - (p0 != null && p1 != null && p1 > p0 ? p1 - p0 : 0));
}
/** prezzo che lascia quel margine sul prezzo (margine 50% = il costo e' meta' del prezzo) */
export const prezzoPerMargine = (costo: number, marginePct: number) => (marginePct >= 100 ? Infinity : r2(costo / (1 - marginePct / 100)));
const pct = (margine: number, ricavo: number) => (ricavo > 0 ? Math.round((margine / ricavo) * 1000) / 10 : null);

/** il Preventivatore (listino 2027) agganciato ai listini dei prodotti */
const listinoDi = (cfg: EngineConfig | undefined): { L: Listino; slug: string } | null => cfg?.listino ?? null;
/** costo orario generale del Preventivatore: lo stesso in tutti i prodotti; null se il listino non si legge */
export function orarioGenerale(ctx: Contesto): number | null {
	for (const cfg of Object.values(ctx.engines)) { const l = listinoDi(cfg); if (l) { const o = numL(l.L.comune.costoOrario); return o > 0 ? o : null; } }
	return null;
}

/** una riga del preventivo */
export function analizzaRiga(it: RigaBozza, i: number, ctx: Contesto, lordi = false): AnalisiRiga {
	const v = it.costo ?? {};
	const qty = Math.max(0, Math.round(num(it.qty)));
	const prezzoPezzo = lordi ? num(it.price) / 1.22 : num(it.price);
	const ricavo = r2(prezzoPezzo * qty);
	const altri = r2(Math.max(0, num(v.altri)));
	const note: string[] = [];
	const titolo = (it.description ?? '').trim() || (it.code ?? '').trim() || `Riga ${i + 1}`;
	const slug = it.code ? ctx.prodottoDi(it.code) : null;
	const cfg = slug ? ctx.engines[slug === 'kit_adesivi' ? 'adesivi_personalizzati' : slug] : undefined;
	const materialiCatalogo = (cfg?.materials ?? []).map((m) => ({ id: m.id, label: m.label }));
	const generale = orarioGenerale(ctx);
	type Parte = Pick<AnalisiRiga, 'tipo' | 'stato' | 'materiali' | 'materiale' | 'minuti' | 'attesa' | 'fasi' | 'letto'> & { manodopera: number | null; orario: number | null; listino?: number | null };
	const fine = (o: Parte): AnalisiRiga => {
		const costo = r2(o.materiale + (o.manodopera ?? 0) + altri);
		const margine = r2(ricavo - costo);
		return { ...o, listino: o.listino ?? null, i, titolo, qty, altri, note, materialiCatalogo, costo, costoPezzo: qty > 0 ? r4(costo / qty) : 0, ricavo, prezzoPezzo: r4(prezzoPezzo), margine, marginePct: pct(margine, ricavo), completo: o.stato !== 'manca' && (o.tipo === 'servizio' || o.manodopera != null) };
	};
	const servizio = (): AnalisiRiga => fine({ tipo: 'servizio', stato: 'ok', materiali: [], materiale: 0, minuti: 0, attesa: 0, fasi: [], letto: null, manodopera: 0, orario: null });

	/* ---- voce fuori catalogo: tutto scritto a mano, al costo orario generale ---- */
	if (v.modo === 'manuale') {
		const w = num(v.w), h = num(v.h);
		const sfrido = v.sfrido == null || v.sfrido === ('' as never) ? SFRIDO_DEFAULT : Math.max(0, num(v.sfrido));
		const areaM2 = w > 0 && h > 0 ? (w * h * qty) / 1_000_000 : 0;
		const materiali: { nome: string; valore: number }[] = [];
		let stato: StatoCosto = 'ok';
		const nome = (v.materialeNome ?? '').trim() || 'Materiale';
		if (num(v.costoPezzo) > 0) materiali.push({ nome: `${nome} (a pezzo)`, valore: r2(num(v.costoPezzo) * qty) });
		else if (num(v.costoM2) > 0) {
			if (areaM2 > 0) materiali.push({ nome: `${nome} (${it2(areaM2 * (1 + sfrido / 100))} m² con il ${sfrido}% di sfrido)`, valore: r2(areaM2 * (1 + sfrido / 100) * num(v.costoM2)) });
			else { stato = 'manca'; note.push('Scrivi la misura del pezzo: serve per calcolare i metri quadri di materiale.'); }
		} else { stato = 'manca'; note.push('Scrivi quanto costa il materiale: al metro quadro oppure a pezzo.'); }
		if (v.stampa) {
			const ink = num(ctx.engines.adesivi_personalizzati?.print.costM2);
			if (areaM2 > 0) materiali.push({ nome: 'Stampa (inchiostro)', valore: r2(areaM2 * ink) });
			else if (stato !== 'manca') { stato = 'stima'; note.push('Senza la misura l’inchiostro della stampa non è contato.'); }
		}
		const minuti = Math.max(0, Math.round(num(v.minuti)));
		if (!minuti) { if (stato === 'ok') stato = 'stima'; note.push('Scrivi i minuti di lavoro: senza, la manodopera vale zero.'); }
		if (generale == null) note.push('Il costo orario del Preventivatore non si legge: la manodopera non è contata.');
		return fine({ tipo: 'manuale', stato, materiali, materiale: r2(materiali.reduce((s, m) => s + m.valore, 0)), minuti, attesa: 0, fasi: minuti ? [{ label: 'Lavoro (scritto a mano)', minuti, attesa: 0, passiva: false, stimata: false }] : [], letto: null, orario: generale, manodopera: generale == null ? null : r2((minuti / 60) * generale) });
	}

	/* ---- prodotto a catalogo ---- */
	const c = costoRiga({ product_slug: slug ?? '', product_code: it.code ?? null, description: it.description ?? null, lamination: it.lamination ?? null, width_mm: num(v.w) > 0 ? num(v.w) : null, height_mm: num(v.h) > 0 ? num(v.h) : null, materiale: v.materiale || null, qty: Math.max(1, qty), total_net: ricavo }, ctx.engines, it.code ? ctx.codici[it.code.trim().toUpperCase()] : null);
	if (c.tipo === 'servizio') return servizio();
	/* i motivi dell'Analisi margini rimandano a quella pagina: qui la misura si scrive nel pannello */
	if (c.motivo) note.push(/misura/i.test(c.motivo) && c.stato === 'manca' ? 'La descrizione non dice la misura: scrivi larghezza e altezza qui sotto, oppure aggiungila alla descrizione (es. 60×50 mm).' : c.motivo);
	if (c.stato === 'manca' || !c.lettura || !c.consumo) {
		if (!slug) { note.length = 0; note.push(it.code ? `Il codice «${it.code}» non è di un prodotto a catalogo: usa «Fuori catalogo» e scrivi i costi.` : 'Riga senza codice prodotto: scegli il codice, oppure usa «Fuori catalogo» e scrivi i costi.'); }
		return fine({ tipo: 'prodotto', stato: 'manca', materiali: [], materiale: 0, minuti: 0, attesa: 0, fasi: [], letto: null, manodopera: null, orario: generale });
	}
	const k = c.consumo, l = c.lettura;
	const materiali = [
		{ nome: `${k.vinileLabel} (${it2(k.bobinaMm / 1000)} m di bobina)`, valore: c.costi.vinile },
		{ nome: 'Stampa (inchiostro)', valore: c.costi.stampa },
		...(c.costi.lamina ? [{ nome: `Lamina ${k.laminaTipo ?? ''}`.trim(), valore: c.costi.lamina }] : []),
		...(c.costi.resina ? [{ nome: `Resina (${k.resinaG} g)`, valore: c.costi.resina }] : [])
	];
	let stato: StatoCosto = c.stato;
	/* manodopera e prezzo di listino: i numeri del Preventivatore per questo prodotto */
	const lis = listinoDi(cfg);
	const prod = lis?.L.prodotti.find((x) => x.id === lis.slug) ?? null;
	const cm2 = (l.w * l.h / 100) * qty;
	const fasi: Fase[] = [];
	let minuti = 0, manodopera: number | null = null, ora: number | null = generale, listino: number | null = null;
	if (lis && prod) {
		ora = orarioListino(lis.L, prod);
		const secPezzo = numL(prod.sec), secArea = secCm2(prod);
		if (secPezzo > 0) fasi.push({ label: `Lavoro a pezzo (${it2(secPezzo)} s l'uno)`, minuti: Math.round((qty * secPezzo) / 60), attesa: 0, passiva: false, stimata: false });
		if (secArea > 0) fasi.push({ label: `Resinatura (carrello da ${it2(numL(prod.m2Carrello))} m² in ${it2(numL(prod.minCarrello))} min)`, minuti: Math.round((cm2 * secArea) / 60), attesa: 0, passiva: false, stimata: false });
		minuti = Math.round((qty * secPezzo + cm2 * secArea) / 60);
		manodopera = r2(qty * costoPezzo(lis.L, prod) + cm2 * costoCm2(lis.L, prod));
		if (!secPezzo && !secArea) { stato = 'stima'; note.push('Nel Preventivatore questo prodotto non ha tempi di lavoro: la manodopera vale zero.'); }
		const fin = finituraListino(lis.L, prod, cfg!.kind === 'resina' ? 'resina' : 'lamina', l.lamina, k.laminaTipo != null);
		const pr = prezzoListino(lis.L, prod, { mat: l.materiale, fin, w: l.w, h: l.h, q: Math.max(1, qty) });
		listino = pr.netto > 0 ? r2(pr.netto) : null;
	} else { stato = 'stima'; note.push('Il Preventivatore non si legge per questo prodotto: la manodopera non è contata.'); }
	/* tempo scritto a mano: vale al posto di quello del Preventivatore, al costo orario del prodotto */
	if (num(v.minuti) > 0) {
		minuti = Math.round(num(v.minuti));
		fasi.length = 0; fasi.push({ label: 'Lavoro (tempo corretto a mano)', minuti, attesa: 0, passiva: false, stimata: false });
		manodopera = ora == null ? null : r2((minuti / 60) * ora);
	}
	/* attese (asciugatura, maturazione della resina): dalle lavorazioni della produzione */
	const r = routeOrder(routingInputFrom({ product_slug: c.listino, lamination: it.lamination ?? null, finitura: l.lamina, qty: k.pezziDaFare, width_mm: l.w, height_mm: l.h, materiale: l.materiale }), ctx.machines, ctx.profiles);
	for (const p of r.phases.filter((x) => x.passive && x.wait_minutes > 0)) fasi.push({ label: p.label, minuti: 0, attesa: p.wait_minutes, passiva: true, stimata: !p.estimated });
	return fine({
		tipo: 'prodotto', stato, materiali, materiale: c.costi.totale, minuti, attesa: fasi.reduce((s, f) => s + f.attesa, 0), fasi, manodopera, orario: ora, listino,
		letto: { w: l.w, h: l.h, materiale: l.materiale, materialeLabel: l.materialeLabel, lamina: l.lamina, pezziDaFare: k.pezziDaFare, bobinaM: r2(k.bobinaMm / 1000), resaPct: k.resaPct }
	});
}

/** tutto il preventivo */
export function analizzaPreventivo(d: { items: RigaBozza[]; price_type?: string; ship_method?: string | null; costi?: CostiBozza | null }, ctx: Contesto): AnalisiPreventivo {
	const orario = orarioGenerale(ctx);
	const margineObiettivo = d.costi?.margine == null ? MARGINE_DEFAULT : Math.min(95, Math.max(0, num(d.costi.margine)));
	const lordi = d.price_type === 'lordi';
	const righe = d.items.map((it, i) => ({ it, i })).filter(({ it }) => num(it.qty) > 0 && ((it.code ?? '').trim() || (it.description ?? '').trim())).map(({ it, i }) => analizzaRiga(it, i, ctx, lordi));
	const lavori = righe.filter((r) => r.tipo !== 'servizio');
	const materiale = r2(lavori.reduce((s, r) => s + r.materiale, 0));
	const manodopera = lavori.length && lavori.every((r) => r.manodopera == null) ? null : r2(lavori.reduce((s, r) => s + (r.manodopera ?? 0), 0));
	const altri = r2(righe.reduce((s, r) => s + r.altri, 0));
	/* il corriere e' un costo nostro quando spediamo noi (come nell'Analisi margini) */
	const spedizione = lavori.length && !/diretta|destinatario/i.test(d.ship_method ?? '') ? COSTO_SPEDIZIONE_NETTO : 0;
	const costo = r2(materiale + (manodopera ?? 0) + altri + spedizione);
	const ricavo = r2(righe.reduce((s, r) => s + r.ricavo, 0));
	const margine = r2(ricavo - costo);
	const minuti = lavori.reduce((s, r) => s + r.minuti, 0);
	const attesa = lavori.reduce((s, r) => Math.max(s, r.attesa), 0);
	const mg = minutiGiorno(ctx.calendar);
	const giorniLavoro = Math.round((minuti / mg) * 10) / 10;
	/* pronto in: le giornate di lavoro arrotondate in su, piu' le attese (la resina matura di notte: un giorno ogni 24 ore) */
	const giorniConsegna = lavori.length ? Math.max(1, Math.ceil(minuti / mg)) + Math.ceil(attesa / 1440) : 0;
	const completo = lavori.length > 0 && lavori.every((r) => r.completo);
	const avvisi: string[] = [];
	if (!lavori.length) avvisi.push('Aggiungi almeno una riga con codice, descrizione e quantità.');
	if (lavori.length && orario == null) avvisi.push('Il costo orario del Preventivatore non si legge: la manodopera non è nel conto e i margini sono più alti del vero.');
	const mancano = lavori.filter((r) => r.stato === 'manca').length;
	if (mancano) avvisi.push(`${mancano === 1 ? 'Una riga non ha' : `${mancano} righe non hanno`} ancora un costo: il totale non le conta.`);
	/* prezzo di listino del sito: solo se tutte le righe di prodotto sono a catalogo */
	const listino = lavori.length && lavori.every((r) => r.listino != null) ? r2(lavori.reduce((s, r) => s + (r.listino ?? 0), 0) + righe.filter((r) => r.tipo === 'servizio').reduce((s, r) => s + r.ricavo, 0)) : null;
	const livelli: [string, number][] = [['Pareggio', 0], ['Minimo', 30], ['Consigliato', margineObiettivo]];
	const consigli: Consiglio[] = costo > 0 ? livelli.map(([nome, m]) => { const prezzo = prezzoPerMargine(costo, m); return { nome, margine: m, prezzo, guadagno: r2(prezzo - costo) }; }) : [];
	if (costo > 0) {
		if (listino != null && listino > 0) consigli.push({ nome: 'Listino sito', margine: Math.round(((listino - costo) / listino) * 1000) / 10, prezzo: listino, guadagno: r2(listino - costo) });
		else { const m = Math.min(95, Math.max(margineObiettivo + 15, 70)); const prezzo = prezzoPerMargine(costo, m); consigli.push({ nome: 'Pieno', margine: m, prezzo, guadagno: r2(prezzo - costo) }); }
	}
	return { righe, materiale, manodopera, altri, spedizione, costo, ricavo, margine, marginePct: pct(margine, ricavo), minuti, attesa, minutiGiorno: mg, giorniLavoro, giorniConsegna, orario, margineObiettivo, listino, pezzi: lavori.reduce((s, r) => s + r.qty, 0), completo, avvisi, consigli };
}

/** il prezzo a pezzo che porta UNA riga al margine voluto (la spedizione e gli altri lavori restano fuori) */
export const prezzoPezzoPerMargine = (r: Pick<AnalisiRiga, 'costo' | 'qty'>, marginePct: number): number => (r.qty > 0 && r.costo > 0 ? r4(prezzoPerMargine(r.costo, marginePct) / r.qty) : 0);
