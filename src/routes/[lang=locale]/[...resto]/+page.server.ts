import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

/**
 * Route SEGNAPOSTO per gli URL con prefisso di lingua (/de/warenkorb, /us/cart). Non si vede mai: il reroute di
 * src/hooks.ts toglie il prefisso prima che SvelteKit scelga la route. Serve a Vercel: l'adapter genera una regola di
 * instradamento per ogni route di SvelteKit e manda tutto il resto a una funzione "catch-all" VUOTA (quando esistono
 * route con configurazione diversa, come /api/posta/elabora con maxDuration 300). Senza questa route, /de/warenkorb
 * finiva nella funzione vuota e dava 404 in produzione (21/10/2026), pur funzionando in locale.
 */
export const load: PageServerLoad = () => { error(404, 'Pagina non trovata'); };
