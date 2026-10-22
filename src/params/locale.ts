import type { ParamMatcher } from '@sveltejs/kit';
/** prefissi di lingua dell'URL (vedi src/lib/i18n.ts): solo per la route segnaposto [lang=locale] */
export const match: ParamMatcher = (param) => /^(es|fr|de|nl|en|us)$/.test(param);
