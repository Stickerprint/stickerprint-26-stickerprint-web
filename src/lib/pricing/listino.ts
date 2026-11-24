/**
 * LISTINO 2027 — regola unica dei prezzi, uguale per tutti i prodotti.
 *
 * E' la stessa regola del simulatore della dashboard (`/dashboard/preventivatori`): i numeri si
 * cambiano li', qui c'e' solo il calcolo. Il sito la usa attraverso `quoteWith` (engine.ts), quindi
 * pagina prodotto, carrello, checkout, riordino, bot e preventivi vedono lo stesso prezzo.
 *
 *   m²          = w·h / 1.000.000 × quantità            cm² = w·h / 100 × quantità
 *   sconto      = sconto volume in base ai m² totali (tabella, interpolata)
 *   materiale   = costo €/m² × m² × ricarico × (1 − sconto)      (idem stampa e lamina)
 *   resina      = €/kg ÷ 1000 × g/cm² × ricarico resina × cm²   (senza sconto volume)
 *   avvio       = avvio produzione in base alla quantità (tabella, interpolata)
 *   aumento     = (materiale + stampa + lamina + resina + avvio) × (k − 1)
 *                 k = (1 + aumento generale) × (1 + correttivo prodotto) × (1 + correttivo scaglione)
 *   lavoro      = quantità × secondi a pezzo × costo orario / 3600
 *                 + cm² × lavoro per cm² (resinati: minuti di un carrello pieno ÷ m² del carrello)
 *   netto       = tutto sommato;  lordo = netto × IVA arrotondato PER ECCESSO al passo (0,50 €)
 */

export type Tabella = [number, number][]; // [soglia, valore], interpolata sul logaritmo della soglia

export interface ListinoSpesa { nome: string; mese: number | string; on: boolean }
export interface ListinoComune {
	iva: number | string; // 22
	aumentoBase: number | string; // % su tutto
	fatturato: number | string; // serve solo a trasformare le spese mensili in %
	costoOrario: number | string; // €/ora del lavoro
	arrot: number | string; // passo dell'arrotondamento del lordo (0,5)
	express: number | string; // % produzione espressa (non usata dal sito, resta per i preventivi)
	spese: ListinoSpesa[];
	prevSoglia?: number | string;
	prevScontoSotto?: number | string;
	prevScontoSopra?: number | string;
	avvio: Tabella; // quantità → € di avvio
	ricarico: number | string; // moltiplicatore unico sui costi a m²
	vol: Tabella; // m² totali → % di sconto volume
	scagl: Tabella; // quantità → % di correttivo
}
export interface ListinoMateriale { id: string; nome: string; costo: number | string }
export interface ListinoFinitura { id: string; nome: string; tipo: 'm2' | 'resina'; costo?: number | string; kg?: number | string; g?: number | string; ric?: number | string }
export interface ListinoProdotto {
	id: string; // slug del prodotto (adesivi_personalizzati…)
	nome: string;
	mats: Record<string, number | boolean>;
	fins: Record<string, number | boolean>;
	stampa: number | string; // €/m²
	sec: number | string; // secondi di lavoro a pezzo
	minCarrello: number | string; // resinati: minuti per un carrello pieno
	m2Carrello: number | string; // resinati: m² di adesivi in un carrello pieno
	orario: number | string; // '' = costo orario generale
	corr: number | string; // % correttivo del prodotto
	qty: string; // quantità proposte al cliente, separate da virgola
}
export interface Listino { comune: ListinoComune; materiali: ListinoMateriale[]; finiture: ListinoFinitura[]; prodotti: ListinoProdotto[] }

/** Riga di `pricing_engines` che contiene il listino (una sola, per tutti i prodotti) */
export const LISTINO_SLUG = 'listino_2027';

