<script lang="ts">
	import OrderRow from '$lib/components/OrderRow.svelte';
	import ReorderModal from '$lib/components/ReorderModal.svelte';
	import { OPEN_STATUSES, type Order } from '$lib/account';
	let { data } = $props();
	let tab = $state<'tutti' | 'corso' | 'consegnati'>('tutti');
	let reorder = $state<Order | null>(null);
	const open = $derived(data.orders.filter((o) => OPEN_STATUSES.includes(o.status)));
	const done = $derived(data.orders.filter((o) => o.status === 'consegnato'));
	const list = $derived(tab === 'corso' ? open : tab === 'consegnati' ? done : data.orders);
</script>

<svelte:head><title>I miei ordini | Stickerprint</title></svelte:head>

<div class="acc__head">
	<div><p class="eyebrow">Area personale</p><h1>I miei ordini</h1><p class="lead">Controlla lo stato, recupera i file e riordina con un click.</p></div>
	<a class="btn btn--green" href="/prodotti">+ Nuovo ordine</a>
</div>

<div class="acard">
	<div class="atabs">
		<button type="button" class:is-active={tab === 'tutti'} onclick={() => (tab = 'tutti')}>Tutti<span>{data.orders.length}</span></button>
		<button type="button" class:is-active={tab === 'corso'} onclick={() => (tab = 'corso')}>In corso<span>{open.length}</span></button>
		<button type="button" class:is-active={tab === 'consegnati'} onclick={() => (tab = 'consegnati')}>Consegnati<span>{done.length}</span></button>
	</div>
	{#if list.length === 0}
		<p class="empty">Nessun ordine qui. <a class="link" href="/prodotti">Scegli un prodotto →</a></p>
	{:else}
		{#each list as o (o.id)}<OrderRow {o} onreorder={(x) => (reorder = x)} />{/each}
	{/if}
</div>

{#if reorder && data.engines[reorder.product_slug]}
	<ReorderModal order={reorder} cfg={data.engines[reorder.product_slug]} onclose={() => (reorder = null)} />
{/if}
