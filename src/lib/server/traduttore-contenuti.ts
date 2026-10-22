/**
 * Traduzione automatica dei contenuti del database (FAQ, categorie, articoli del blog, offerte) nelle cinque lingue
 * del sito, con la Claude API (la stessa chiave della posta). Scrive nella colonna `tr` di ogni riga insieme
 * all'impronta dell'italiano: quando Mattia cambia il testo, al giro dopo la riga viene ritradotta.
 * Gira ogni giorno (/api/cron/traduzioni), a richiesta dal bottone "Traduci ora" in dashboard e SUBITO dopo ogni salvataggio
 * in dashboard (traduciDopoSalvataggio, Mattia 22/10/2026: "tradotte tutte in automatico non appena vengono inserite"), a lotti brevi.
 * Le lingue sono quelle di LOCALES (LINGUE_ESTERE): una lingua nuova viene tradotta da sola al giro dopo.
 */
import Anthropic from '@anthropic-ai/sdk';
import { waitUntil } from '@vercel/functions';
import type { SupabaseClient } from '@supabase/supabase-js';
import { env } from '$env/dynamic/private';
import { impronta, LINGUE_ESTERE } from './contenuti-tradotti';
import { slugify } from '$lib/blog';

const MODELLO = () => env.POSTA_MODEL || 'claude-sonnet-5-5';
export const traduttoreAttivo = () => Boolean(env.ANTHROPIC_API_KEY);

/* nomi delle lingue per le istruzioni: quelle note per esteso, le altre dal nome ISO */
const NOME_LINGUA: Record<string, string> = { en: 'inglese americano (en)', es: 'spagnolo di Spagna (es)', fr: 'francese (fr)', de: 'tedesco (de)', nl: 'olandese (nl)' };
const nomeLingua = (l: string) => NOME_LINGUA[l] ?? `${new Intl.DisplayNames(['it'], { type: 'language' }).of(l) ?? l} (${l})`;
const SISTEMA = `Sei il traduttore di Stickerprint, stampa online di adesivi personalizzati (Italia). Traduci i testi dall'italiano in ${LINGUE_ESTERE.map(nomeLingua).join(', ')}.
Tono: naturale, da negozio online, mai letterale; en "you", es tu, fr vous, de du, nl je, nelle altre lingue il tu informale da negozio online. Mantieni esattamente tag HTML, link, emoji, segnaposto fra graffe come {soglia} e {campioni}, numeri e misure (mm restano mm), nomi di marca (Stickerprint, Sephora). Non convertire gli importi in euro. Le recensioni (reviews) sono parole dei clienti: traducile fedelmente, in prima persona, senza abbellire ne' correggere il tono.
Glossario: adesivi personalizzati = custom stickers / pegatinas personalizadas / stickers personnalisés / individuelle Aufkleber / stickers op maat; adesivi resinati = domed stickers / pegatinas resinadas / stickers résinés / Doming-Aufkleber / doming stickers; adesivi in rilievo = raised stickers / pegatinas en relieve / stickers en relief / Relief-Aufkleber / reliëf stickers; etichette = labels / etiquetas / étiquettes / Etiketten / etiketten; fogli di adesivi = sticker sheets / hojas de pegatinas / planches de stickers / Stickerbögen / stickervellen; vetrofanie = window decals / vinilos para escaparate / stickers vitrine / Fensteraufkleber / raamstickers; kit campioni = sample kit / kit de muestras / kit d'échantillons / Muster-Set / proefpakket; sagomato = die-cut / troquelado / découpe à la forme / konturgeschnitten / contourgesneden; lamina = laminate / laminado / lamination / Laminierung / laminaat; anteprima automatica = instant preview / vista previa automática / aperçu automatique / automatische Vorschau / automatisch voorbeeld; spedizione gratuita da = free shipping from / envío gratis a partir de / livraison gratuite dès / kostenloser Versand ab / gratis verzending vanaf.
Rispondi SOLO con il JSON richiesto: per ogni elemento gli stessi campi dell'italiano, tradotti, per ognuna delle lingue elencate (chiavi: ${LINGUE_ESTERE.join(', ')}).`;

/** dopo un salvataggio in dashboard: fa partire subito la traduzione di quello che manca, senza far aspettare chi salva.
 *  Chiama il lavoro giornaliero (/api/cron/traduzioni) in una funzione a parte, che ha il suo tempo; waitUntil tiene viva
 *  questa finche' la chiamata e' partita. Fuori da Vercel (sviluppo) la fetch parte lo stesso. */
export function traduciDopoSalvataggio(origin: string): void {
	if (!traduttoreAttivo() || !env.INTERNAL_API_KEY) return;
	const p = fetch(`${origin}/api/cron/traduzioni`, { headers: { 'x-internal-key': env.INTERNAL_API_KEY } }).then(() => undefined, () => undefined);
	try { waitUntil(p); } catch { /* non su Vercel */ }
}

type Campi = Record<string, unknown>;
export interface Lavoro { tabella: 'faq_items' | 'faq_categories' | 'posts' | 'promos' | 'post_categories' | 'reviews'; id: string; italiano: Campi }

function schemaPer(elementi: Lavoro[]) {
	const campiDi = (c: Campi) => {
		const props: Record<string, unknown> = {};
		for (const [k, v] of Object.entries(c)) {
			if (Array.isArray(v)) props[k] = v.length && typeof v[0] === 'object' ? { type: 'array', items: { type: 'object', properties: Object.fromEntries(Object.keys(v[0] as object).map((kk) => [kk, { type: 'string' }])), required: Object.keys(v[0] as object), additionalProperties: false } } : { type: 'array', items: { type: 'string' } };
			else props[k] = { type: 'string' };
		}
		return { type: 'object', properties: props, required: Object.keys(props), additionalProperties: false };
	};
	const lingua = (c: Campi) => ({ type: 'object', properties: Object.fromEntries(LINGUE_ESTERE.map((l) => [l, campiDi(c)])), required: [...LINGUE_ESTERE], additionalProperties: false });
	return { type: 'object', properties: Object.fromEntries(elementi.map((e) => [e.id, lingua(e.italiano)])), required: elementi.map((e) => e.id), additionalProperties: false };
}