/** Listino di partenza: la proposta 2027 studiata con Mattia (novembre 2026). */
export function listinoIniziale(): Listino {
	const tuttiM = { bianco: 1, super: 1, olografico: 1, glitterato: 1, trasparente: 1, argento: 1, oro: 1 };
	const P = (id: string, nome: string, o: Partial<ListinoProdotto> = {}): ListinoProdotto => ({
		id, nome, mats: { ...tuttiM }, fins: { nessuna: 1, opaca: 1, lucida: 1 }, stampa: 4, sec: 2.9, minCarrello: 0, m2Carrello: 0, orario: '', corr: 0,
		qty: '15, 50, 100, 200, 300, 500, 1000, 2000, 3000', ...o
	});
	return {
		comune: {
			iva: 22, aumentoBase: 5, fatturato: 182000, costoOrario: 25, arrot: 0.5, express: 30,
			spese: [{ nome: 'Esempio: leasing nuova macchina', mese: 400, on: false }, { nome: 'Esempio: nuovo dipendente', mese: 2200, on: false }],
			prevSoglia: 5000, prevScontoSotto: 0, prevScontoSopra: 10,
			avvio: [[15, 20], [50, 33], [100, 50]],
			ricarico: 4.7,
			vol: [[0.3, 0], [1, 5], [3, 13], [10, 24], [30, 30], [100, 36]],
			scagl: [[15, 0], [50, 0], [100, 0], [200, 0], [500, 0], [1000, 0], [5000, 0]]
		},
		materiali: [
			{ id: 'bianco', nome: 'Bianco', costo: 4 }, { id: 'super', nome: 'Bianco super adesivo', costo: 6.7 }, { id: 'trasparente', nome: 'Trasparente', costo: 4.3 },
			{ id: 'oro', nome: 'Oro', costo: 11.3 }, { id: 'argento', nome: 'Argento', costo: 13.9 }, { id: 'olografico', nome: 'Olografico', costo: 13.9 }, { id: 'glitterato', nome: 'Glitterato', costo: 14.5 }
		],
		finiture: [
			{ id: 'nessuna', nome: 'Nessuna', tipo: 'm2', costo: 0 }, { id: 'opaca', nome: 'Lamina opaca', tipo: 'm2', costo: 4 }, { id: 'lucida', nome: 'Lamina lucida', tipo: 'm2', costo: 4 },
			{ id: 'resina', nome: 'Resinatura', tipo: 'resina', kg: 10.9, g: 0.15, ric: 5.3 }
		],
		prodotti: [
			P('adesivi_personalizzati', 'Adesivi personalizzati', { qty: '15, 50, 100, 200, 300, 500, 1000, 2000, 3000, 5000' }),
			P('adesivi_resinati', 'Adesivi resinati', { fins: { resina: 1 }, sec: 0, minCarrello: 170, m2Carrello: 9.2, qty: '50, 100, 200, 300, 500, 1000, 2000, 3000, 5000' }),
			P('adesivi_rilievo', 'Adesivi in rilievo', { fins: { opaca: 1, lucida: 1 }, stampa: 8 }),
			P('etichette', 'Etichette in fogli'),
			P('fogli_adesivi', 'Fogli di adesivi'),
			P('vetrofanie', 'Vetrofanie', { mats: { trasparente: 1 }, fins: { nessuna: 1 } })
		]
	};
}

/** Un listino salvato e' valido se ha le quattro parti; i prodotti mancanti si prendono dall'iniziale. */
export function normalizzaListino(saved: unknown): Listino | null {
	const o = saved as Partial<Listino> | null;
	if (!o || typeof o !== 'object' || !o.comune || !Array.isArray(o.materiali) || !Array.isArray(o.finiture) || !Array.isArray(o.prodotti)) return null;
	const base = listinoIniziale();
	const L: Listino = JSON.parse(JSON.stringify(o));
	L.comune = { ...base.comune, ...L.comune, spese: Array.isArray(L.comune.spese) ? L.comune.spese : [] };
	for (const p of base.prodotti) {
		const got = L.prodotti.find((x) => x.id === p.id);
		if (!got) L.prodotti.push(p);
		else Object.assign(got, { ...p, ...got });
	}
	for (const m of base.materiali) if (!L.materiali.some((x) => x.id === m.id)) L.materiali.push(m);
	for (const f of base.finiture) if (!L.finiture.some((x) => x.id === f.id)) L.finiture.push(f);
	return L;
}

