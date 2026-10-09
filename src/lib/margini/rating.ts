/**
 * Analisi margini: rating del mese, come quelli delle agenzie (AAA … D).
 *
 * Il punteggio (0-100) viene da quattro voci, sempre scritte con i loro punti:
 *   - margine dopo la pubblicità, in % del fatturato con il costo calcolato   (50 punti: 0% → 0, 60% o più → 50)
 *   - rendimento della pubblicità: fatturato del sito per ogni euro speso     (20 punti: 1 € → 0, 6 € o più → 20)
 *   - andamento del margine rispetto al mese prima, in punti percentuali      (15 punti: −15 → 0, 0 → 7,5, +15 → 15)
 *   - andamento del fatturato al giorno rispetto al mese prima                (15 punti: −30% → 0, 0 → 7,5, +30% → 15)
 * Dove manca un dato (niente mese prima, pubblicità non leggibile) la voce vale meta' e lo si scrive.
 * Il margine guarda solo materiale, corriere e pubblicità: manodopera, imballo e commissioni non ci sono ancora.
 * Pura: la usano il server (rating salvato) e la pagina (anteprima quando il mese non ha ancora un rating).
 */

export interface Grado { lettera: string; min: number; giudizio: string; colore: string; sfondo: string }
/** dalla migliore alla peggiore: verdi, poi giallo, arancio, rossi */
export const SCALA: Grado[] = [
	{ lettera: 'AAA', min: 90, giudizio: 'Eccellente', colore: '#0b4d2c', sfondo: '#cdeedb' },
	{ lettera: 'AA', min: 80, giudizio: 'Molto solido', colore: '#11613a', sfondo: '#d8f3e3' },
	{ lettera: 'A', min: 70, giudizio: 'Solido', colore: '#1a7a47', sfondo: '#e3f6ea' },
	{ lettera: 'BBB', min: 60, giudizio: 'Adeguato', colore: '#55700f', sfondo: '#eef5d3' },
	{ lettera: 'BB', min: 50, giudizio: 'Da tenere d’occhio', colore: '#8a5a00', sfondo: '#fdf1c7' },
	{ lettera: 'B', min: 40, giudizio: 'Fragile', colore: '#b4470b', sfondo: '#ffe6d1' },
	{ lettera: 'CCC', min: 30, giudizio: 'A rischio', colore: '#b42318', sfondo: '#fde2df' },
	{ lettera: 'CC', min: 20, giudizio: 'Molto a rischio', colore: '#9a1c13', sfondo: '#fbd6d2' },
	{ lettera: 'C', min: 10, giudizio: 'Critico', colore: '#7a150e', sfondo: '#f8cbc6' },
	{ lettera: 'D', min: 0, giudizio: 'In perdita', colore: '#4a0b07', sfondo: '#f3bdb6' }
];
export const grado = (lettera: string) => SCALA.find((g) => g.lettera === lettera) ?? SCALA[SCALA.length - 1];
export const gradoDa = (punteggio: number) => SCALA.find((g) => punteggio >= g.min) ?? SCALA[SCALA.length - 1];

export interface InputRating {
	/** yyyy-mm */
	mese: string;
	giorniTrascorsi: number;
	giorniMese: number;
	ordini: number;
	ordiniSito: number;
	/** ordini senza misura (fuori dal margine) */
	daCompletare: number;
	fatturato: number;
	/** fatturato degli ordini con il costo calcolato: la base del margine */
	calcolato: number;
	/** materiale + corriere degli ordini calcolati */
	costoProduzione: number;
	/** spesa pubblicitaria del mese; null = non leggibile */
	ads: number | null;
	fatturatoSito: number;
	prima: { calcolato: number; fatturato: number; margineNettoPct: number | null; giorni: number } | null;
}

export interface Componente { id: 'margine' | 'pubblicita' | 'andamento_margine' | 'andamento_fatturato'; nome: string; punti: number; max: number; valore: string; nota: string | null }
export interface Rating {
	lettera: string;
	punteggio: number;
	giudizio: string;
	componenti: Componente[];
	affidabilita: 'alta' | 'media' | 'bassa';
	motivoAffidabilita: string;
	metriche: { margineNetto: number; margineNettoPct: number | null; roas: number | null; deltaMargine: number | null; deltaFatturatoPct: number | null; copertura: number | null };
}

const clamp = (v: number) => Math.max(0, Math.min(1, v));
const r1 = (v: number) => Math.round(v * 10) / 10;
const it = (v: number, d = 1) => v.toLocaleString('it-IT', { maximumFractionDigits: d, minimumFractionDigits: 0 });

