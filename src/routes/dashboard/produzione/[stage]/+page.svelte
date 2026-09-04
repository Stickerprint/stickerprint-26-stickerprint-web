<script lang="ts">
	import { enhance } from '$app/forms';
	import { STAGE_ICON, PROD_STAGES, CATS, itemMeta, dmy, nextStage } from '$lib/dashboard/orders';
	let { data, form } = $props();
</script>

<svelte:head><title>{data.label} | Dashboard</title></svelte:head>

<div class="toolbar" style="justify-content:space-between">
	<div><h1>{STAGE_ICON[data.stage]} {data.label}</h1><p class="lead">{data.items.length} {data.items.length === 1 ? 'articolo' : 'articoli'} in questa fase, il più vecchio in cima. Spunta quando il lavoro è fatto: passa al reparto successivo.</p></div>
</div>
{#if form?.error}<p class="error">{form.error}</p>{/if}

<div class="stagegrid">
	{#each data.items as it (it.id)}
		{@const next = nextStage(it)}
		<div class="stagecard">
			{#if it.proof_url || it.preview_url || it.mockup_url}<img src={it.proof_url ?? it.preview_url ?? it.mockup_url} alt="" />{:else}<span class="ph"></span>{/if}
			<div>
				<a class="oid" href="/dashboard/fatturazione/ordini/{it.checkout_group ?? it.id}">{it.number}</a> · <b>{it.qty.toLocaleString('it-IT')} × {it.product_name}</b>
				<span class="cat" style="background:{CATS[it.product_slug]?.soft};color:{CATS[it.product_slug]?.color};margin-left:6px">{CATS[it.product_slug]?.name ?? it.product_slug}</span>
				<div class="osub">{itemMeta(it)} · ordine del {dmy(it.created_at)}{#if it.customer_name} · {it.customer_name}{/if}{#if it.express} · ⚡ express{/if}</div>
				{#if it.notes}<div class="osub">📝 {it.notes}</div>{/if}
			</div>
			<form method="POST" action="?/advance" use:enhance>
				<input type="hidden" name="item" value={it.id} />
				<button class="btn btn--green btn--xs" type="submit">✓ Fatto → {next ? PROD_STAGES[next] : 'Pronto per la spedizione'}</button>
			</form>
		</div>
	{:else}
		<div class="dcard" style="text-align:center;color:var(--muted)">Niente in {data.label.toLowerCase()} oggi.</div>
	{/each}
</div>
