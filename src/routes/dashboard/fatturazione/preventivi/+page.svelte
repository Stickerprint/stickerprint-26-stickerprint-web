<script lang="ts">
	import { page } from '$app/state';
	const year = $derived(Number(page.url.searchParams.get('anno')) || new Date().getFullYear());
	const years = Array.from({ length: 4 }, (_, i) => new Date().getFullYear() - i);
</script>
<svelte:head><title>Preventivi | Dashboard</title></svelte:head>
<div class="toolbar" style="justify-content:space-between">
	<div><h1>Preventivi {year}</h1><p class="lead">Preventivi con generazione dell'ordine, duplica e PDF. In arrivo.</p></div>
	<div class="year-bar">{#each years as y (y)}<a href="?anno={y}" class:is-active={y === year}>{y}</a>{/each}</div>
</div>
<div class="soon"><b>Nessun documento nel {year}</b><span>Numerazione: {'SPP'}00001, riparte ogni 1° gennaio.</span></div>
