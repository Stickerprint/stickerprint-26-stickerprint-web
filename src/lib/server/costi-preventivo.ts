/** Dati per il pannello «Costi e margini» dei preventivi: listini con i costi dei materiali, descrizioni dei codici
 *  prodotto, macchinari con le velocita' e calendario di lavoro. Se qualcosa non si legge il pannello non compare
 *  (l'editor del preventivo funziona lo stesso). */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Contesto } from '$lib/margini/preventivo';
import { contestoMargini } from './margini';
import { loadSetup } from './produzione';

export async function datiCostiPreventivo(db: SupabaseClient): Promise<Omit<Contesto, 'prodottoDi'> | null> {
	try {
		const [m, setup] = await Promise.all([contestoMargini(db as never), loadSetup(db as never)]);
		return { engines: m.engines, codici: Object.fromEntries(m.codici), machines: setup.machines, profiles: setup.profiles, calendar: setup.calendar };
	} catch (e) {
		console.error('[costi preventivo]', e);
		return null;
	}
}
