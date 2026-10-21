<script lang="ts">
	import { pct } from '$lib/account';
	import LoyaltyCard from '$lib/components/LoyaltyCard.svelte';
	import { usaLingua } from '$lib/traduzioni';
	const { t, path, prezzo, data: dataL, locale } = usaLingua();
	let { data } = $props();
	/* data breve dei movimenti (12 mag), nel formato della lingua */
	const breve = (d: string) => new Intl.DateTimeFormat(locale.intl, { day: 'numeric', month: 'short' }).format(new Date(d));
	const rate = $derived(data.loyalty ? pct(data.loyalty.credit_rate) : '2%');
</script>

<svelte:head><title>{t('account.credito.titolo')}</title></svelte:head>

<div class="acc__head"><div><p class="eyebrow">{t('account.layout.areaPersonale')}</p><h1>{t('account.credito.h1')}</h1><p class="lead">{t('account.credito.lead')}</p></div></div>

<div class="credit-hero credit-hero--row">
	<img src="/images/coin-sp.png" alt="" />
	<div><small>{t('account.credito.disponibile')}</small><div class="big">{prezzo(data.balance)}</div>{#if data.nextExpiry}<small>{t('account.credito.primaScadenza', { data: dataL(data.nextExpiry) })}</small>{/if}</div>
	<a class="btn btn--green" href={path('/prodotti')}>{t('account.credito.usa')}</a>
</div>

{#if data.loyalty}<LoyaltyCard l={data.loyalty} compact />{/if}

<div class="two two--half">
	<div class="acard stat"><span class="ico" style="background:#e1f3e8;font-family:var(--font-display);font-weight:800;color:#1d7a46">{rate}</span><span><b style="font-size:16px">{t('account.credito.guadagni')}</b><small>{t('account.credito.guadagniTesto', { pct: rate })}</small></span></div>
	<div class="acard stat"><span class="ico">✨</span><span><b style="font-size:16px">{t('account.credito.quandoVuoi')}</b><small>{t('account.credito.quandoVuoiTesto')}</small></span></div>
</div>

<div class="acard">
	<h3>{t('account.credito.movimenti')}</h3>
	<p class="sub" style="margin-bottom:8px">{t('account.credito.movimentiSub')}</p>
	{#if data.tx.length === 0}
		<p class="empty">{t('account.credito.nessunMovimento')}</p>
	{:else}
		{#each data.tx as tx (tx.id)}
			<div class="mrow"><small>{breve(tx.created_at)}</small><span style="flex:1">{tx.note ?? (tx.order_ref ? t('account.panoramica.ordineRef', { n: tx.order_ref }) : tx.kind)}{#if tx.kind === 'earn' && tx.expires_at}<small style="display:block">{t('account.credito.scadeIl', { data: dataL(tx.expires_at) })}</small>{/if}</span><b class={tx.amount >= 0 ? 'pos' : 'neg'}>{tx.amount >= 0 ? '+' : '−'}{prezzo(Math.abs(tx.amount))}</b></div>
		{/each}
	{/if}
</div>
