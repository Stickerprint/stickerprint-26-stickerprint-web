import { estimatedShipDate, formatItDate } from '$lib/utils/shipping';
import type { PageServerLoad } from './$types';

/** Data prevista e stato di accesso, per il messaggio dopo il pagamento */
export const load: PageServerLoad = async ({ url, locals: { user } }) => {
	const express = url.searchParams.get('e') === '1';
	return { shipDate: formatItDate(estimatedShipDate(express ? 3 : 5)), loggedIn: !!user };
};
