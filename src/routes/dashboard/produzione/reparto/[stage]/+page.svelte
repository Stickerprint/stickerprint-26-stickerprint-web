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
<div class="pv-head"><div><h1>{data.info.icon} {data.info.label}</h1><p class="lead">Il lavoro da fare adesso, nell'ordine giusto. In cima c'è la fase con l'ultimo avvio utile più vicino.</p></div><ProdNav /></div>
{#if form?.error}<p class="error">{form.error}</p>{/if}
<div class="tabs" style="margin-bottom:14px">{#each deps as [k, d] (k)}<a class="btn btn--ghost btn--xs" class:btn--blue={k === data.stage} href="/dashboard/produzione/reparto/{k}">{d.icon} {d.label}</a>{/each}</div>

{#if data.running.length}
	<h3>▶ In lavorazione adesso <small class="osub">({data.running.length})</small></h3>
	{#each data.running as x (x.phase.id)}<FaseCard phase={x.phase} job={x.row.job} group={x.row.group} machineName={mName(x.phase.machine_id)} {now} />{/each}
{/if}
<h3 style="margin-top:14px">📌 Da fare <small class="osub">({data.ready.length}, in ordine di urgenza)</small></h3>
{#each data.ready as x (x.phase.id)}<FaseCard phase={x.phase} job={x.row.job} group={x.row.group} machineName={mName(x.phase.machine_id)} {now} />{:else}<p class="osub">Niente di pronto per questo reparto.</p>{/each}
{#if data.blocked.length}
	<h3 style="margin-top:14px">⚠ Bloccate <small class="osub">({data.blocked.length})</small></h3>
	{#each data.blocked as x (x.phase.id)}<FaseCard phase={x.phase} job={x.row.job} group={x.row.group} machineName={mName(x.phase.machine_id)} {now} />{/each}
{/if}
{#if data.waiting.length}
	<h3 style="margin-top:14px">⏳ In attesa (tempo passivo) <small class="osub">({data.waiting.length})</small></h3>
	{#each data.waiting as x (x.phase.id)}<p class="osub">{x.row.job.order_number} · {x.phase.label} · pronta {fmtWhen(x.phase.planned_end_at, now, data.setup.calendar)}</p>{/each}
{/if}
{#if data.incoming.length}
	<h3 style="margin-top:14px">🔜 In arrivo dalle fasi precedenti <small class="osub">({data.incoming.length})</small></h3>
	{#each data.incoming as x (x.phase.id)}<p class="osub" style="padding:4px 0;border-top:1px solid var(--line)"><b>{x.row.job.order_number}</b> · {x.phase.label} · {x.row.group.customer} · {fmtMin(x.phase.minutes)} · previsto {fmtWhen(x.phase.planned_start_at, now, data.setup.calendar)}{#if mName(x.phase.machine_id)} · {mName(x.phase.machine_id)}{/if}</p>{/each}
{/if}