/* ===== calcolo (stesse formule del simulatore: un test le confronta riga per riga) ===== */

export const num = (v: unknown): number => {
	const n = parseFloat(String(v ?? '').replace(',', '.'));
	return isNaN(n) ? 0 : n;
};

export function interp(tab: Tabella | undefined, x: number): number {
	const t = (tab || []).filter((r) => num(r[0]) > 0).map((r) => [num(r[0]), num(r[1])] as [number, number]).sort((a, b) => a[0] - b[0]);
	if (!t.length) return 0;
	if (x <= t[0][0]) return t[0][1];
	for (let i = 0; i < t.length - 1; i++) {
		const a = t[i], b = t[i + 1];
		if (x <= b[0]) return a[1] + ((Math.log(x) - Math.log(a[0])) / (Math.log(b[0]) - Math.log(a[0]))) * (b[1] - a[1]);
	}
	return t[t.length - 1][1];
}

export const aumentoExtra = (L: Listino): number => {
	const c = L.comune, f = num(c.fatturato);
	return f > 0 ? ((c.spese || []).filter((s) => s.on).reduce((a, s) => a + num(s.mese), 0) * 12) / f * 100 : 0;
};
export const aumentoTot = (L: Listino): number => num(L.comune.aumentoBase) + aumentoExtra(L);
export const orario = (L: Listino, p: ListinoProdotto): number => { const o = num(p.orario); return o > 0 ? o : num(L.comune.costoOrario); };
export const costoPezzo = (L: Listino, p: ListinoProdotto): number => (num(p.sec) * orario(L, p)) / 3600;
export const secCm2 = (p: ListinoProdotto): number => (num(p.m2Carrello) > 0 ? (num(p.minCarrello) * 60) / (num(p.m2Carrello) * 10000) : 0);
export const costoCm2 = (L: Listino, p: ListinoProdotto): number => (secCm2(p) * orario(L, p)) / 3600;

export interface PrezzoIn { mat?: string; supCosto?: number; fin?: string; w: number; h: number; q: number }
export interface PrezzoOut {
	supporto: number; stampa: number; finitura: number; resina: number; fisso: number; aumento: number; pezzi: number;
	netto0: number; lordo: number; netto: number; k: number; m2: number; cm2: number; sconto: number; corrQ: number; costoVivo: number;
}

export function prezzo(L: Listino, p: ListinoProdotto, o: PrezzoIn): PrezzoOut {
	const c = L.comune, q = o.q, m2 = ((o.w * o.h) / 1e6) * q, cm2 = ((o.w * o.h) / 100) * q;
	const f = L.finiture.find((x) => x.id === o.fin);
	const sconto = interp(c.vol, m2) / 100;
	const fq = 1 - sconto, fs = num(c.ricarico);
	const sup = o.supCosto != null ? o.supCosto : num(L.materiali.find((m) => m.id === o.mat)?.costo);
	const finM2 = f && f.tipo !== 'resina' ? num(f.costo) : 0;
	const res = f && f.tipo === 'resina' ? f : null;
	const st = num(p.stampa);
	const supporto = sup * m2 * fs * fq, stampa = st * m2 * fs * fq, finitura = finM2 * m2 * fs * fq;
	const resina = res ? (num(res.kg) / 1000) * num(res.g) * num(res.ric) * cm2 : 0;
	const fisso = interp(c.avvio, q), base = supporto + stampa + finitura + resina + fisso;
	const corrQ = interp(c.scagl, q);
	const k = (1 + aumentoTot(L) / 100) * (1 + num(p.corr) / 100) * (1 + corrQ / 100), aumento = base * (k - 1);
	const pezzi = q * costoPezzo(L, p) + cm2 * costoCm2(L, p), netto0 = base + aumento + pezzi;
	const iva = 1 + num(c.iva) / 100, ar = num(c.arrot) || 0.01;
	const lordo = Math.round(Math.ceil((netto0 * iva) / ar - 1e-9) * ar * 100) / 100;
	return {
		supporto, stampa, finitura, resina, fisso, aumento, pezzi, netto0, lordo, netto: lordo / iva, k, m2, cm2, sconto, corrQ,
		costoVivo: (sup + st + finM2) * m2 + (res ? (num(res.kg) / 1000) * num(res.g) * cm2 : 0)
	};
}

