/** Analisi margini: come si scrivono numeri, superfici e lunghezze (sempre in italiano). */
const it = (v: number, dec = 0, max = dec) => v.toLocaleString('it-IT', { minimumFractionDigits: dec, maximumFractionDigits: max });

export const euro = (v: number) => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(v);
export const euro0 = (v: number) => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v);
export const perc = (v: number | null | undefined) => (v == null ? '—' : `${it(v, 0, 1)}%`);
export const mq = (v: number) => `${it(v, 0, v < 10 ? 2 : 1)} m²`;
/** millimetri di bobina in metri lineari (sotto il metro: centimetri) */
export const metri = (mm: number) => (mm < 1000 ? `${it(mm / 10, 0)} cm` : `${it(mm / 1000, 0, 2)} m`);
export const grammi = (g: number) => (g >= 1000 ? `${it(g / 1000, 0, 2)} kg` : `${it(g, 0)} g`);
export const pezzi = (n: number) => it(n, 0);
export const mm = (v: number) => (Number.isInteger(v) ? String(v) : it(v, 0, 1));

/** colore del margine: sotto il 20% male, sotto il 50% attenzione, sopra bene (sempre con il numero accanto) */
export const classeMargine = (p: number | null | undefined) => (p == null ? 'is-none' : p < 20 ? 'is-bad' : p < 50 ? 'is-mid' : 'is-good');

export const FONTE_LABEL: Record<string, string> = { ordine: 'dall’ordine', descrizione: 'letto dalla descrizione', codice: 'dal codice prodotto', presunto: 'presunto', manca: 'mancante' };
export const MODO_LABEL: Record<string, string> = { sciolti: 'pezzi sciolti sulla striscia', fogli: 'fogli sulla striscia', foglio_intero: 'fogli interi del cliente', kit: 'adesivi del kit + cavallotti', fuori_misura: 'più grande della striscia' };
