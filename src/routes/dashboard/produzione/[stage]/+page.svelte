<script lang="ts">
	import { fmtMin, STAGES } from '$lib/dashboard/produzione';
	import ProdTaskCard from '$lib/components/dashboard/ProdTaskCard.svelte';
	let { data, form } = $props();
	const pct = $derived(Math.min(100, Math.round((data.minutesOpen / data.capacity) * 100)));
</script>

<svelte:head><title>{data.label} | Dashboard</title></svelte:head>

<div class="toolbar" style="justify-content:space-between;align-items:flex-start">
	<div>
		<h1>{data.icon} {data.label}</h1>
		<p class="lead">La coda del reparto: quello che è in corso adesso, poi le prossime in ordine di priorità. "Inizia" quando prendi il lavoro, "Completa" quando esce dal reparto: la fase successiva si accende da sola.</p>
	</div>
	<div class="pr-kpis pr-kpis--side">
		<div class="pr-kpi"><b>{data.now.length}</b><span>in corso</span></div>
		<div class="pr-kpi"><b>{data.next.length}</b><span>pronte</span></div>
		<div class="pr-kpi" class:is-hot={data.blocked.length > 0}><b>{data.blocked.length}</b><span>bloccate</span></div>
		<div class="pr-kpi"><b>{data.doneToday}</b><span>fatte oggi</span></div>
		<div class="pr-kpi" class:is-warn={pct > 80}><b>{pct}%</b><span>{fmtMin(data.minutesOpen)} su {fmtMin(data.capacity)}</span></div>
	</div>
</div>
{#if form?.error}<p class="error">{form.error}</p>{/if}

<section class="pr-section">
	<h3>▶ Adesso <small class="osub">({data.now.length})</small></h3>
	{#if data.now.length === 0}<p class="osub">Nessuna lavorazione in corso in {data.label.toLowerCase()}.</p>
	{:else}<div class="pr-grid">{#each data.now as p (p.task.id)}<ProdTaskCard {p} />{/each}</div>{/if}
</section>

<section class="pr-section">
	<h3>Prossime <small class="osub">({data.next.length})</small></h3>
	{#if data.next.length === 0}<p class="osub">Niente in coda: il reparto è libero.</p>
	{:else}<div class="pr-grid">{#each data.next as p (p.task.id)}<ProdTaskCard {p} />{/each}</div>{/if}
</section>

{#if data.blocked.length}
	<section class="pr-section">
		<h3>⚠ Bloccate <small class="osub">({data.blocked.length})</small></h3>
		<div class="pr-grid">{#each data.blocked as p (p.task.id)}<ProdTaskCard {p} />{/each}</div>
	</section>
{/if}

{#if data.incoming.length}
	<section class="pr-section">
		<h3>In arrivo <small class="osub">({data.incoming.length})</small></h3>
		<p class="osub" style="margin-bottom:8px">Lavorazioni ferme nelle fasi precedenti o in attesa del cliente: arrivano qui quando la fase prima è completata.</p>
		<div class="pr-grid pr-grid--dim">{#each data.incoming as p (p.task.id)}<ProdTaskCard {p} actions={false} />{/each}</div>
	</section>
{/if}

<p class="osub">Macchine del reparto: {data.machines.join(', ')}. Capacità: {fmtMin(data.capacity)} al giorno. {#if STAGES[data.stage]}Per cambiare macchina apri la commessa.{/if}</p>
