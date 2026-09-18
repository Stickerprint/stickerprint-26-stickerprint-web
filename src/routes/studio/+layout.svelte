<script lang="ts">
	import '$lib/styles/studio.css';
	import { page } from '$app/state';
	let { data, children } = $props();
</script>

<svelte:head><meta name="robots" content="noindex, nofollow" /></svelte:head>

<div class="st">
	<header class="st-top">
		<a class="st-brand" href="/studio">
			<img src="/images/splogo-400.png" alt="" width="34" height="34" />
			<span>Stickerprint <b>Studio</b></span>
		</a>
		<nav class="st-nav">
			{#if page.url.pathname !== '/studio'}<a href="/studio">← Prodotti</a>{/if}
			<a href="/dashboard">Dashboard</a>
			{#if data.fullName}<span class="st-user">{data.fullName}</span>{/if}
		</nav>
	</header>
	<div class="st-body">
		{@render children()}
	</div>
</div>
