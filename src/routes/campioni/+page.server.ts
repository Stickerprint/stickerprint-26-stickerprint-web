import { estimatedShipDate, formatItDate } from '$lib/utils/shipping';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = () => ({ shipDate: formatItDate(estimatedShipDate(3)) });
