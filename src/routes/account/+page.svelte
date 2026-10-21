<script lang="ts">
	import OrderRow from '$lib/components/OrderRow.svelte';
	import ReorderModal from '$lib/components/ReorderModal.svelte';
	import LoyaltyCard from '$lib/components/LoyaltyCard.svelte';
	import { pct, type Order } from '$lib/account';
	import { usaLingua } from '$lib/traduzioni';
	const { t, path, prezzo, locale } = usaLingua();
	let { data } = $props();
	let reorder = $state<Order | null>(null);
	const first = $derived((data.profile.name || '').split(' ')[0] || t('account.panoramica.clienteGenerico'));
	/* data breve dei movimenti (12 mag), nel formato della lingua */
	const breve = (d: string) => new Intl.DateTimeFormat(locale.intl, { day: 'numeric', month: 'short' }).format(new Date(d));
	const anno = new Date().getFullYear();
</script>

<svelte:head><title>{t('account.panoramica.titolo')}</title></svelte:head>

<div class="acc__head ov-head">
	<div>
		<p class="eyebrow">{t('account.layout.areaPersonale')}</p>
		<h1>{t('account.panoramica.ciao', { nome: first })}</h1>
		<p class="lead">{t('account.panoramica.lead')}</p>
	</div>
</div>

{#if data.loyalty}<LoyaltyCard l={data.loyalty} />{/if}

<div class="credit-hero ov-credit">
	<div>
		<p class="eyebrow">{t('account.panoramica.tuoCredito')}</p>
		<small>{t('account.panoramica.disponibile')}</small>
		<div class="big">{prezzo(data.credit.balance)}</div>
		<small>{t('account.panoramica.daUsare')}{#if data.loyalty}{t('account.panoramica.guadagniCome', { pct: pct(data.loyalty.credit_rate), livello: data.loyalty.name })}{/if}</small><br />
		<a class="link" style="color:#fff;font-size:13px;display:inline-block;margin-top:12px" href={path('/account/credito')}>{t('account.panoramica.comeFunziona')}</a>
	</div>
	<img src="/images/coin-sp.png" alt="" />
	<div class="side">
		<div><small>{t('account.panoramica.guadagnato')}</small><br /><b>{prezzo(data.credit.earned)}</b><br /><small>{t('account.panoramica.daTuttiOrdini')}</small></div>
		<div><small>{t('account.panoramica.giaUsato')}</small><br /><b>{prezzo(data.credit.used)}</b></div>
	</div>
</div>

<div class="stat3 ov-stats">
	<a class="acard stat" href={path('/account/ordini')}><span class="ico">📦</span><span><b>{data.counts.orders}</b><small>{t('account.panoramica.ordiniEffettuati')}</small></span></a>
	<div class="acard stat"><span class="ico" style="background:#e1f3e8">💰</span><span><b>{prezzo(data.credit.earnedYear)}</b><small>{t('account.panoramica.creditoAnno', { anno })}</small></span></div>
	<a class="acard stat" href={path('/account/recensioni')}><span class="ico" style="background:#fff3d6">⭐</span><span><b>{data.counts.toReview}</b><small>{t('account.panoramica.daRecensire')}</small></span></a>
</div>

<div class="two ov-two">
	<div class="acard ov-orders">
		<div class="acc__head" style="margin-bottom:6px"><div><h3>{t('account.panoramica.ordiniRecenti')}</h3><p class="sub">{t('account.panoramica.sottoControllo')}</p></div><a class="link" style="font-size:13px" href={path('/account/ordini')}>{t('account.panoramica.vediTutti')}</a></div>
		{#if data.orders.length === 0}
			<p class="empty">{t('account.panoramica.nessunOrdine')} <a class="link" href={path('/prodotti')}>{t('account.panoramica.creaPrimo')}</a></p>
		{:else}
			{#each data.orders as o (o.id)}<OrderRow {o} onreorder={(x) => (reorder = x)} />{/each}
		{/if}
	</div>
	<div class="acard ov-tx">
		<div class="acc__head" style="margin-bottom:6px"><div><h3>{t('account.panoramica.ultimiMovimenti')}</h3><p class="sub">{t('account.panoramica.tuoCreditoSp')}</p></div><a class="link" style="font-size:13px" href={path('/account/credito')}>{t('account.panoramica.dettagli')}</a></div>
		{#if data.tx.length === 0}
			<p class="empty">{t('account.panoramica.nessunMovimento')}</p>
		{:else}
			{#each data.tx as tx (tx.id)}
				<div class="mrow"><small>{breve(tx.created_at)}</small><span style="flex:1">{tx.note ?? (tx.order_ref ? t('account.panoramica.ordineRef', { n: tx.order_ref }) : tx.kind)}</span><b class={tx.amount >= 0 ? 'pos' : 'neg'}>{tx.amount >= 0 ? '+' : '−'}{prezzo(Math.abs(tx.amount))}</b></div>
			{/each}
		{/if}
	</div>
</div>

{#if reorder && data.engines[reorder.product_slug]}
	<ReorderModal order={reorder} cfg={data.engines[reorder.product_slug]} onclose={() => (reorder = null)} />
{/if}
