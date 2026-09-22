/** Solo per i test: sostituisce i moduli di SvelteKit ($env, $app) che il codice server importa */
export const env: Record<string, string | undefined> = {};
export const PUBLIC_SUPABASE_URL = 'http://localhost';
export const PUBLIC_SITE_URL = '';
export const enhance = () => {};
export const goto = async () => {};
export const invalidateAll = async () => {};
export const page = { url: new URL('http://localhost/') };
