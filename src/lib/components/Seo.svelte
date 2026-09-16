<script lang="ts">
	/**
	 * Metadata della pagina: titolo, descrizione, Open Graph, Twitter Card e dati strutturati.
	 * Canonical e robots li mette il layout (uguali per tutte le pagine), qui solo il resto.
	 */
	import { page } from '$app/state';
	import { DEFAULT_OG_IMAGE, SITE_NAME, absUrl, canonicalUrl, jsonLd } from '$lib/seo';
	let { title, description, image = null, type = 'website', ld = [] }: { title: string; description: string; image?: string | null; type?: 'website' | 'article' | 'product'; ld?: unknown[] } = $props();
	const ogImage = $derived(image ? absUrl(image) : DEFAULT_OG_IMAGE);
	const url = $derived(canonicalUrl(page.url.pathname));
</script>

<svelte:head>
	<title>{title}</title>
	<meta name="description" content={description} />
	<meta property="og:title" content={title} />
	<meta property="og:description" content={description} />
	<meta property="og:type" content={type === 'product' ? 'website' : type} />
	<meta property="og:url" content={url} />
	<meta property="og:image" content={ogImage} />
	<meta property="og:site_name" content={SITE_NAME} />
	<meta property="og:locale" content="it_IT" />
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:title" content={title} />
	<meta name="twitter:description" content={description} />
	<meta name="twitter:image" content={ogImage} />
	{#each ld as node, i (i)}
		{@html `<script type="application/ld+json">${jsonLd(node)}</script>`}
	{/each}
</svelte:head>
