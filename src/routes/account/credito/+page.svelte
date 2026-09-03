<script lang="ts">
	import { eur, dateIt } from '$lib/account';
	let { data } = $props();
</script>

<svelte:head><title>Credito Stickerprint | Stickerprint</title></svelte:head>

<div class="acc__head"><div><p class="eyebrow">Area personale</p><h1>Credito Stickerprint</h1><p class="lead">Ogni ordine ti lascia qualcosa per il prossimo.</p></div></div>

<div class="credit-hero" style="grid-template-columns:auto 1fr auto">
	<img src="/images/coin-sp.png" alt="" />
	<div><small>Credito disponibile</small><div class="big">{eur(data.balance)}</div>{#if data.nextExpiry}<small>Il primo accredito scade il {dateIt(data.nextExpiry, true)}</small>{/if}</div>
	<a class="btn btn--green" href="/prodotti">Usa il credito ›</a>
</div>

<div class="two" style="grid-template-columns:1fr 1fr">
	<div class="acard stat"><span class="ico" style="background:#e1f3e8;font-family:var(--font-display);font-weight:800;color:#1d7a46">5%</span><span><b style="font-size:16px">Guadagni a ogni ordine</b><small>Il 5% dell’imponibile torna nel tuo portafoglio Stickerprint. Vale 6 mesi.</small></span></div>
	<div class="acard stat"><span class="ico">✨</span><span><b style="font-size:16px">Lo usi quando vuoi</b><small>Puoi applicarlo direttamente al carrello del prossimo acquisto.</small></span></div>
</div>

<div class="acard">
	<h3>Movimenti del credito</h3>
	<p class="sub" style="margin-bottom:8px">Guadagni e utilizzi più recenti.</p>
	{#if data.tx.length === 0}
		<p class="empty">Ancora nessun movimento: il primo ordine pagato genera il 5% di credito.</p>
	{:else}
		{#each data.tx as t (t.id)}
			<div class="mrow"><small>{dateIt(t.created_at)}</small><span style="flex:1">{t.note ?? (t.order_ref ? `Ordine ${t.order_ref}` : t.kind)}{#if t.kind === 'earn' && t.expires_at}<small style="display:block">scade il {dateIt(t.expires_at, true)}</small>{/if}</span><b class={t.amount >= 0 ? 'pos' : 'neg'}>{t.amount >= 0 ? '+' : '−'}{eur(Math.abs(t.amount))}</b></div>
		{/each}
	{/if}
</div>
