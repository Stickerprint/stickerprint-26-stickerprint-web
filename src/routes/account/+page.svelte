<script lang="ts">
	import OrderRow from '$lib/components/OrderRow.svelte';
	import ReorderModal from '$lib/components/ReorderModal.svelte';
	import { eur, dateIt, type Order } from '$lib/account';
	let { data } = $props();
	let reorder = $state<Order | null>(null);
	const first = $derived((data.profile.name || '').split(' ')[0] || 'cliente');
</script>

<svelte:head><title>La mia area | Stickerprint</title></svelte:head>

<div class="acc__head">
	<div>
		<p class="eyebrow">Area personale</p>
		<h1>Ciao, {first}!</h1>
		<p class="lead">Qui trovi tutto quello che riguarda il tuo account Stickerprint.</p>
	</div>
	<a class="btn btn--green" href="/prodotti">+ Nuovo ordine</a>
</div>

<div class="credit-hero">
	<div>
		<p class="eyebrow">Il tuo credito</p>
		<small>Disponibile ora</small>
		<div class="big">{eur(data.credit.balance)}</div>
		<small>da usare sul prossimo ordine</small><br />
		<a class="link" style="color:#fff;font-size:13px;display:inline-block;margin-top:12px" href="/account/credito">Scopri come funziona ›</a>
	</div>
	<img src="/images/coin-sp.png" alt="" />
	<div class="side">
		<div><small>Guadagnato</small><br /><b>{eur(data.credit.earned)}</b><br /><small>da tutti gli ordini</small></div>
		<div><small>Già utilizzato</small><br /><b>{eur(data.credit.used)}</b></div>
	</div>
</div>

<div class="stat3">
	<a class="acard stat" href="/account/ordini"><span class="ico">📦</span><span><b>{data.counts.orders}</b><small>Ordini effettuati</small></span></a>
	<div class="acard stat"><span class="ico" style="background:#e1f3e8">💰</span><span><b>{eur(data.credit.earnedYear)}</b><small>Credito guadagnato nel {new Date().getFullYear()}</small></span></div>
	<a class="acard stat" href="/account/recensioni"><span class="ico" style="background:#fff3d6">⭐</span><span><b>{data.counts.toReview}</b><small>Ordini da recensire</small></span></a>
</div>

<div class="two">
	<div class="acard">
		<div class="acc__head" style="margin-bottom:6px"><div><h3>Ordini recenti</h3><p class="sub">Tutto sotto controllo.</p></div><a class="link" style="font-size:13px" href="/account/ordini">Vedi tutti ›</a></div>
		{#if data.orders.length === 0}
			<p class="empty">Nessun ordine ancora. <a class="link" href="/prodotti">Crea il primo →</a></p>
		{:else}
			{#each data.orders as o (o.id)}<OrderRow {o} onreorder={(x) => (reorder = x)} />{/each}
		{/if}
	</div>
	<div class="acard">
		<div class="acc__head" style="margin-bottom:6px"><div><h3>Ultimi movimenti</h3><p class="sub">Il tuo credito Stickerprint.</p></div><a class="link" style="font-size:13px" href="/account/credito">Dettagli ›</a></div>
		{#if data.tx.length === 0}
			<p class="empty">Ancora nessun movimento.</p>
		{:else}
			{#each data.tx as t (t.id)}
				<div class="mrow"><small>{dateIt(t.created_at)}</small><span style="flex:1">{t.note ?? (t.order_ref ? `Ordine ${t.order_ref}` : t.kind)}</span><b class={t.amount >= 0 ? 'pos' : 'neg'}>{t.amount >= 0 ? '+' : '−'}{eur(Math.abs(t.amount))}</b></div>
			{/each}
		{/if}
	</div>
</div>

{#if reorder && data.engines[reorder.product_slug]}
	<ReorderModal order={reorder} cfg={data.engines[reorder.product_slug]} onclose={() => (reorder = null)} />
{/if}
