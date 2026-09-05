import { env } from '$env/dynamic/private';
import { periz, perizConfigurato } from './periz';

/**
 * Feed e follower di instagram.com/stickerprint.it.
 * 1) dashboard PERIZ Marketing (collegata a Meta): follower Instagram e ultimi post veri (instagram.feed);
 * 2) Instagram Graph API con INSTAGRAM_ACCESS_TOKEN;
 * 3) foto statiche se nessuna delle due risponde.
 * I dati sono tenuti in memoria un minuto: la home li rilegge ogni minuto per il contatore live.
 */
export interface IgMedia { id: string; permalink: string; image: string; caption: string; isVideo: boolean }
export interface IgData { username: string; profileUrl: string; followers: number | null; media: IgMedia[]; live: boolean; source: 'periz' | 'graph' | 'static'; updatedAt: string }

const PROFILE = 'https://www.instagram.com/stickerprint.it/';
const TTL_MS = 10 * 60 * 1000;          // il feed si rinnova ogni 10 minuti, in sottofondo
let refreshing: Promise<void> | null = null;
const FALLBACK: IgData = { username: 'stickerprint.it', profileUrl: PROFILE, followers: null, media: [1, 2, 3, 4, 5, 6, 7, 8].map((i) => ({ id: `static-${i}`, permalink: PROFILE, image: `/images/ig-${i}.jpg`, caption: '', isVideo: false })), live: false, source: 'static', updatedAt: new Date(0).toISOString() };
let cache: { at: number; data: IgData } | null = null;

async function fromPeriz(): Promise<IgData | null> {
	if (!perizConfigurato()) return null;
	const s = await periz.social();
	if (!s.ok || !s.collegato || !s.instagram.collegato) return null;
	// Il feed vero di Instagram, letto da Meta dalla dashboard PERIZ (4/9): gli
	// ultimi post con foto o anteprima del video, link e didascalia. Non passa
	// dai contenuti della coda PERIZ: quelli sono i file di lavoro, questo e'
	// quello che e' davvero online.
	const media: IgMedia[] = (s.instagram.feed ?? [])
		.filter((m) => m.immagine)
		.slice(0, 8)
		.map((m) => ({ id: m.id, permalink: m.permalink || PROFILE, image: m.immagine as string, caption: (m.didascalia || m.titolo || '').slice(0, 140), isVideo: m.tipo === 'video' }));
	// I follower solo di Instagram: kpi.follower somma anche Facebook.
	// se il campo manca, ultimo punto della serie "Follower Instagram nel tempo" (aggiornata da Meta ogni giorno)
	const serie = (s.serieFollower ?? []).filter((p) => typeof p.value === 'number' && p.value > 0);
	const followers = s.instagram.follower ?? (serie.length ? Number(serie[serie.length - 1].value) : null);
	if (followers == null && media.length < 4) return null;
	return { username: s.instagram.username ?? 'stickerprint.it', profileUrl: PROFILE, followers, media: media.length >= 4 ? media : FALLBACK.media, live: true, source: 'periz', updatedAt: s.aggiornato ?? new Date().toISOString() };
}

async function fromGraph(): Promise<IgData | null> {
	const token = env.INSTAGRAM_ACCESS_TOKEN;
	const userId = env.INSTAGRAM_USER_ID || 'me';
	if (!token) return null;
	const base = `https://graph.instagram.com/v21.0/${userId}`;
	const [profileRes, mediaRes] = await Promise.all([
		fetch(`${base}?fields=username,followers_count,media_count&access_token=${token}`),
		fetch(`${base}/media?fields=id,caption,media_type,media_url,thumbnail_url,permalink&limit=8&access_token=${token}`)
	]);
	if (!profileRes.ok || !mediaRes.ok) throw new Error(`Instagram API ${profileRes.status}/${mediaRes.status}`);
	const profile = (await profileRes.json()) as { username?: string; followers_count?: number };
	const media = (await mediaRes.json()) as { data?: { id: string; caption?: string; media_type: string; media_url?: string; thumbnail_url?: string; permalink: string }[] };
	const list = (media.data ?? []).filter((m) => m.media_url || m.thumbnail_url).slice(0, 8).map((m) => ({ id: m.id, permalink: m.permalink, image: (m.media_type === 'VIDEO' ? m.thumbnail_url : m.media_url) ?? m.media_url ?? '', caption: (m.caption ?? '').slice(0, 140), isVideo: m.media_type === 'VIDEO' }));
	return { username: profile.username ?? 'stickerprint.it', profileUrl: PROFILE, followers: profile.followers_count ?? null, media: list.length >= 4 ? list : FALLBACK.media, live: true, source: 'graph', updatedAt: new Date().toISOString() };
}

async function aggiorna(): Promise<void> {
	try {
		const data = (await fromPeriz()) ?? (await fromGraph());
		if (data) cache = { at: Date.now(), data };
	} catch (e) { console.warn('[instagram] uso il feed statico:', e); }
}

/* La home non aspetta mai l'agenzia: se c'e' un feed in cache (anche vecchio) lo
   restituisce subito e lo rinnova in sottofondo; alla prima richiesta aspetta al
   massimo 2,5 secondi, poi mostra il feed statico e continua a caricare. */
export async function getInstagram(opts: { attendi?: boolean } = {}): Promise<IgData> {
	if (cache && Date.now() - cache.at < TTL_MS) return cache.data;
	if (!refreshing) refreshing = aggiorna().finally(() => { refreshing = null; });
	if (cache) return cache.data;
	/* la pagina non aspetta (mostra il feed statico e il browser lo rilegge subito da
	   /api/instagram); l'API invece aspetta l'agenzia fino a 6 secondi */
	if (!opts.attendi) return FALLBACK;
	await Promise.race([refreshing, new Promise((r) => setTimeout(r, 6000))]);
	const dopo = cache as { at: number; data: IgData } | null;
	return dopo?.data ?? FALLBACK;
}
