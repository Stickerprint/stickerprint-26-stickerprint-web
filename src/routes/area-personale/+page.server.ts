import { redirect } from '@sveltejs/kit';
import { localizePath } from '$lib/i18n';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals }) => {
	redirect(301, localizePath('/account', locals.locale));
};
