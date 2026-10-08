import type { ParamMatcher } from '@sveltejs/kit';
/** /dashboard/marketing/meta | google | tiktok */
export const match: ParamMatcher = (p) => p === 'meta' || p === 'google' || p === 'tiktok';
