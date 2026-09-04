import { periz, perizConfigurato } from '$lib/server/periz';
import { isoData } from '$lib/marketing/formato';
import type { PageServerLoad } from './$types';

/** Panoramica: i numeri di Meta, la coda dei contenuti, il budget e il prossimo appuntamento, tutto insieme. */
export const load: PageServerLoad = async () => {
	if (!perizConfigurato()) return { configurato: false as const };
	const [brand, social, campagne, contenuti, budget, appuntamenti, notifiche] = await Promise.all([
		periz.brand(),
		periz.social(),
		periz.campagne(),
		periz.contenuti(),
		periz.budget(),
		periz.appuntamenti(),
		periz.notifiche(5)
	]);
	const oggi = isoData(new Date());
	const prossimo = appuntamenti.ok ? (appuntamenti.appuntamenti.find((a) => a.date >= oggi) ?? null) : null;
	return { configurato: true as const, brand, social, campagne, contenuti, budget, prossimo, notifiche, oggi };
};
