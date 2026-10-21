import { estimatedShipDate } from '$lib/utils/shipping';
import type { PageServerLoad } from './$types';

/** la data si formatta nella pagina con data() nella lingua del visitatore */
export const load: PageServerLoad = () => ({ shipDate: estimatedShipDate(3).toISOString() });