export function calcolaRating(x: InputRating): Rating {
	const ads = x.ads ?? 0;
	const margineNetto = x.calcolato - x.costoProduzione - ads;
	const margineNettoPct = x.calcolato > 0 ? (margineNetto / x.calcolato) * 100 : null;
	const comp: Componente[] = [];

	/* 1. margine dopo la pubblicità */
	comp.push({
		id: 'margine', nome: 'Margine dopo la pubblicità', max: 50,
		punti: margineNettoPct == null ? 0 : r1(clamp(margineNettoPct / 60) * 50),
		valore: margineNettoPct == null ? 'nessun ordine calcolato' : `${it(margineNettoPct)}% del fatturato`,
		nota: x.ads == null ? 'pubblicità non leggibile: il margine è prima della pubblicità' : null
	});

	/* 2. rendimento della pubblicità */
	const roas = x.ads != null && x.ads > 0 ? x.fatturatoSito / x.ads : null;
	comp.push({
		id: 'pubblicita', nome: 'Rendimento della pubblicità', max: 20,
		punti: x.ads == null ? 10 : x.ads === 0 ? 20 : r1(clamp((roas! - 1) / 5) * 20),
		valore: x.ads == null ? 'spesa non leggibile' : x.ads === 0 ? 'nessuna spesa nel mese' : `${it(roas!, 2)} € di fatturato del sito per 1 € speso`,
		nota: x.ads == null ? 'vale metà finché la spesa non si legge' : null
	});

	/* 3. andamento del margine */
	const deltaMargine = margineNettoPct != null && x.prima?.margineNettoPct != null ? margineNettoPct - x.prima.margineNettoPct : null;
	comp.push({
		id: 'andamento_margine', nome: 'Margine rispetto al mese prima', max: 15,
		punti: deltaMargine == null ? 7.5 : r1(clamp((deltaMargine + 15) / 30) * 15),
		valore: deltaMargine == null ? 'nessun confronto' : `${deltaMargine >= 0 ? '+' : ''}${it(deltaMargine)} punti`,
		nota: deltaMargine == null ? 'mese prima senza dati: vale metà' : null
	});

	/* 4. andamento del fatturato (al giorno, così un mese a metà si confronta con uno intero) */
	const alGiorno = x.giorniTrascorsi > 0 ? x.fatturato / x.giorniTrascorsi : 0;
	const primaAlGiorno = x.prima && x.prima.giorni > 0 ? x.prima.fatturato / x.prima.giorni : 0;
	const deltaFatturatoPct = primaAlGiorno > 0 ? ((alGiorno - primaAlGiorno) / primaAlGiorno) * 100 : null;
	comp.push({
		id: 'andamento_fatturato', nome: 'Fatturato al giorno rispetto al mese prima', max: 15,
		punti: deltaFatturatoPct == null ? 7.5 : r1(clamp((deltaFatturatoPct + 30) / 60) * 15),
		valore: deltaFatturatoPct == null ? 'nessun confronto' : `${deltaFatturatoPct >= 0 ? '+' : ''}${it(deltaFatturatoPct, 0)}%`,
		nota: deltaFatturatoPct == null ? 'mese prima senza fatturato: vale metà' : null
	});

	const punteggio = r1(comp.reduce((s, c) => s + c.punti, 0));
	const g = gradoDa(punteggio);

	/* quanto fidarsi: copertura del fatturato col costo, numero di ordini, giorni passati */
	const copertura = x.fatturato > 0 ? x.calcolato / x.fatturato : null;
	const motivi: string[] = [];
	if (copertura != null && copertura < 0.9) motivi.push(`${it((1 - copertura) * 100, 0)}% del fatturato senza costo (ordini da completare)`);
	if (x.ordini < 10) motivi.push(`solo ${x.ordini} ${x.ordini === 1 ? 'ordine' : 'ordini'}`);
	if (x.giorniTrascorsi < x.giorniMese) motivi.push(`mese in corso: ${x.giorniTrascorsi} giorni su ${x.giorniMese}`);
	if (x.ads == null) motivi.push('pubblicità non leggibile');
	const bassa = (copertura != null && copertura < 0.6) || x.ordini < 3 || x.giorniTrascorsi < 7;
	const affidabilita = bassa ? 'bassa' : motivi.length ? 'media' : 'alta';

	return {
		lettera: g.lettera, punteggio, giudizio: g.giudizio, componenti: comp, affidabilita,
		motivoAffidabilita: motivi.length ? motivi.join(' · ') : 'mese chiuso, costi calcolati su quasi tutto il fatturato',
		metriche: { margineNetto: Math.round(margineNetto * 100) / 100, margineNettoPct: margineNettoPct == null ? null : r1(margineNettoPct), roas: roas == null ? null : Math.round(roas * 100) / 100, deltaMargine: deltaMargine == null ? null : r1(deltaMargine), deltaFatturatoPct: deltaFatturatoPct == null ? null : r1(deltaFatturatoPct), copertura: copertura == null ? null : Math.round(copertura * 1000) / 1000 }
	};
}

/** commento scritto dalle regole: quando l'assistente non c'e' o non risponde */
export function commentoRegole(r: Rating, x: InputRating): { pro: string[]; contro: string[]; considerazioni: string } {
	const pro: string[] = [], contro: string[] = [];
	for (const c of r.componenti) {
		const q = c.punti / c.max;
		if (c.nota) continue;
		if (q >= 0.7) pro.push(`${c.nome}: ${c.valore} (${it(c.punti)} punti su ${c.max}).`);
		else if (q < 0.4) contro.push(`${c.nome}: ${c.valore} (${it(c.punti)} punti su ${c.max}).`);
	}
	if (x.daCompletare) contro.push(`${x.daCompletare} ${x.daCompletare === 1 ? 'ordine è' : 'ordini sono'} senza misura e ${x.daCompletare === 1 ? 'resta' : 'restano'} fuori dal margine.`);
	if (!pro.length) pro.push('Nessuna voce del punteggio sopra il 70% dei punti.');
	if (!contro.length) contro.push('Nessuna voce del punteggio sotto il 40% dei punti.');
	const considerazioni = `Rating ${r.lettera} (${r.giudizio.toLowerCase()}), ${it(r.punteggio)} punti su 100. Affidabilità ${r.affidabilita}: ${r.motivoAffidabilita}. Il margine considera materiale, corriere e pubblicità; manodopera, imballo e commissioni di pagamento non sono ancora conteggiati.`;
	return { pro, contro, considerazioni };
}
