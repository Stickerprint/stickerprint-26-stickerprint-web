import { env } from '$env/dynamic/private';

/**
 * Il ponte verso la dashboard di PERIZ Marketing (dashboard.perizmarketing.it).
 *
 * La sezione Marketing dell'area amministratore mostra i dati che l'agenzia
 * tiene nella sua dashboard (contenuti, calendario, budget, numeri di Meta):
 * il browser non parla mai con la dashboard, lo fa questo modulo dal server,
 * con una chiave legata al brand Stickerprint (PERIZ_API_KEY). La chiave vale
 * solo per il nostro brand: con lei non si legge niente di altri clienti.
 *
 * Tre regole prese dalla dashboard:
 *  - non si inventa mai un numero: se una cosa non arriva, si dice perché;
 *  - `ok:false` porta sempre un `errore` scritto per essere letto da una persona;
 *  - le risposte si tengono in memoria un minuto: un giro di domande a Meta
 *    dura qualche secondo, e rifarlo a ogni voce di menu si sente.
 */

export type RispostaOk<T> = { ok: true } & T;
export type RispostaErrore = { ok: false; errore: string };
export type Risposta<T> = RispostaOk<T> | RispostaErrore;

const VALIDITA_MS = 60 * 1000;
const memoria = new Map<string, { scade: number; valore: unknown }>();

function base(): string {
	return (env.PERIZ_API_URL || 'https://dashboard.perizmarketing.it').replace(/\/+$/, '');
}

/** Vero quando le variabili d'ambiente ci sono: senza, le pagine lo dicono invece di fallire. */
export function perizConfigurato(): boolean {
	return Boolean(env.PERIZ_API_KEY);
}

const NON_CONFIGURATO =
	'Collegamento con PERIZ Marketing non configurato: manca PERIZ_API_KEY nelle variabili d\'ambiente del sito (Vercel → Settings → Environment Variables). La chiave si crea dalla dashboard PERIZ, scheda Collegamenti del brand.';

async function chiama<T>(metodo: 'GET' | 'POST', percorso: string, corpo?: unknown): Promise<Risposta<T>> {
	if (!perizConfigurato()) return { ok: false, errore: NON_CONFIGURATO };
	let res: Response;
	try {
		res = await fetch(base() + percorso, {
			signal: AbortSignal.timeout(15000),
			method: metodo,
			headers: {
				Authorization: `Bearer ${env.PERIZ_API_KEY}`,
				...(corpo ? { 'Content-Type': 'application/json' } : {})
			},
			body: corpo ? JSON.stringify(corpo) : undefined
		});
	} catch (e) {
		return { ok: false, errore: `La dashboard PERIZ non risponde (${base()}): ${e instanceof Error ? e.message : 'rete'}` };
	}
	const body = (await res.json().catch(() => ({}))) as Partial<Risposta<T>>;
	if (!res.ok || !body.ok) {
		return { ok: false, errore: (body as RispostaErrore).errore || `La dashboard PERIZ ha risposto ${res.status}` };
	}
	return body as RispostaOk<T>;
}

/**
 * Lettura con memoria di un minuto. `fresco` salta la memoria (dopo un'azione,
 * per rileggere subito quello che è cambiato).
 */
export async function leggi<T>(percorso: string, opzioni: { fresco?: boolean } = {}): Promise<Risposta<T>> {
	const adesso = Date.now();
	const voce = memoria.get(percorso);
	if (!opzioni.fresco && voce && voce.scade > adesso) return voce.valore as Risposta<T>;
	const r = await chiama<T>('GET', percorso);
	if (r.ok) memoria.set(percorso, { scade: adesso + VALIDITA_MS, valore: r });
	return r;
}

/** Un'azione sulla dashboard (approvare, programmare, chiedere un appuntamento…). Svuota la memoria. */
export async function agisci<T = Record<string, unknown>>(cosa: string, azione: string, campi: Record<string, unknown> = {}): Promise<Risposta<T>> {
	const r = await chiama<T>('POST', '/api/partner', { cosa, azione, ...campi });
	if (r.ok) memoria.clear();
	return r;
}

/** Caricamento di un contenuto: le due fasi di /api/client-upload della dashboard. */
export async function caricamento<T = Record<string, unknown>>(campi: Record<string, unknown>): Promise<Risposta<T>> {
	const r = await chiama<T>('POST', '/api/client-upload', campi);
	if (r.ok && campi.fase === 'fine') memoria.clear();
	return r;
}

/* ------------------------------------------------------------- scorciatoie */
export const periz = {
	brand: () => leggi<import('$lib/marketing/tipi').RispostaBrand>('/api/partner?cosa=brand'),
	social: () => leggi<import('$lib/marketing/tipi').RispostaSocial>('/api/social-insights'),
	campagne: () => leggi<import('$lib/marketing/tipi').RispostaCampagne>('/api/campaign-insights'),
	contenuti: (fresco = false) => leggi<import('$lib/marketing/tipi').RispostaContenuti>('/api/partner?cosa=contenuti', { fresco }),
	attivita: (da: string, a: string) => leggi<import('$lib/marketing/tipi').RispostaAttivita>(`/api/partner?cosa=attivita&da=${da}&a=${a}`),
	appuntamenti: () => leggi<import('$lib/marketing/tipi').RispostaAppuntamenti>('/api/partner?cosa=appuntamenti'),
	budget: () => leggi<import('$lib/marketing/tipi').RispostaBudget>('/api/partner?cosa=budget'),
	notifiche: (limite = 50) => leggi<import('$lib/marketing/tipi').RispostaNotifiche>(`/api/partner?cosa=notifiche&limite=${limite}`),
	report: () => leggi<import('$lib/marketing/tipi').RispostaReport>('/api/partner?cosa=report')
};
