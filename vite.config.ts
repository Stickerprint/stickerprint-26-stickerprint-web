import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	/* npm run preview con Host: stickerprint.it, per provare in locale la configurazione SEO di produzione (scripts/seo-check.mjs) */
	preview: { allowedHosts: ['stickerprint.it', 'www.stickerprint.it'] },
	plugins: [sveltekit()]
});
