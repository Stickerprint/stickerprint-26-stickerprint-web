<script lang="ts">
	import OrderRow from '$lib/components/OrderRow.svelte';
	import ReorderModal from '$lib/components/ReorderModal.svelte';
	import { OPEN_STATUSES, type Order } from '$lib/account';
	import { usaLingua } from '$lib/traduzioni';
	const { t, path } = usaLingua();
	let { data } = $props();
	let tab = $state<'tutti' | 'corso' | 'consegnati'>('tutti');
	let reorder = $state<Order | null>(null);
	const open = $derived(data.orders.filter((o) => OPEN_STATUSES.includes(o.status)));
	const done = $derived(data.orders.filter((o) => o.status === 'consegnato'));
	const list = $derived(tab === 'corso' ? open : tab === 'consegnati' ? done : data.orders);
</script>

<svelte:head><title>{t('account.ordini.titolo')}</title></svelte:head>

<div class="acc__head">
	<div><p class="eyebrow">{t('account.layout.areaPersonale')}</p><h1>{t('account.ordini.h1')}</h1><p class="lead">{t('account.ordini.lead')}</p></div>
</div>

<div class="acard">
	<div class="atabs">
		<button type="button" class:is-active={tab === 'tutti'} onclick={() => (tab = 'tutti')}>{t('account.ordini.tutti')}<span>{data.orders.length}</span></button>
		<button type="button" class:is-active={tab === 'corso'} onclick={() => (tab = 'corso')}>{t('account.ordini.inCorso')}<span>{open.length}</span></button>
		<button type="button" class:is-active={tab === 'consegnati'} onclick={() => (tab = 'consegnati')}>{t('account.ordini.consegnati')}<span>{done.length}</span></button>
	</div>
	{#if list.length === 0}
		<p class="empty">{t('account.ordini.nessuno')} <a class="link" href={path('/prodotti')}>{t('account.ordini.scegliProdotto')}</a></p>
	{:else}
		{#each list as o (o.id)}<OrderRow {o} onreorder={(x) => (reorder = x)} />{/each}
	{/if}
</div>

{#if reorder && data.engines[reorder.product_slug]}
	<ReorderModal order={reorder} cfg={data.engines[reorder.product_slug]} onclose={() => (reorder = null)} />
{/if}
