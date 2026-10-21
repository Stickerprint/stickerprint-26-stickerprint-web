<script lang="ts">
	import { enhance } from '$app/forms';
	import { usaLingua } from '$lib/traduzioni';
	const { t, prezzo, data: dataL } = usaLingua();
	let { data, form } = $props();
	let open = $state<string | null>(null);
	let stars = $state(5);
</script>

<svelte:head><title>{t('account.recensioni.titolo')}</title></svelte:head>

<div class="acc__head"><div><p class="eyebrow">{t('account.layout.areaPersonale')}</p><h1>{t('account.recensioni.h1')}</h1><p class="lead">{t('account.recensioni.lead')}</p></div></div>

{#if form?.error}<p class="error">{form.error}</p>{/if}
{#if form?.ok}<p class="success">{t('account.recensioni.grazie')}{#if form?.code} {t('account.recensioni.codice')} <b style="font-size:18px;letter-spacing:.06em">{form.code}</b> {t('account.recensioni.codiceNota', { min: prezzo(50, 0) })}{/if}</p>{/if}

<div class="acard">
	<h3>{t('account.recensioni.daRecensire')}</h3>
	{#if data.toReview.length === 0}
		<p class="empty">{t('account.recensioni.nessuno')}</p>
	{:else}
		{#each data.toReview as o (o.id)}
			<div class="orow orow--act">
				<div><div class="orow__meta">{t('account.recensioni.ordine', { n: o.number })} · {dataL(o.created_at)}</div><div class="orow__title">{o.items.length === 1 ? o.product_name : t('account.recensioni.articoli', { n: o.items.length })}</div><div class="orow__spec">{o.items.join(' · ')}</div></div>
				<button type="button" class="btn btn--yellow btn--xs" onclick={() => { open = open === o.id ? null : o.id; stars = 5; }}>{open === o.id ? t('account.recensioni.chiudi') : t('account.recensioni.scrivi')}</button>
				{#if open === o.id}
					<form class="aform" method="POST" use:enhance style="grid-column:1/-1;padding:8px 0 4px">
						<input type="hidden" name="order_id" value={o.id} />
						<input type="hidden" name="r" value={data.requestId} />
						<div class="full"><span class="sub">{t('account.recensioni.valutazione')}</span>
							<div class="stars-in">{#each [1, 2, 3, 4, 5] as n (n)}<label class:on={n <= stars}><input type="radio" name="rating" value={n} checked={n === stars} onchange={() => (stars = n)} />★</label>{/each}</div>
						</div>
						<label class="full">{t('account.recensioni.titoloCampo')}<input name="title" placeholder={t('account.recensioni.titoloPlaceholder')} /></label>
						<label class="full">{t('account.recensioni.commento')}<textarea name="comment" rows="4"></textarea></label>
						<div class="full"><button class="btn btn--green" type="submit">{t('account.recensioni.invia')}</button></div>
					</form>
				{/if}
			</div>
		{/each}
	{/if}
</div>

{#if data.reviewed.length > 0}
	<div class="acard">
		<h3>{t('account.recensioni.tue')}</h3>
		{#each data.reviewed as r (r.review.id)}
			<div class="orow orow--one">
				<div><div class="orow__meta">{t('account.recensioni.ordine', { n: r.order.number })} · {dataL(r.review.created_at)}</div><div class="orow__title"><span style="color:#f5b301">{'★'.repeat(r.review.rating)}</span> {r.review.title ?? r.order.product_name}</div>{#if r.review.comment}<div class="orow__spec">{r.review.comment}</div>{/if}</div>
			</div>
		{/each}
	</div>
{/if}
