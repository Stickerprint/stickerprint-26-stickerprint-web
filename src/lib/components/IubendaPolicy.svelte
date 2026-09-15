<script lang="ts">
	/** Testo di una policy iubenda (sito 3794551, policy 42500812) incorporato nella pagina; senza JS resta il link al documento. */
	import { onMount } from 'svelte';
	let { href, title }: { href: string; title: string } = $props();
	onMount(() => {
		const s = document.createElement('script');
		s.src = 'https://cdn.iubenda.com/iubenda.js';
		document.body.appendChild(s);
		return () => s.remove();
	});
</script>

<a {href} class="iubenda-white no-brand iubenda-noiframe iubenda-embed iub-body-embed" {title}>{title}</a>
