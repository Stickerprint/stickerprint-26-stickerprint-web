<script lang="ts">
	/** Briciole di pane visibili (Home › Adesivi › Adesivi resinati); il JSON-LD BreadcrumbList lo genera la pagina con breadcrumbLd() */
	let { items }: { items: { name: string; path: string }[] } = $props();
</script>

<nav class="crumbs" aria-label="Percorso">
	<ol>
		{#each items as it, i (it.path)}
			<li>
				{#if i < items.length - 1}<a href={it.path}>{it.name}</a><span aria-hidden="true">›</span>{:else}<span aria-current="page">{it.name}</span>{/if}
			</li>
		{/each}
	</ol>
</nav>

<style>
	.crumbs { font-size: 13px; color: var(--ink-soft); }
	.crumbs ol { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: 6px; }
	.crumbs li { display: inline-flex; gap: 6px; align-items: center; }
	.crumbs a { color: inherit; text-decoration: none; }
	.crumbs a:hover { text-decoration: underline; }
	.crumbs [aria-current] { color: var(--ink); font-weight: 700; }
</style>
