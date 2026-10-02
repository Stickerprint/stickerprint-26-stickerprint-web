/** Analisi margini: un ordine con ricavo, consumo e costo (condiviso fra server e pagine). */
import type { CostoRiga, StatoCosto } from './costi';

export interface RigaMargine {
	id: string; number: string; product_slug: string; product_name: string; product_code: string | null; description: string | null; qty: number;
	ricavo: number; costo: CostoRiga; margine: number | null; marginePct: number | null;
}
export interface OrdineMargine {
	key: string; number: string; channel: string; customer: string; created_at: string; status: string; qty: number;
	consegna: 'ours' | 'customer' | 'direct'; fattura: string | null;
	ricavo: { prodotti: number; servizi: number; spedizione: number; express: number; totale: number };
	costo: { vinile: number; stampa: number; lamina: number; resina: number; corriere: number; totale: number };
	/** null se anche una sola riga prodotto non si puo' calcolare */
	margine: number | null; marginePct: number | null;
	/** il peggiore fra le righe */
	stato: StatoCosto;
	/** quante righe hanno dati letti dalla descrizione (ordini manuali) */
	lette: number;
	righe: RigaMargine[];
}
