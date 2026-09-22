<script lang="ts">
	import '$lib/styles/produzione.css';
	import ProdNav from '$lib/components/produzione/ProdNav.svelte';
	import FaseCard from '$lib/components/produzione/FaseCard.svelte';
	import { DEPARTMENTS } from '$lib/production/types';
	import { fmtMin, fmtWhen } from '$lib/production/format';
	let { data, form } = $props();
	const now = $derived(new Date(data.now));
	const mName = (id: string | null) => data.setup.machines.find((m) => m.id === id)?.name ?? null;
	const deps = Object.entries(DEPARTMENTS) as [string, { label: string; icon: string }][];
</script>

<svelte:head><title>{data.info.label} | Produzione</title></svelte:head>
<div class="pv-head"><div><h1>{data.info.icon} {data.info.label}</h1><p class="lead">Prima le fasi in corso, poi quelle da fare nell’ordine in cui conviene farle.</p></div><ProdNav /></div>
{#if form?.error}<p class="error">{form.error}</p>{/if}
<div class="tabs" style="margin-bottom:18px">{#each deps as [k, d] (k)}<a class:is-active={k === data.stage} href="/dashboard/produzione/reparto/{k}">{d.icon} {d.label}</a>{/each}</div>

<section class="rep">
	<h2 class="rep__title">▶ In corso <i>{data.running.length}</i></h2>
	{#each data.running as x (x.phase.id)}<FaseCard phase={x.phase} job={x.row.job} group={x.row.group} machineName={mName(x.phase.machine_id)} {now} />{:else}<p class="rep__empty">Nessuna fase avviata in questo reparto.</p>{/each}
</section>
<section class="rep">
	<h2 class="rep__title">📌 Da fare <i>{data.ready.length}</i><small>in ordine di urgenza</small></h2>
	{#each data.ready as x (x.phase.id)}<FaseCard phase={x.phase} job={x.row.job} group={x.row.group} machineName={mName(x.phase.machine_id)} {now} />{:else}<p class="rep__empty">Niente di pronto: tutto fermo alle fasi precedenti.</p>{/each}
</section>
{#if data.blocked.length}
	<section class="rep"><h2 class="rep__title">⚠ Bloccate <i>{data.blocked.length}</i></h2>
	{#each data.blocked as x (x.phase.id)}<FaseCard phase={x.phase} job={x.row.job} group={x.row.group} machineName={mName(x.phase.machine_id)} {now} />{/each}</section>
{/if}
{#if data.waiting.length || data.incoming.length}
	<section class="rep rep--soft">
		<h2 class="rep__title">🔜 In arrivo <i>{data.waiting.length + data.incoming.length}</i><small>quando finiscono le fasi prima, o il tempo di attesa</small></h2>
		<ul class="rep__list">
			{#each data.waiting as x (x.phase.id)}<li><b>{x.row.job.order_number}</b> {x.row.group.customer} · {x.phase.label} · ⏳ pronta {fmtWhen(x.phase.planned_end_at, now, data.setup.calendar)}</li>{/each}
			{#each data.incoming as x (x.phase.id)}<li><b>{x.row.job.order_number}</b> {x.row.group.customer} · {x.phase.label} · {fmtMin(x.phase.minutes)} · previsto {fmtWhen(x.phase.planned_start_at, now, data.setup.calendar)}{#if mName(x.phase.machine_id)} · {mName(x.phase.machine_id)}{/if}</li>{/each}
		</ul>
	</section>
{/if}
