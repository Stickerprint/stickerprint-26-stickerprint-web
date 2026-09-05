<script lang="ts">
	import { enhance } from '$app/forms';
	import { dateIt } from '$lib/account';
	let { data, form } = $props();
	let open = $state<string | null>(null);
	let stars = $state(5);
</script>

<svelte:head><title>Recensioni | Stickerprint</title></svelte:head>

<div class="acc__head"><div><p class="eyebrow">Area personale</p><h1>Recensioni</h1><p class="lead">Dicci com’è andata: aiuta noi e chi deve ancora ordinare.</p></div></div>

{#if form?.error}<p class="error">{form.error}</p>{/if}
{#if form?.ok}<p class="success">Grazie! Recensione ricevuta.</p>{/if}

<div class="acard">
	<h3>Da recensire</h3>
	{#if data.toReview.length === 0}
		<p class="empty">Nessun ordine in attesa di recensione.</p>
	{:else}
		{#each data.toReview as o (o.id)}
			<div class="orow" style="grid-template-columns:1fr auto">
				<div><div class="orow__meta">Ordine {o.number} · {dateIt(o.created_at, true)}</div><div class="orow__title">{o.product_name}</div><div class="orow__spec">{o.qty.toLocaleString('it-IT')} pz</div></div>
				<button type="button" class="btn btn--yellow btn--xs" onclick={() => { open = open === o.id ? null : o.id; stars = 5; }}>{open === o.id ? 'Chiudi' : '⭐ Scrivi recensione'}</button>
				{#if open === o.id}
					<form class="aform" method="POST" use:enhance style="grid-column:1/-1;padding:8px 0 4px">
						<input type="hidden" name="order_id" value={o.id} />
						<div class="full"><span class="sub">Valutazione</span>
							<div class="stars-in">{#each [1, 2, 3, 4, 5] as n (n)}<label class:on={n <= stars}><input type="radio" name="rating" value={n} checked={n === stars} onchange={() => (stars = n)} />★</label>{/each}</div>
						</div>
						<label class="full">Titolo<input name="title" placeholder="es. Adesivi perfetti" /></label>
						<label class="full">Commento<textarea name="comment" rows="4"></textarea></label>
						<div class="full"><button class="btn btn--green" type="submit">Invia recensione</button></div>
					</form>
				{/if}
			</div>
		{/each}
	{/if}
</div>

{#if data.reviewed.length > 0}
	<div class="acard">
		<h3>Le tue recensioni</h3>
		{#each data.reviewed as r (r.review.id)}
			<div class="orow" style="grid-template-columns:1fr">
				<div><div class="orow__meta">Ordine {r.order.number} · {dateIt(r.review.created_at, true)}</div><div class="orow__title"><span style="color:#f5b301">{'★'.repeat(r.review.rating)}</span> {r.review.title ?? r.order.product_name}</div>{#if r.review.comment}<div class="orow__spec">{r.review.comment}</div>{/if}</div>
			</div>
		{/each}
	</div>
{/if}
