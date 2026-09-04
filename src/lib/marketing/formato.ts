/**
 * Formati e etichette della sezione Marketing. Riscritti qui apposta: la
 * dashboard PERIZ ha i suoi (src/lib/spDati.js), ma i due progetti non
 * condividono codice.
 */
import type { StatoContenuto, Piattaforma } from './tipi';

const GRUPPI: Intl.NumberFormatOptions = { useGrouping: 'always' };

/** Numero all'italiana; trattino quando non è arrivato. Mai uno zero al posto di un dato mancante. */
export function num(v: number | null | undefined): string {
	return typeof v === 'number' && Number.isFinite(v) ? v.toLocaleString('it-IT', GRUPPI) : '—';
}
export function numCorto(v: number | null | undefined): string {
	if (typeof v !== 'number' || !Number.isFinite(v)) return '—';
	if (Math.abs(v) >= 1_000_000) return (v / 1_000_000).toLocaleString('it-IT', { maximumFractionDigits: 1 }) + 'M';
	if (Math.abs(v) >= 1000) return (v / 1000).toLocaleString('it-IT', { maximumFractionDigits: 1 }) + 'K';
	return v.toLocaleString('it-IT');
}
export function euro(v: number | null | undefined, decimali = 0): string {
	if (typeof v !== 'number' || !Number.isFinite(v)) return '—';
	return v.toLocaleString('it-IT', { ...GRUPPI, minimumFractionDigits: decimali, maximumFractionDigits: decimali }) + ' €';
}
export function pct(v: number | null | undefined, tot: number | null | undefined): number {
	if (!tot || typeof v !== 'number') return 0;
	return Math.round((v / tot) * 100);
}
export function segno(v: number | null | undefined): string {
	if (typeof v !== 'number' || !Number.isFinite(v)) return '';
	return (v > 0 ? '+' : '') + v.toLocaleString('it-IT', { maximumFractionDigits: 1 }) + '%';
}

/* ---------------------------------------------------------------- date */
/** Sempre data LOCALE: `toISOString().slice(0,10)` in fuso italiano torna il giorno prima. */
export function isoData(d: Date): string {
	return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
export function piuGiorni(d: Date, n: number): Date {
	const x = new Date(d);
	x.setDate(x.getDate() + n);
	return x;
}
export function lunediDi(d: Date): Date {
	const x = new Date(d);
	x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
	x.setHours(0, 0, 0, 0);
	return x;
}
export function giornoCorto(d: Date): string {
	return d.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' }).replace('.', '');
}
export function giornoSettimana(d: Date): string {
	return d.toLocaleDateString('it-IT', { weekday: 'short' }).replace('.', '');
}
export function dataLunga(iso: string | null | undefined): string {
	if (!iso) return '—';
	return new Date(iso + 'T00:00:00').toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' });
}
export function dataBreve(iso: string | null | undefined): string {
	if (!iso) return '—';
	return new Date(iso.length === 10 ? iso + 'T00:00:00' : iso).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
export function ora(t: string | null | undefined): string {
	return t ? String(t).slice(0, 5) : '';
}
export function quandoRelativo(iso: string | null | undefined): string {
	if (!iso) return '';
	const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
	if (min < 1) return 'adesso';
	if (min < 60) return `${min} min fa`;
	const d = new Date(iso);
	const oggi = isoData(new Date());
	const ieri = isoData(piuGiorni(new Date(), -1));
	const g = isoData(d);
	const hhmm = d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
	if (g === oggi) return `Oggi, ${hhmm}`;
	if (g === ieri) return `Ieri, ${hhmm}`;
	return `${giornoCorto(d)}, ${hhmm}`;
}

/* ------------------------------------------------------------ etichette */
/** Etichette in italiano; i valori a DB restano in inglese/snake_case. */
export const STATO_CONTENUTO: Record<StatoContenuto, { label: string; classe: string }> = {
	in_attesa: { label: 'Da approvare', classe: 'mk-chip--pink' },
	modifiche_richieste: { label: 'Modifiche richieste', classe: 'mk-chip--orange' },
	approvato: { label: 'Da programmare', classe: 'mk-chip--orange' },
	programmato: { label: 'Programmato', classe: 'mk-chip--purple' },
	in_pubblicazione: { label: 'In pubblicazione', classe: 'mk-chip--blue' },
	pubblicato: { label: 'Pubblicato', classe: 'mk-chip--green' }
};
export function statoContenuto(s: string | null | undefined): { label: string; classe: string } {
	return (s && STATO_CONTENUTO[s as StatoContenuto]) || { label: s || '—', classe: 'mk-chip--gray' };
}

export const PIATTAFORME: { value: Piattaforma; label: string }[] = [
	{ value: 'instagram', label: 'Instagram' },
	{ value: 'tiktok', label: 'TikTok' },
	{ value: 'facebook', label: 'Facebook' }
];
export const PIATTAFORMA_LABEL: Record<string, string> = Object.fromEntries(PIATTAFORME.map((p) => [p.value, p.label]));

export const TIPO_ATTIVITA: Record<string, string> = {
	pubblicazione: 'Pubblicazione',
	riprese: 'Riprese',
	montaggio: 'Montaggio',
	analisi: 'Analisi',
	scadenza: 'Scadenza',
	altro: 'Altro'
};
export const STATO_ATTIVITA: Record<string, string> = {
	da_fare: 'Da fare',
	programmato: 'Programmato',
	in_revisione: 'In revisione',
	completato: 'Completato'
};
export const STATO_RICHIESTA: Record<string, { label: string; classe: string }> = {
	in_attesa: { label: 'In attesa di conferma', classe: 'mk-chip--orange' },
	confermata: { label: 'Confermata', classe: 'mk-chip--green' },
	rifiutata: { label: 'Da riprogrammare', classe: 'mk-chip--pink' }
};
export const OBIETTIVI: { value: string; label: string }[] = [
	{ value: 'traffico', label: 'Traffico al sito web' },
	{ value: 'conversioni', label: 'Conversioni' },
	{ value: 'engagement', label: 'Interazioni con il post' },
	{ value: 'notorieta', label: 'Notorietà del marchio' }
];

/** Divisione predefinita del budget fra le piattaforme scelte per un contenuto. */
export function splitPredefinito(piattaforme: string[] | null | undefined): Record<string, number> {
	const p = piattaforme?.length ? piattaforme : ['instagram'];
	const base = Math.floor(100 / p.length);
	const s: Record<string, number> = Object.fromEntries(p.map((x) => [x, base]));
	s[p[0]] += 100 - base * p.length;
	return s;
}

/* ------------------------------------------------------------- periodi */
export const PERIODI = [
	{ key: 'settimana', label: 'Questa settimana', giorni: 7 },
	{ key: '30', label: 'Ultimi 30 giorni', giorni: 30 },
	{ key: '90', label: 'Ultimi 90 giorni', giorni: 90 }
] as const;
export type PeriodoKey = (typeof PERIODI)[number]['key'];
export function intervalloPeriodo(key: string): { da: Date; a: Date } {
	if (key === 'settimana') {
		const da = lunediDi(new Date());
		return { da, a: piuGiorni(da, 6) };
	}
	const giorni = PERIODI.find((p) => p.key === key)?.giorni ?? 30;
	const a = new Date();
	return { da: piuGiorni(a, -(giorni - 1)), a };
}
export function etichettaPeriodo(key: string): string {
	const { da, a } = intervalloPeriodo(key);
	return `${giornoCorto(da)} – ${giornoCorto(a)} ${a.getFullYear()}`;
}
