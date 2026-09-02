import { env } from '$env/dynamic/private';

/**
 * Feed e follower di instagram.com/stickerprint.it tramite Instagram Graph API.
 * Serve un account Instagram Business/Creator e un token (vedi README).
 * Senza token, o se Instagram non risponde, si usano le foto statiche.
 * I dati sono tenuti in cache 10 minuti per non superare i limiti dell'API.
 */

export interface IgMedia {
	id: string;
	permalink: string;
	image: string;
	caption: string;
	isVideo: boolean;
}

export interface IgData {
	username: string;
	profileUrl: string;
	followers: number | null;
	media: IgMedia[];
	live: boolean; // true = dati reali da Instagram
}

const PROFILE = 'https://www.instagram.com/stickerprint.it/';
const TTL_MS = 10 * 60 * 1000;

const FALLBACK: IgData = {
	username: 'stickerprint.it',
	profileUrl: PROFILE,
	followers: null,
	media: [1, 2, 3, 4, 5, 6, 7, 8].map((i) => ({
		id: `static-${i}`,
		permalink: PROFILE,
		image: `/images/ig-${i}.jpg`,
		caption: '',
		isVideo: false
	})),
	live: false
};

let cache: { at: number; data: IgData } | null = null;

export async function getInstagram(): Promise<IgData> {
	if (cache && Date.now() - cache.at < TTL_MS) return cache.data;

	const token = env.INSTAGRAM_ACCESS_TOKEN;
	const userId = env.INSTAGRAM_USER_ID || 'me';
	if (!token) return FALLBACK;

	try {
		const base = `https://graph.instagram.com/v21.0/${userId}`;
		const [profileRes, mediaRes] = await Promise.all([
			fetch(`${base}?fields=username,followers_count,media_count&access_token=${token}`),
			fetch(`${base}/media?fields=id,caption,media_type,media_url,thumbnail_url,permalink&limit=8&access_token=${token}`)
		]);
		if (!profileRes.ok || !mediaRes.ok) throw new Error(`Instagram API ${profileRes.status}/${mediaRes.status}`);

		const profile = (await profileRes.json()) as { username?: string; followers_count?: number };
		const media = (await mediaRes.json()) as {
			data?: { id: string; caption?: string; media_type: string; media_url?: string; thumbnail_url?: string; permalink: string }[];
		};

		const data: IgData = {
			username: profile.username ?? 'stickerprint.it',
			profileUrl: PROFILE,
			followers: profile.followers_count ?? null,
			media: (media.data ?? [])
				.filter((m) => m.media_url || m.thumbnail_url)
				.slice(0, 8)
				.map((m) => ({
					id: m.id,
					permalink: m.permalink,
					image: (m.media_type === 'VIDEO' ? m.thumbnail_url : m.media_url) ?? m.media_url ?? '',
					caption: (m.caption ?? '').slice(0, 140),
					isVideo: m.media_type === 'VIDEO'
				})),
			live: true
		};
		if (data.media.length < 4) data.media = FALLBACK.media;

		cache = { at: Date.now(), data };
		return data;
	} catch (e) {
		console.warn('[instagram] uso il feed statico:', e);
		return cache?.data ?? FALLBACK;
	}
}
