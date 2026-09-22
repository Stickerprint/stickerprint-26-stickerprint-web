<script lang="ts">
	import '$lib/styles/produzione.css';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { enhance } from '$app/forms';
	import ProdNav from '$lib/components/produzione/ProdNav.svelte';
	import RiskChip from '$lib/components/produzione/RiskChip.svelte';
	import PhaseBar from '$lib/components/produzione/PhaseBar.svelte';
	import { fmtMin, fmtWhen } from '$lib/production/format';
	import { JOB_LABEL, RISK, DEPARTMENTS } from '$lib/production/types';
	import { thumbOf } from '$lib/dashboard/orders';
	let { data, form } = $props();
	const now = $derived(new Date(data.now));
	const cal = $derived(data.setup.calendar);
	const FILTERS = [['tutti', 'Tutti'], ['da-avviare', 'Da avviare'], ['in-corso', 'In corso'], ['da-confezionare', 'Da confezionare'], ['a-rischio', 'A rischio'], ['completati', 'Completati']] as const;
	const f = $derived(page.url.searchParams.get('f') ?? 'tutti');
	let q = $state('');
	const match = (r: { job: { order_number: string }; group: { customer: string; email: string } }) => { const s = q.trim().toLowerCase(); return !s || r.job.order_number.toLowerCase().includes(s) || r.group.customer.toLowerCase().includes(s) || r.group.email.toLowerCase().includes(s); };
	const list = $derived(data.queue.filter((r) => {
		if (f === 'da-avviare') return r.job.status === 'READY_TO_START';
		if (f === 'in-corso') return ['IN_PROGRESS', 'WAITING_PASSIVE_TIME', 'PACKAGING'].includes(r.job.status);
		if (f === 'da-confezionare') return r.job.status === 'READY_FOR_PACKAGING' || r.job.status === 'PACKAGING';
		if (f === 'a-rischio') return r.job.risk_status !== 'ON_TRACK';
		return true;
	}).filter(match));
	const done = $derived(data.done.filter(match));
	const dmy = (d: string) => d.split('-').reverse().join('/');
</script>

<svelte:head><title>Coda ordini | Produzione</title></svelte:head>
<div class="pv-head"><div><h1>📋 Coda ordini</h1><p class="lead">Ordinati per urgenza: prima i ritardi, poi chi rischia, poi chi ha l'ultimo avvio utile più vicino.</p></div><ProdNav /></div>
{#if form?.error}<p class="error">{form.error}</p>{/if}
<div class="pv-filters">
	<div class="tabs">{#each FILTERS as [k, l] (k)}<button type="button" class:is-active={f === k} onclick={() => goto(`?f=${k}`, { keepFocus: true, noScroll: true })}>{l}{#if k !== 'completati'} <span class="osub">{k === 'tutti' ? data.queue.length : data.queue.filter((r) => (k === 'da-avviare' ? r.job.status === 'READY_TO_START' : k === 'in-corso' ? ['IN_PROGRESS', 'WAITING_PASSIVE_TIME', 'PACKAGING'].includes(r.job.status) : k === 'da-confezionare' ? ['READY_FOR_PACKAGING', 'PACKAGING'].includes(r.job.status) : r.job.risk_status !== 'ON_TRACK')).length}</span>{/if}</button>{/each}</div>
	<input placeholder="Cerca numero ordine o cliente…" bind:value={q} />
</div>

{#if f === 'completati'}
	{#each done as r (r.job.id)}
		<a class="qrow" href="/dashboard/produzione/commessa/{r.job.id}" style="--c:#9ca3af;grid-template-columns:56px minmax(0,1.4fr) minmax(0,1fr) 150px 150px">
			{#if thumbOf(r.group.items[0])}<img class="qrow__thumb" src={thumbOf(r.group.items[0])} alt="" />{:else}<span class="qrow__thumb"></span>{/if}
			<div><span class="qrow__num">{r.job.order_number}</span> <span class="jstate jstate--{r.job.status}">{JOB_LABEL[r.job.status]}</span><div class="qrow__sub">{r.group.customer}</div></div>
			<div class="qrow__sub">{r.group.qty.toLocaleString('it-IT')} × {r.group.items[0].product_name}</div>
			<div><span class="qrow__lbl">Spedizione promessa</span><b>{dmy(r.job.promised_ship_date)}</b></div>
			<div><span class="qrow__lbl">{r.job.status === 'CANCELLED' ? 'Annullata' : 'Completata'}</span><b>{fmtWhen(r.job.completed_at ?? r.job.cancelled_at, now, cal)}</b></div>
		</a>
	{:else}<p class="osub">Nessuna commessa completata.</p>{/each}
{:else}
	<div class="qrow__head"><span></span><span>Ordine · cliente · avanzamento</span><span>Prodotto · protezione</span><span>Spedizione promessa</span><span>Avvia entro · margine</span><span>Fase · macchinario</span><span>Stato</span></div>
	{#each list as r (r.job.id)}
		{@const rk = RISK[r.job.risk_status]}
		{@const ph = r.current ?? r.next}
		<div class="qrow" style="--c:{rk.hex}">
			{#if thumbOf(r.group.items[0])}<img class="qrow__thumb" src={thumbOf(r.group.items[0])} alt="" />{:else}<span class="qrow__thumb"></span>{/if}
			<div>
				<a class="qrow__num" href="/dashboard/produzione/commessa/{r.job.id}">{r.job.order_number}</a> <span class="jstate jstate--{r.job.status}">{JOB_LABEL[r.job.status]}</span>
				<div class="qrow__sub">{r.group.customer}</div>
				<div style="margin-top:6px"><PhaseBar phases={r.phases} /></div>
			</div>
			<div><b>{r.group.qty.toLocaleString('it-IT')} × {r.group.items[0].product_name}</b><div class="qrow__sub">{r.laminated ? `🧴 lamina ${r.protection}` : '⛔ zero protezione'} · tempo totale {fmtMin(r.job.total_minutes)}</div></div>
			<div><b class="qrow__big">{dmy(r.job.promised_ship_date)}</b><div class="qrow__sub">🔒 non modificabile</div></div>
			<div><b class="qrow__big" style="color:{rk.hex}">{fmtWhen(r.job.latest_start_at, now, cal)}</b><div class="qrow__sub">{r.job.predicted_delay_minutes > 0 ? `oltre di ${fmtMin(r.job.predicted_delay_minutes)}` : `margine ${fmtMin(r.job.slack_minutes ?? 0)}`}</div></div>
			<div>{#if ph}<b>{ph.seq}. {ph.label}</b><div class="qrow__sub">{DEPARTMENTS[ph.stage]?.icon} {ph.machine ?? DEPARTMENTS[ph.stage]?.label}</div>{:else}<span class="osub">—</span>{/if}</div>
			<div style="display:grid;gap:6px;justify-items:start">
				<RiskChip risk={r.job.risk_status} />
				{#if r.job.status === 'READY_TO_START'}<form method="POST" action="?/avvia" use:enhance><input type="hidden" name="job" value={r.job.id} /><button class="btn btn--green btn--xs" type="submit">▶ Avvia</button></form>{/if}
			</div>
		</div>
	{:else}<p class="osub" style="padding:20px">Nessun ordine con questo filtro.</p>{/each}
{/if}
