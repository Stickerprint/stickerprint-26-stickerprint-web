<script lang="ts">
	import { eur, dateIt } from '$lib/account';
	let { data } = $props();
</script>

<svelte:head><title>Fatture | Stickerprint</title></svelte:head>

<div class="acc__head"><div><p class="eyebrow">Area personale</p><h1>Fatture</h1><p class="lead">Scarica le fatture dei tuoi ordini in PDF.</p></div></div>

<div class="acard">
	{#if data.invoices.length === 0}
		<p class="empty">Nessuna fattura ancora. Le trovi qui dopo ogni ordine pagato.</p>
	{:else}
		{#each data.invoices as f (f.id)}
			<div class="orow" style="grid-template-columns:1fr auto">
				<div>
					<div class="orow__meta">{dateIt(f.issued_at, true)}{#if f.order_number} · ordine {f.order_number}{/if}</div>
					<div class="orow__title">Fattura {f.number}</div>
				</div>
				<div class="orow__right">
					<span class="orow__price">{eur(f.amount_gross)}</span>
					{#if f.pdf_path}<a class="btn btn--blue btn--xs" href="/account/fatture/{f.id}">⬇ Scarica PDF</a>{:else}<span class="sub">PDF in arrivo</span>{/if}
				</div>
			</div>
		{/each}
	{/if}
</div>
