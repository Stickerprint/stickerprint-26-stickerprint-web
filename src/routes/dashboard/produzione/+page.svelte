<script lang="ts">
	import '$lib/styles/produzione.css';
	import { enhance } from '$app/forms';
	import ProdNav from '$lib/components/produzione/ProdNav.svelte';
	import RiskChip from '$lib/components/produzione/RiskChip.svelte';
	import PhaseBar from '$lib/components/produzione/PhaseBar.svelte';
	import { fmtMin, fmtWhen, fmtDay } from '$lib/production/format';
	import { DEPARTMENTS, JOB_LABEL, RISK } from '$lib/production/types';
	import { thumbOf } from '$lib/dashboard/orders';
	let { data, form } = $props();
	const now = $derived(new Date(data.now));
	const cal = $derived(data.setup.calendar);
	// in cima: cosa va avviato (ultimo avvio utile piu' vicino), poi tutto il resto nell'ordine della coda
	const urgent = $derived(data.queue.filter((r) => r.job.status !== 'COMPLETED').slice(0, 8));
	const unconfigured = $derived(data.setup.machines.filter((m) => m.is_active && !m.archived_at && m.sqm_per_hour == null && m.minutes_per_sqm == null && m.minutes_per_piece == null && m.pieces_per_hour == null));
</script>

<svelte:head><title>Produzione | Dashboard</title></svelte:head>
<div class="pv-head"><div><h1>🏭 Produzione</h1><p class="lead">Cosa avviare adesso, cosa è in corso, cosa rischia. Finita l'ultima lavorazione l'ordine passa da solo in Spedizioni. Le date promesse ai clienti non si toccano.</p></div><ProdNav /></div>
{#if form?.error}<p class="error">{form.error}</p>{/if}
{#if unconfigured.length}<p class="note" style="background:#fef6db;padding:10px 14px;border-radius:12px;margin-bottom:12px">⚙️ Velocità <b>da configurare</b> per: {unconfigured.map((m) => m.name).join(', ')}. Finché mancano, le durate sono di riserva. <a class="link" href="/dashboard/setup/macchinari">Setup → Macchinari</a></p>{/if}

<div class="pv-kpis">
	<a class="pv-kpi is-blue" href="/dashboard/produzione/coda?f=tutti"><b>{data.kpi.paidToday}</b><span>Ordini pagati oggi</span></a>
	<a class="pv-kpi is-warn" href="/dashboard/produzione/coda?f=da-avviare"><b>{data.kpi.startToday}</b><span>Da avviare oggi</span></a>
	<a class="pv-kpi is-ok" href="/dashboard/produzione/coda?f=in-corso"><b>{data.kpi.running}</b><span>In corso</span></a>
	<a class="pv-kpi" href="/dashboard/produzione/spedizioni"><b>{data.kpi.doneToday}</b><span>Finiti oggi → spedizioni</span></a>
	<a class="pv-kpi is-hot" href="/dashboard/produzione/coda?f=a-rischio"><b>{data.kpi.atRisk + data.kpi.late}</b><span>A rischio o in ritardo</span></a>
	<a class="pv-kpi" href="/dashboard/produzione/macchinari"><b>{data.kpi.busyMachines}<small style="font-size:16px;color:var(--muted)">/{data.machines.filter((m) => m.state !== 'off').length}</small></b><span>Macchinari occupati</span></a>
</div>

<div class="grid3" style="grid-template-columns:1.3fr 1fr;margin-top:16px;align-items:start">
	<div class="dcard">
		<h3>Adesso: gli ordini in cima alla coda <a class="link" style="font-size:13px;float:right" href="/dashboard/produzione/coda">Tutta la coda ›</a></h3>
		{#if urgent.length === 0}<p class="osub">Nessuna commessa aperta.</p>{/if}
		{#each urgent as r (r.job.id)}
			{@const rk = RISK[r.job.risk_status]}
			<div class="qrow" style="--c:{rk.hex};grid-template-columns:56px minmax(0,1.4fr) 150px 170px auto">
				{#if thumbOf(r.group.items[0])}<img class="qrow__thumb" src={thumbOf(r.group.items[0])} alt="" />{:else}<span class="qrow__thumb"></span>{/if}
				<div>
					<a class="qrow__num" href="/dashboard/produzione/commessa/{r.job.id}">{r.job.order_number}</a> <span class="jstate jstate--{r.job.status}">{JOB_LABEL[r.job.status]}</span>
					<div class="qrow__sub">{r.group.customer} · {r.group.qty.toLocaleString('it-IT')} × {r.group.items[0].product_name}</div>
					<div style="margin-top:6px"><PhaseBar phases={r.phases} /></div>
				</div>
				<div><span class="qrow__lbl">{r.current ? 'In corso' : 'Prossima fase'}</span><b>{(r.current ?? r.next)?.label ?? '—'}</b><div class="qrow__sub">{DEPARTMENTS[(r.current ?? r.next)?.stage ?? 'stampa']?.label}</div></div>
				<div><span class="qrow__lbl">Avvia entro</span><b class="qrow__big">{fmtWhen(r.job.latest_start_at, now, cal)}</b><div class="qrow__sub">margine {r.job.slack_minutes != null ? fmtMin(r.job.slack_minutes) : '—'}</div></div>
				<div style="display:grid;gap:6px;justify-items:end">
					<RiskChip risk={r.job.risk_status} />
					{#if r.job.status === 'READY_TO_START'}<form method="POST" action="?/avvia" use:enhance><input type="hidden" name="job" value={r.job.id} /><button class="btn btn--green btn--xs" type="submit">▶ Avvia</button></form>{/if}
				</div>
			</div>
		{/each}
	</div>
	<div class="dcard">
		<h3>Macchinari <a class="link" style="font-size:13px;float:right" href="/dashboard/produzione/macchinari">Vista completa ›</a></h3>
		<div style="display:grid;gap:8px">
			{#each data.machines as mv (mv.machine.id)}
				<div class="mach mach--row is-{mv.state}" style="padding:10px 14px;gap:4px">
					<div class="mach__head"><b>{mv.machine.name}</b><span class="mach__state">{mv.state === 'busy' ? 'In lavorazione' : mv.state === 'free' ? 'Libera' : 'Disattivata'}</span></div>
					{#if mv.current}<div class="mach__cur" style="padding:6px 10px"><b>{mv.current.row.job.order_number} · {mv.current.phase.label}</b>fine prevista {fmtWhen(mv.current.phase.planned_end_at, now, cal)}</div>
					{:else if mv.next}<div class="mach__next">prossimo: {mv.next.row.job.order_number} · {mv.next.phase.label} · {fmtWhen(mv.next.phase.planned_start_at, now, cal)}</div>{/if}
					<div class="mach__load" title="Carico pianificato oggi"><i style="width:{mv.loadPct}%"></i></div>
					<div class="mach__next">oggi {fmtMin(mv.loadMinutes)} · {mv.queueCount} in coda</div>
				</div>
			{/each}
		</div>
	</div>
</div>
<p class="osub" style="margin-top:14px">Spedizione: ritiro alle {cal.ship_cutoff}, tutto deve essere pronto entro {cal.ship_margin_minutes} min prima. Oggi è {fmtDay(data.today, now, cal)}. <a class="link" href="/dashboard/setup/calendario">Calendario di lavoro</a></p>
