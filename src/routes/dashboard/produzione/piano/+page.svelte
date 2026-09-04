<script lang="ts">
	import { STAGE_ICON, itemMeta, dmy } from '$lib/dashboard/orders';
	let { data } = $props();
	const blocks = [['prove', 'Prove di stampa', '/dashboard/fatturazione/ordini'], ['stampa', 'Stampa', '/dashboard/produzione/stampa'], ['plastifica', 'Plastifica', '/dashboard/produzione/plastifica'], ['taglio', 'Taglio', '/dashboard/produzione/taglio'], ['resinatura', 'Resinatura', '/dashboard/produzione/resinatura'], ['confezionamento', 'Confezionamento', '/dashboard/produzione/confezionamento'], ['spedizione', 'Spedizione', '/dashboard/produzione/spedizioni']];
</script>

<svelte:head><title>Piano di lavoro | Dashboard</title></svelte:head>

<div class="toolbar" style="justify-content:space-between">
	<div><h1>Piano di lavoro</h1><p class="lead">Cosa c'è oggi in ogni reparto, dal più vecchio al più recente. Le fasi vuote restano visibili: sapere che non c'è taglio è un'informazione.</p></div>
</div>

<div class="piano">
	{#each blocks as [key, label, href] (key)}
		{@const items = data.byStage[key] ?? []}
		<div class="dcard">
			<h3><span>{STAGE_ICON[key] ?? '🖼️'} {label}</span><a class="link" style="font-size:12px" {href}>{items.length} {items.length === 1 ? 'articolo' : 'articoli'} ›</a></h3>
			{#if items.length === 0}
				<p style="color:var(--muted);font-size:13px">Niente in {label.toLowerCase()}.</p>
			{:else}
				<ul>
					{#each items.slice(0, 8) as it (it.id)}
						<li><a href="/dashboard/fatturazione/ordini/{it.checkout_group ?? it.id}">{it.number}</a> · {it.qty.toLocaleString('it-IT')} × {it.product_name} <small style="color:var(--muted)">{itemMeta(it)} · {dmy(it.created_at)}</small></li>
					{/each}
					{#if items.length > 8}<li><a {href}>e altri {items.length - 8}…</a></li>{/if}
				</ul>
			{/if}
		</div>
	{/each}
</div>
