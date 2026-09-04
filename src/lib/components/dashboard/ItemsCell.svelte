<script lang="ts">
	import { CATS, itemMeta, thumbOf, type OrderRow } from '$lib/dashboard/orders';
	let { items, expanded = false, ontoggle, size = 'md' }: { items: OrderRow[]; expanded?: boolean; ontoggle?: () => void; size?: 'md' | 'lg' } = $props();
	const first = $derived(items[0]);
	const qty = $derived(items.reduce((s, i) => s + i.qty, 0));
</script>

<div class="thumbs" class:thumbs--lg={size === 'lg'}>
	<div class="thumbs__stack">
		{#each items.slice(0, 3) as it (it.id)}
			{#if thumbOf(it)}<img src={thumbOf(it)} alt="" loading="lazy" />{:else}<span class="thumb-ph" style="background:{CATS[it.product_slug]?.soft ?? '#eee'}"></span>{/if}
		{/each}
		{#if items.length > 3}<span class="thumbs__more">+{items.length - 3}</span>{/if}
	</div>
	<div class="thumbs__txt">
		{#if items.length === 1}
			<b>{first.product_name}</b><div class="osub">{itemMeta(first)}</div>
		{:else}
			<b>{items.length} prodotti diversi</b><div class="osub">{qty.toLocaleString('it-IT')} pz totali</div>
			{#if ontoggle}<button type="button" class="link-btn" onclick={ontoggle}>{expanded ? '▴ nascondi dettaglio' : '▾ vedi tutti gli articoli'}</button>{/if}
		{/if}
	</div>
</div>
