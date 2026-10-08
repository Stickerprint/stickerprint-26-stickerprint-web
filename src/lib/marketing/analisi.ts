/**
 * Le regole dei consigli. Nessuna chiamata di rete: prende i numeri dei canali e gli obiettivi
 * e restituisce, per ogni campagna, un verdetto con il motivo e un budget proposto; per ogni canale
 * e per tutto l'insieme, un'idea di budget. Il testo discorsivo lo scrive poi l'assistente
 * (src/lib/server/ads/consigli.ts) partendo da questi verdetti, mai dal nulla.
 *
 * Verdetti:
 *  - scala     rende sopra l'obiettivo con abbastanza ordini: alzare il budget
 *  - continua  rende intorno all'obiettivo: lasciarla com'è
 *  - osserva   pochi dati o un po' sotto: nessuna mossa, ricontrollare
 *  - spegni    spende senza rendere: mettere in pausa
 *  - ferma     è già in pausa (si dice solo se andava bene e vale la pena riattivarla)
 */
import { CANALI, NOME_BREVE, cpa, roas, sommaRisultati, type Campagna, type Canale, type CanaleDati, type Obiettivi, type Risultati } from './ads-tipi';

export type Verdetto = 'scala' | 'continua' | 'osserva' | 'spegni' | 'ferma';
export const VERDETTO: Record<Verdetto, { etichetta: string; chip: string }> = {
	scala: { etichetta: 'Da spingere', chip: 'mk-chip--green' },
	continua: { etichetta: 'Da continuare', chip: 'mk-chip--blue' },
	osserva: { etichetta: 'Da osservare', chip: 'mk-chip--orange' },
	spegni: { etichetta: 'Da spegnere', chip: 'mk-chip--pink' },
	ferma: { etichetta: 'In pausa', chip: 'mk-chip--gray' }
};

export interface Giudizio {
	canale: Canale; id: string; nome: string; stato: Campagna['stato'];
	verdetto: Verdetto; motivo: string;
	/** quanto rende rispetto all'obiettivo: 1 = esattamente l'obiettivo */
	punteggio: number | null;
	spesa: number; conversioni: number; valore: number | null; valoreStimato: boolean;
	roas: number | null; cpa: number | null;
	budgetGiorno: number | null; budgetProposto: number | null;
}
export interface BudgetCanale { canale: Canale; spesaPeriodo: number; spesaGiorno: number; budgetGiorno: number; propostoGiorno: number; propostoMese: number; quota: number | null; motivo: string }
export interface AnalisiCanale {
	canale: Canale; periodo: { da: string; a: string }; kpi: Risultati & { roas: number | null; cpa: number | null; valoreStimato: boolean };
	prima: (Risultati & { roas: number | null; cpa: number | null }) | null;
	giudizi: Giudizio[]; migliori: Giudizio[]; daSpegnere: Giudizio[]; daContinuare: Giudizio[]; daOsservare: Giudizio[];
	budget: BudgetCanale;
}
export interface AnalisiTotale {
	periodo: { da: string; a: string } | null;
	kpi: Risultati & { roas: number | null; cpa: number | null };
	canali: AnalisiCanale[];
	migliori: Giudizio[]; daSpegnere: Giudizio[]; daContinuare: Giudizio[];
	budget: { righe: BudgetCanale[]; totaleGiorno: number; totaleMese: number; tetto: number | null; motivo: string };
}

const r2 = (v: number) => Math.round(v * 100) / 100;
/** Campagne che puntano agli ordini (vendite/conversioni): si giudicano sul ritorno. Le altre (visite al profilo, traffico, interazioni, notorietà) sul costo per clic. */
export const obiettivoVendita = (obiettivo: string) => /sales|vendit|conversion|purchase|acquist|catalog|app promotion/i.test(obiettivo);
const r1 = (v: number) => Math.round(v);
export const cpaObiettivo = (o: Obiettivi) => (o.cpaTarget && o.cpaTarget > 0 ? o.cpaTarget : o.valoreOrdine / Math.max(0.1, o.roasTarget));

/** Il valore misurato dal canale, oppure una stima (ordini × valore medio) quando il canale non lo riporta. */
function valoreDi(c: { conversioni: number; valore: number | null }, o: Obiettivi): { valore: number | null; stimato: boolean } {
	if (c.valore != null && c.valore > 0) return { valore: c.valore, stimato: false };
	if (c.conversioni > 0) return { valore: c.conversioni * o.valoreOrdine, stimato: true };
	return { valore: c.valore ?? null, stimato: false };
}

