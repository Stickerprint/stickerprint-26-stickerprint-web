<script lang="ts">
	import { postDate } from '$lib/blog';
	let { data } = $props();
</script>

<svelte:head><title>Blog | Dashboard Stickerprint</title></svelte:head>

<div class="toolbar" style="justify-content:space-between">
	<div>
		<h1>Articoli del blog</h1>
		<p class="lead">Scrivi, pubblica e organizza per categoria. Foto e video si inseriscono direttamente nel testo.</p>
	</div>
	<a class="btn btn--green" href="/dashboard/blog/nuovo">+ Nuovo articolo</a>
</div>

<div class="dcard" style="overflow-x:auto">
	{#if data.posts.length === 0}
		<p style="color:var(--muted)">Nessun articolo. Crea il primo.</p>
	{:else}
		<table class="dtable">
			<thead><tr><th>Titolo</th><th>Categoria</th><th>Stato</th><th>Data</th><th></th></tr></thead>
			<tbody>
				{#each data.posts as p (p.id)}
					<tr>
						<td><a class="link" href="/dashboard/blog/{p.id}"><b>{p.title}</b></a><br /><small style="color:var(--muted)">/blog/{p.slug}</small></td>
						<td>{p.category}</td>
						<td><span class="pill {p.published ? 'pill--on' : 'pill--off'}">{p.published ? 'Pubblicato' : 'Bozza'}</span></td>
						<td>{postDate(p)}</td>
						<td style="white-space:nowrap"><a class="btn btn--ghost btn--xs" href="/dashboard/blog/{p.id}">Modifica</a> {#if p.published}<a class="btn btn--ghost btn--xs" href="/blog/{p.slug}" target="_blank" rel="noopener">Vedi ↗</a>{/if}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	{/if}
</div>