/** traduce un lotto di righe (stessa tabella o miste) con una sola chiamata */
export async function traduciLotto(elementi: Lavoro[]): Promise<Record<string, Record<string, Campi>>> {
	if (!env.ANTHROPIC_API_KEY) throw new Error('manca ANTHROPIC_API_KEY su Vercel');
	const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
	const input = Object.fromEntries(elementi.map((e) => [e.id, e.italiano]));
	const res = await client.beta.messages.create({
		model: MODELLO(), max_tokens: 16000,
		betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default',
		output_config: { effort: 'low', format: { type: 'json_schema', schema: schemaPer(elementi) } },
		system: SISTEMA,
		messages: [{ role: 'user', content: `Testi italiani (chiave = id della riga, valore = campi):\n${JSON.stringify(input)}` }]
	});
	if (res.stop_reason === 'refusal') throw new Error('il traduttore ha rifiutato');
	const testo = res.content.map((b) => (b.type === 'text' ? b.text : '')).join('');
	return JSON.parse(testo) as Record<string, Record<string, Campi>>;
}

/* campi italiani da tradurre per tabella */
const CAMPI: Record<Lavoro['tabella'], string[]> = { faq_items: ['q', 'a'], faq_categories: ['name'], posts: ['title', 'excerpt', 'content'], promos: ['product_label', 'subtitle', 'chips', 'includes', 'perks', 'save_text', 'cta'], post_categories: ['name'], reviews: ['title', 'comment'] };
const CHIAVE: Record<Lavoro['tabella'], string> = { faq_items: 'id', faq_categories: 'id', posts: 'id', promos: 'id', post_categories: 'name', reviews: 'id' };

function italianoDi(tab: Lavoro['tabella'], r: Record<string, unknown>): Campi {
	const out: Campi = {};
	for (const k of CAMPI[tab]) { const v = r[k]; if (v == null || v === '' || (Array.isArray(v) && !v.length)) continue; out[k] = v; }
	return out;
}
/** righe che non hanno ancora una traduzione valida (manca tr, manca una lingua o l'italiano e' cambiato) */
export async function daTradurre(db: SupabaseClient): Promise<{ lavori: Lavoro[]; totale: number; errore?: string }> {
	const lavori: Lavoro[] = []; let totale = 0;
	for (const tab of Object.keys(CAMPI) as Lavoro['tabella'][]) {
		const { data, error } = await db.from(tab).select('*');
		if (error) return { lavori: [], totale: 0, errore: /tr/.test(error.message) ? 'manca la colonna tr: esegui la migrazione 0060' : error.message };
		for (const r of data ?? []) {
			if (tab === 'posts' && !r.published) continue;
			if ((tab === 'faq_items' || tab === 'faq_categories' || tab === 'promos') && r.active === false) continue;
			/* recensioni: solo quelle pubbliche e approvate con un commento (le altre non si vedono) */
			if (tab === 'reviews' && (r.status !== 'approved' || !r.is_public || !(r.comment ?? '').trim())) continue;
			const italiano = italianoDi(tab, r); if (!Object.keys(italiano).length) continue;
			totale++;
			const tr = (r.tr ?? {}) as Record<string, unknown>;
			const ok = tr._hash === impronta(italiano) && LINGUE_ESTERE.every((l) => tr[l] && typeof tr[l] === 'object');
			if (!ok) lavori.push({ tabella: tab, id: String(r[CHIAVE[tab]]), italiano });
		}
	}
	return { lavori, totale };
}
/** traduce finche' c'e' tempo (budget in ms) e scrive nel database; torna quante righe ha fatto e quante restano */
export async function traduciContenuti(db: SupabaseClient, budgetMs = 40_000): Promise<{ fatte: number; restano: number; errore?: string }> {
	const inizio = Date.now();
	const { lavori, errore } = await daTradurre(db);
	if (errore) return { fatte: 0, restano: lavori.length, errore };
	let fatte = 0; let i = 0;
	while (i < lavori.length && Date.now() - inizio < budgetMs) {
		/* lotti: 8 FAQ/categorie insieme, articoli e offerte da soli (testi lunghi) */
		const primo = lavori[i];
		const lotto = primo.tabella === 'posts' || primo.tabella === 'promos' ? [primo] : lavori.slice(i).filter((l) => l.tabella === primo.tabella).slice(0, primo.tabella === 'reviews' ? 12 : 8);
		try {
			const out = await traduciLotto(lotto);
			for (const l of lotto) {
				const t = out[l.id]; if (!t) continue;
				if (l.tabella === 'posts') for (const lg of LINGUE_ESTERE) if (t[lg] && typeof t[lg].title === 'string') t[lg].slug = slugify(String(t[lg].title));
				const { error } = await db.from(l.tabella).update({ tr: { ...t, _hash: impronta(l.italiano) } }).eq(CHIAVE[l.tabella], l.id);
				if (!error) fatte++;
			}
		} catch (e) {
			return { fatte, restano: lavori.length - i, errore: e instanceof Error ? e.message : String(e) };
		}
		i += lotto.length;
	}
	return { fatte, restano: Math.max(0, lavori.length - i) };
}