export function giudica(c: Campagna, o: Obiettivi, giorni: number): Giudizio {
	const { valore, stimato } = valoreDi(c, o);
	const ritorno = c.spesa > 0 && valore != null ? valore / c.spesa : null;
	const costo = c.conversioni > 0 ? c.spesa / c.conversioni : null;
	const cpaMax = cpaObiettivo(o);
	const punteggio = ritorno != null ? ritorno / o.roasTarget : null;
	const base = { canale: c.canale, id: c.id, nome: c.nome, stato: c.stato, punteggio, spesa: c.spesa, conversioni: c.conversioni, valore, valoreStimato: stimato, roas: ritorno, cpa: costo, budgetGiorno: c.budgetGiorno };
	const eur = (v: number) => v.toLocaleString('it-IT', { maximumFractionDigits: 0 }) + ' €';
	const ordini = (n: number) => `${n.toLocaleString('it-IT', { maximumFractionDigits: 0 })} ${n === 1 ? 'ordine' : 'ordini'}`;

	if (c.stato === 'attiva' && c.spesa === 0 && c.conversioni === 0) {
		return { ...base, verdetto: 'ferma', budgetProposto: null, motivo: 'Risulta attiva ma non ha speso nulla nel periodo (budget finito o pubblicazione conclusa): non pesa sui conti.' };
	}
	if (c.stato !== 'attiva') {
		const bene = punteggio != null && punteggio >= 0.8 && c.conversioni >= 2;
		return { ...base, verdetto: 'ferma', budgetProposto: null, motivo: bene ? `È in pausa ma quando girava rendeva ${ritorno!.toFixed(1)}× (${ordini(c.conversioni)} con ${eur(c.spesa)}): vale la pena riattivarla.` : c.spesa > 0 ? `In pausa: ha speso ${eur(c.spesa)} nel periodo${c.conversioni ? ` per ${ordini(c.conversioni)}` : ' senza ordini'}.` : 'In pausa, non ha speso nel periodo.' };
	}
	const pocaSpesa = Math.max(20, cpaMax * 1.5);
	if (c.spesa < pocaSpesa) {
		return { ...base, verdetto: 'osserva', budgetProposto: c.budgetGiorno, motivo: `Ha speso solo ${eur(c.spesa)} in ${giorni} giorni: troppo poco per giudicarla. Lasciala girare e ricontrolla tra una settimana.` };
	}
	if (!obiettivoVendita(c.obiettivo)) {
		/* visibilità: niente verdetto sugli ordini; si guarda quanto costa un clic e si segnala se per caso porta anche vendite */
		const cpcV = c.clic ? c.spesa / c.clic : null;
		const extra = c.conversioni ? ` Ha portato anche ${ordini(c.conversioni)}${ritorno != null ? ` (ritorno ${ritorno.toFixed(1)}×)` : ''}.` : '';
		if (cpcV == null || cpcV > 0.6) return { ...base, verdetto: 'osserva', budgetProposto: c.budgetGiorno, motivo: `Campagna di visibilità (${c.obiettivo}): ${eur(c.spesa)} spesi per ${c.clic.toLocaleString('it-IT')} clic${cpcV != null ? `, ${cpcV.toFixed(2).replace('.', ',')} € l'uno` : ''}: caro per questo tipo di campagna. Controlla pubblico e creatività.${extra}` };
		return { ...base, verdetto: 'continua', budgetProposto: c.budgetGiorno, motivo: `Campagna di visibilità (${c.obiettivo}): va giudicata su clic e follower, non sugli ordini. ${eur(c.spesa)} per ${c.clic.toLocaleString('it-IT')} clic a ${cpcV.toFixed(2).replace('.', ',')} € l'uno, un buon prezzo.${extra}` };
	}
	if (c.conversioni === 0) {
		if (c.spesa >= cpaMax * 3) return { ...base, verdetto: 'spegni', budgetProposto: 0, motivo: `${eur(c.spesa)} spesi senza nemmeno un ordine (con ${eur(cpaMax)} a ordine ne sarebbero dovuti arrivare almeno ${Math.floor(c.spesa / cpaMax)}). Mettila in pausa o rifalla da capo.` };
		return { ...base, verdetto: 'osserva', budgetProposto: c.budgetGiorno, motivo: `${eur(c.spesa)} spesi e ancora nessun ordine: ancora un po' di margine, ma se non arriva niente va spenta.` };
	}
	if (punteggio != null && punteggio >= 1.25 && c.conversioni >= 3) {
		const proposto = c.budgetGiorno != null ? r1(c.budgetGiorno * 1.25) : null;
		return { ...base, verdetto: 'scala', budgetProposto: proposto, motivo: `Rende ${ritorno!.toFixed(1)}× (obiettivo ${o.roasTarget}×), ${ordini(c.conversioni)} a ${eur(costo!)} l'uno${stimato ? ', valore stimato' : ''}. ${proposto != null ? `Alza il budget a ${eur(proposto)} al giorno (+25%).` : 'Alza il budget del 25%.'}` };
	}
	if (punteggio != null && punteggio >= 0.8) {
		return { ...base, verdetto: 'continua', budgetProposto: c.budgetGiorno, motivo: `Rende ${ritorno!.toFixed(1)}× con ${ordini(c.conversioni)} a ${eur(costo!)} l'uno${stimato ? ' (valore stimato)' : ''}: in linea con l'obiettivo, lasciala com'è.` };
	}
	if (punteggio != null && punteggio >= 0.5) {
		const proposto = c.budgetGiorno != null ? r1(c.budgetGiorno * 0.8) : null;
		return { ...base, verdetto: 'osserva', budgetProposto: proposto, motivo: `Sotto l'obiettivo: rende ${ritorno!.toFixed(1)}× e ogni ordine costa ${eur(costo!)} (massimo ${eur(cpaMax)}). Prova a cambiare creatività o pubblico${proposto != null ? ` e abbassa il budget a ${eur(proposto)} al giorno` : ''}; se non migliora, spegnila.` };
	}
	return { ...base, verdetto: 'spegni', budgetProposto: 0, motivo: `Rende ${ritorno!.toFixed(1)}× e ogni ordine costa ${eur(costo!)} contro un massimo di ${eur(cpaMax)}: sta perdendo soldi. Mettila in pausa.` };
}

const ORDINE: Record<Verdetto, number> = { scala: 0, continua: 1, osserva: 2, spegni: 3, ferma: 4 };
const perPunteggio = (a: Giudizio, b: Giudizio) => (b.punteggio ?? -1) - (a.punteggio ?? -1) || b.spesa - a.spesa;

function conRitorno(r: Risultati, o: Obiettivi) {
	const v = valoreDi(r, o);
	const x = { ...r, valore: v.valore };
	return { ...x, roas: roas(x), cpa: cpa(x), valoreStimato: v.stimato };
}

export function analizzaCanale(d: CanaleDati, o: Obiettivi): AnalisiCanale {
	const giorni = Math.max(1, Math.round((Date.parse(d.periodo.a) - Date.parse(d.periodo.da)) / 86_400_000) + 1);
	const giudizi = d.campagne.map((c) => giudica(c, o, giorni)).sort((a, b) => ORDINE[a.verdetto] - ORDINE[b.verdetto] || perPunteggio(a, b));
	const attive = giudizi.filter((g) => g.stato === 'attiva');
	const budgetGiorno = r2(attive.reduce((s, g) => s + (g.budgetGiorno ?? 0), 0));
	const spesaGiorno = r2(d.kpi.spesa / giorni);
	/* dove le campagne non hanno un budget giornaliero (budget sui gruppi) si parte dalla spesa reale al giorno */
	const propostoGiorno = r2(attive.reduce((s, g) => s + (g.budgetProposto ?? (g.budgetGiorno == null ? (g.verdetto === 'spegni' ? 0 : g.spesa / giorni * (g.verdetto === 'scala' ? 1.25 : 1)) : g.budgetGiorno)), 0));
	const quota = o.quote[d.canale] ?? null;
	const propostoMese = r1(propostoGiorno * 30.4);
	const nScala = attive.filter((g) => g.verdetto === 'scala').length, nSpegni = attive.filter((g) => g.verdetto === 'spegni').length;
	let motivo = '';
	if (!attive.length) motivo = 'Nessuna campagna attiva: niente da spendere finché non ne parte una.';
	else if (nScala && !nSpegni) motivo = `${nScala} ${nScala === 1 ? 'campagna rende' : 'campagne rendono'} sopra l'obiettivo: si può salire a circa ${propostoMese.toLocaleString('it-IT')} € al mese.`;
	else if (nSpegni && !nScala) motivo = `${nSpegni} ${nSpegni === 1 ? 'campagna spende' : 'campagne spendono'} senza rendere: spegnendole si scende a circa ${propostoMese.toLocaleString('it-IT')} € al mese senza perdere ordini.`;
	else if (nSpegni && nScala) motivo = `Sposta i soldi: spegni ${nSpegni} e spingi ${nScala}; il totale resta intorno a ${propostoMese.toLocaleString('it-IT')} € al mese.`;
	else motivo = `Tutto in linea: tieni il ritmo di circa ${propostoMese.toLocaleString('it-IT')} € al mese.`;
	if (quota != null && propostoMese > quota) motivo += ` Attenzione: supera la quota decisa di ${quota.toLocaleString('it-IT')} €.`;
	return {
		canale: d.canale, periodo: d.periodo,
		kpi: conRitorno(d.kpi, o), prima: d.prima ? conRitorno(d.prima, o) : null,
		giudizi,
		migliori: giudizi.filter((g) => g.stato === 'attiva' && g.conversioni > 0).sort(perPunteggio).slice(0, 3),
		daSpegnere: giudizi.filter((g) => g.verdetto === 'spegni'),
		daContinuare: giudizi.filter((g) => g.verdetto === 'continua' || g.verdetto === 'scala'),
		daOsservare: giudizi.filter((g) => g.verdetto === 'osserva'),
		budget: { canale: d.canale, spesaPeriodo: r2(d.kpi.spesa), spesaGiorno, budgetGiorno, propostoGiorno, propostoMese, quota, motivo }
	};
}

/** Tutti i canali insieme: classifica unica delle campagne e divisione del budget tra i canali. */
export function analizzaTutto(canali: AnalisiCanale[], o: Obiettivi): AnalisiTotale {
	const tuttiGiudizi = canali.flatMap((c) => c.giudizi);
	const kpiBase = sommaRisultati(canali.map((c) => c.kpi));
	const kpi = { ...kpiBase, roas: roas(kpiBase), cpa: cpa(kpiBase) };
	const righe = canali.map((c) => ({ ...c.budget }));
	const totaleProposto = r2(righe.reduce((s, r) => s + r.propostoGiorno, 0));
	let motivo = '';
	const tetto = o.budgetMese;
	if (tetto != null && tetto > 0 && canali.length) {
		/* c'è un tetto: lo si divide tra i canali in proporzione a quanto rendono (ritorno × spesa), con un minimo del 10% a chi gira */
		const pesi = canali.map((c) => Math.max(0.1, (c.kpi.roas ?? 0.5) * Math.max(1, c.kpi.spesa)));
		const somma = pesi.reduce((s, p) => s + p, 0) || 1;
		for (let i = 0; i < righe.length; i++) {
			const q = Math.max(tetto * 0.1, (tetto * pesi[i]) / somma);
			righe[i].propostoMese = r1(q); righe[i].propostoGiorno = r2(q / 30.4);
		}
		/* riporta la somma esattamente al tetto */
		const sommaQ = righe.reduce((s, r) => s + r.propostoMese, 0);
		if (sommaQ !== tetto && righe.length) { righe[0].propostoMese = r1(righe[0].propostoMese + (tetto - sommaQ)); righe[0].propostoGiorno = r2(righe[0].propostoMese / 30.4); }
		const migliore = [...canali].sort((a, b) => (b.kpi.roas ?? 0) - (a.kpi.roas ?? 0))[0];
		motivo = `Tetto di ${tetto.toLocaleString('it-IT')} € al mese diviso in base al ritorno di ogni canale${migliore?.kpi.roas != null ? `: ${NOME_BREVE[migliore.canale]} rende di più (${migliore.kpi.roas.toFixed(1)}×) e prende la fetta più grande` : ''}.`;
	} else {
		motivo = canali.length ? `Senza un tetto fissato, il budget consigliato è la somma di quello che conviene a ogni canale: circa ${r1(totaleProposto * 30.4).toLocaleString('it-IT')} € al mese. Il tetto si imposta in Marketing → Impostazioni.` : 'Nessun canale collegato.';
	}
	const totaleGiorno = r2(righe.reduce((s, r) => s + r.propostoGiorno, 0));
	const periodo = canali[0]?.periodo ?? null;
	return {
		periodo, kpi, canali,
		migliori: tuttiGiudizi.filter((g) => g.stato === 'attiva' && g.conversioni > 0).sort(perPunteggio).slice(0, 5),
		daSpegnere: tuttiGiudizi.filter((g) => g.verdetto === 'spegni'),
		daContinuare: tuttiGiudizi.filter((g) => g.verdetto === 'continua' || g.verdetto === 'scala').sort(perPunteggio),
		budget: { righe, totaleGiorno, totaleMese: r1(righe.reduce((s, r) => s + r.propostoMese, 0)), tetto: tetto ?? null, motivo }
	};
}

export const canaliOrdinati = (xs: AnalisiCanale[]) => [...xs].sort((a, b) => CANALI.indexOf(a.canale) - CANALI.indexOf(b.canale));
