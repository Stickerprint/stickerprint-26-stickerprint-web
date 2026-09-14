<script lang="ts">
	import { enhance } from '$app/forms';
	import { ORDER_STATUS, itemMeta } from '$lib/dashboard/orders';
	import { fmtAgo, fmtDay, fmtWhen } from '$lib/dashboard/produzione';
	import ProdTaskCard from '$lib/components/dashboard/ProdTaskCard.svelte';
	let { data, form } = $props();
	const now = $derived(new Date(data.now));
	const total = $derived(data.blocked.length + data.late.length + data.risky.length + data.missingFile.length + data.waiting.length);
</script>

<svelte:head><title>Centro problemi | Dashboard</title></svelte:head>

<div class="toolbar" style="justify-content:space-between">
	<div><h1>Centro problemi</h1><p class="lead">Tutto quello che oggi rischia di far saltare una consegna, in un posto solo: lavorazioni bloccate, in ritardo, a rischio, e clienti che non rispondono.</p></div>
</div>
{#if form?.error}<p class="error">{form.error}</p>{/if}

{#if total === 0}
	<div class="dcard" style="text-align:center;padding:40px"><b style="font-size:22px">Nessun problema aperto 🎉</b><p class="osub">Bloccate, ritardi, rischi e attese del cliente: tutto a zero.</p></div>
{/if}

{#if data.blocked.length}
	<section class="pr-section">
		<h3>⚠ Bloccate <small class="osub">({data.blocked.length})</small></h3>
		<p class="osub" style="margin-bottom:8px">Ferme per un motivo scritto dall'operatore. Risolvi la causa e sblocca: tornano in coda con la loro priorità.</p>
		<div class="pr-grid">{#each data.blocked as p (p.task.id)}<ProdTaskCard {p} showStage />{/each}</div>
	</section>
{/if}

{#if data.late.length}
	<section class="pr-section">
		<h3>⏰ In ritardo <small class="osub">({data.late.length})</small></h3>
		<p class="osub" style="margin-bottom:8px">La scadenza della fase è passata: la spedizione promessa non regge più senza correre. Avvisa il cliente dal dettaglio commessa se serve una nuova data.</p>
		<div class="pr-grid">{#each data.late as p (p.task.id)}<ProdTaskCard {p} showStage />{/each}</div>
	</section>
{/if}

{#if data.risky.length}
	<section class="pr-section">
		<h3>🔥 A rischio <small class="osub">({data.risky.length})</small></h3>
		<p class="osub" style="margin-bottom:8px">Partendo adesso non si arriva in tempo per il ritiro, oppure restano meno di 4 ore di margine.</p>
		<div class="pr-grid">{#each data.risky as p (p.task.id)}<ProdTaskCard {p} showStage />{/each}</div>
	</section>
{/if}

{#if data.missingFile.length || data.waiting.length}
	<section class="pr-section">
		<h3>✉ Il cliente non risponde <small class="osub">({data.missingFile.length + data.waiting.length})</small></h3>
		<p class="osub" style="margin-bottom:8px">File mancanti, anteprime oltre il termine utile, modifiche richieste. Il sollecito parte con la data entro cui rispondere per tenere la spedizione.</p>
		<ul class="pr-list">
			{#each [...data.missingFile, ...data.waiting] as a (a.order.id)}
				<li class:is-overdue={a.overdue}>
					<a class="pr-num" href="/dashboard/fatturazione/ordini/{a.order.checkout_group ?? a.order.id}">{a.order.number}</a> · {a.order.qty} × {a.order.product_name}
					<span class="pill" style="background:{ORDER_STATUS[a.order.status]?.soft};color:{ORDER_STATUS[a.order.status]?.color}">{ORDER_STATUS[a.order.status]?.label}</span>
					<div class="osub">{itemMeta(a.order)}{#if a.order.customer_name} · {a.order.customer_name}{/if}{#if a.order.email} · {a.order.email}{/if} · da {fmtAgo(a.since, now)} · spedizione {fmtDay(a.order.ship_by, now)}</div>
					<div class="osub" class:is-late={a.overdue}>{a.overdue ? `⏰ termine ${fmtWhen(a.deadline, now)} superato: la data slitterà` : `entro ${fmtWhen(a.deadline, now)}`}</div>
					{#if a.order.status === 'approvazione' || a.order.status === 'attesa_file'}
						<form method="POST" action="?/sollecita" use:enhance style="margin-top:6px"><input type="hidden" name="order" value={a.order.id} /><button class="btn btn--ghost btn--xs" type="submit">✉ Sollecita{#if a.order.proof_reminded_at} <small>(ultimo {fmtAgo(a.order.proof_reminded_at, now)})</small>{/if}</button></form>
					{:else}
						<div class="osub">Tocca a noi: {a.order.status === 'modifiche_richieste' ? 'rifare l\'anteprima con le modifiche' : 'preparare e inviare l\'anteprima'}.</div>
					{/if}
				</li>
			{/each}
		</ul>
	</section>
{/if}
