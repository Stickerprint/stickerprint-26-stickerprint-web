import { json } from '@sveltejs/kit';
import { getInstagram } from '$lib/server/instagram';
import type { RequestHandler } from './$types';

/** Follower e feed live per la home (riletti ogni minuto dal browser) */
export const GET: RequestHandler = async ({ setHeaders }) => {
	setHeaders({ 'Cache-Control': 'public, max-age=60' });
	return json(await getInstagram({ attendi: true }));
};
