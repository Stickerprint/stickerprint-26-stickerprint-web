import adapter from '@sveltejs/adapter-vercel';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: vitePreprocess(),
	kit: {
		// Vercel: runtime Node, ogni route server diventa una function
		adapter: adapter({ runtime: 'nodejs22.x', regions: ['fra1'] })   /* le funzioni girano a Francoforte, vicino a Supabase (prima: Washington, ~100 ms per ogni chiamata al database) */
	}
};

export default config;