/** Le finiture del sito (lamine e vernici UV) pagano la lamina del listino con lo stesso nome */
const FIN_SITO: Record<string, string> = { nessuna: 'nessuna', lucida: 'lucida', opaca: 'opaca', 'uv-opaca': 'opaca', 'uv-lucida': 'lucida' };

/**
 * Finitura del listino per una scelta del sito.
 * Prodotti resinati: sempre la resinatura. Gli altri: la lamina con lo stesso nome, solo se la finitura la prevede.
 */
export function finituraListino(L: Listino, p: ListinoProdotto, kind: 'lamina' | 'resina', finitura: string, laminate: boolean): string | undefined {
	if (kind === 'resina') return (L.finiture.find((f) => f.tipo === 'resina' && p.fins?.[f.id]) ?? L.finiture.find((f) => f.tipo === 'resina'))?.id;
	if (!laminate) return 'nessuna';
	return FIN_SITO[finitura] ?? 'lucida';
}

export const quantitaProdotto = (p: ListinoProdotto): number[] =>
	[...new Set(String(p.qty ?? '').split(/[,;\s]+/).map((v) => Math.round(Number(v))).filter((n) => n > 0))].sort((a, b) => a - b);

/**
 * Versione del listino che puo' arrivare al browser del cliente: stessi prezzi, ma SENZA i dati riservati
 * (fatturato, elenco delle spese, soglie dei preventivi) e con il solo prodotto della pagina.
 * L'aumento generale e' gia' sommato alle spese attive, quindi il risultato non cambia di un centesimo.
 */
export function listinoPubblico(L: Listino, slug: string): Listino {
	const c = L.comune, p = L.prodotti.find((x) => x.id === slug);
	return {
		comune: { iva: c.iva, aumentoBase: aumentoTot(L), fatturato: 0, costoOrario: c.costoOrario, arrot: c.arrot, express: c.express, spese: [], avvio: c.avvio, ricarico: c.ricarico, vol: c.vol, scagl: c.scagl },
		materiali: L.materiali.map((m) => ({ id: m.id, nome: m.nome, costo: m.costo })),
		finiture: L.finiture.map((f) => ({ ...f })),
		prodotti: p ? [{ ...p }] : []
	};
}

/** Controlli minimi prima di mettere online un listino: restituisce il primo problema trovato, o null. */
export function problemaListino(L: Listino): string | null {
	const c = L.comune;
	if (!(num(c.ricarico) > 0)) return 'Il ricarico deve essere maggiore di zero.';
	if (!(num(c.iva) >= 0 && num(c.iva) < 100)) return 'IVA non valida (es. 22).';
	if (!(num(c.arrot) > 0)) return "L'arrotondamento deve essere maggiore di zero (es. 0,5).";
	if (!(c.avvio || []).some((r) => num(r[0]) > 0)) return "Manca la tabella dell'avvio produzione.";
	if ((c.vol || []).some((r) => num(r[1]) >= 100 || num(r[1]) < 0)) return 'Lo sconto volume deve stare fra 0 e 99%.';
	for (const m of L.materiali) if (!(num(m.costo) > 0)) return `Il materiale "${m.nome}" non ha un costo.`;
	for (const p of L.prodotti) {
		if (!quantitaProdotto(p).length) return `"${p.nome}" non ha quantità.`;
		if (!(num(p.stampa) > 0)) return `"${p.nome}" non ha il costo di stampa.`;
		const r = prezzo(L, p, { mat: 'bianco', fin: 'nessuna', w: 50, h: 50, q: 100 });
		if (!(r.lordo > 0) || !isFinite(r.lordo)) return `Il prezzo di "${p.nome}" non si calcola: controlla i valori.`;
	}
	return null;
}
