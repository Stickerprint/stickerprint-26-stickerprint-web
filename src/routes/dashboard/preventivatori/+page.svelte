<script lang="ts">
	let { data } = $props();
</script>

<svelte:head><title>Preventivatori | Dashboard Stickerprint</title></svelte:head>

<div>
	<h1>Preventivatori</h1>
	<p class="lead">Un motore di calcolo per ogni prodotto. Modifica i listini quando vuoi: il sito li usa subito.</p>
</div>
<div class="dgrid">
	{#each data.engines as e (e.slug)}
		<a class="dcard" href="/dashboard/preventivatori/{e.slug}">
			<h3>{e.name}</h3>
			<p style="font-size:13.5px;color:var(--muted)">
				{#if e.hasConfig}Listino personalizzato · aggiornato il {new Date(e.updatedAt).toLocaleDateString('it-IT')}{:else if e.slug === 'adesivi_personalizzati'}Listino iniziale (copiato dal prototipo){:else}Listino da definire{/if}
			</p>
			<span class="pill {e.active ? 'pill--on' : 'pill--off'}" style="margin-top:12px">{e.active ? 'Online' : 'Non pubblicato'}</span>
		</a>
	{/each}
</div>
