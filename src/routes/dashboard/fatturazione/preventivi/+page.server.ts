import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
/** I preventivi vivono nella sezione Aziende */
export const load: PageServerLoad = ({ url }) => { redirect(301, '/dashboard/aziende/preventivi' + url.search); };
