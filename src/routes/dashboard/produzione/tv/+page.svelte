<script lang="ts">
	/**
	 * Modalita' TV: la produzione su uno schermo grande, senza bottoni. Si aggiorna da sola ogni 30 secondi.
	 * Tre colonne: macchinari (cosa fanno adesso e quando finiscono), prossimi avvii, ordini a rischio.
	 */
	import '$lib/styles/produzione.css';
	import { onMount } from 'svelte';
	import { invalidateAll } from '$app/navigation';
	import { fmtMin, fmtWhen, fmtTime } from '$lib/production/format';
	import { RISK } from '$lib/production/types';
	let { data } = $props();
	let clock = $state(new Date());
	onMount(() => {
		const t = setInterval(() => (clock = new Date()), 1000);
		const r = setInterval(() => invalidateAll(), 30000);
		document.documentElement.requestFullscreen?.().catch(() => {});
		return () => { clearInterval(t); clearInterval(r); };
	});
	const now = $derived(new Date(data.now));
	const cal = $derived(data.setup.calendar);
	const fDate = new Intl.DateTimeFormat('it-IT', { timeZone: 'Europe/Rome', weekday: 'long', day: 'numeric', month: 'long' });
	const fClock = new Intl.DateTimeFormat('it-IT', { timeZone: 'Europe/Rome', hour: '2-digit', minute: '2-digit', second: '2-digit' });
	const upcoming = $derived(data.queue.filter((r) => r.job.status === 'READY_TO_START' || (r.next && r.next.status === 'pronto')).slice(0, 7));
	const risky = $derived(data.queue.filter((r) => r.job.risk_status !== 'ON_TRACK').slice(0, 7));
	const machines = $derived(data.machines.filter((m) => m.state !== 'off'));
</script>

<svelte:head><title>Produzione · TV</title></svelte:head>
<div class="tv">
	<div class="tv__head">
		<div><h1>🏭 Produzione Stickerprint</h1><div class="tv__date">{fDate.format(clock)}</div></div>
		<div class="tv__kpis">
			<div class="tv__kpi is-warn"><b>{data.kpi.startToday}</b><span>da avviare oggi</span></div>
			<div class="tv__kpi is-ok"><b>{data.kpi.running}</b><span>in corso</span></div>
			<div class="tv__kpi"><b>{data.kpi.toPack}</b><span>da confezionare</span></div>
			<div class="tv__kpi is-hot"><b>{data.kpi.atRisk + data.kpi.late}</b><span>a rischio</span></div>
			<div class="tv__kpi is-blue"><b>{data.kpi.busyMachines}/{machines.length}</b><span>macchine al lavoro</span></div>
		</div>
		<div class="tv__clock">{fClock.format(clock)}</div>
	</div>
	<div class="tv__grid">
		<div class="tv__col">
			<h2>🛠 Macchinari <small>adesso</small></h2>
			<div class="tv__list">
				{#each machines as mv (mv.machine.id)}
					<div class="tv__mach is-{mv.state}">
						<b>{mv.machine.name}</b>
						<span class="tv__eta">{#if mv.current}fine {fmtTime(mv.current.phase.planned_end_at)}{:else}libera{/if}</span>
						<span class="tv__what">{#if mv.current}{mv.current.row.job.order_number} · {mv.current.phase.label} · {mv.current.row.group.customer}{:else if mv.next}prossimo: {mv.next.row.job.order_number} · {mv.next.phase.label} · {fmtWhen(mv.next.phase.planned_start_at, now, cal)}{:else}nessun lavoro in coda{/if}</span>
					</div>
				{/each}
			</div>
		</div>
		<div class="tv__col">
			<h2>▶ Prossimi avvii <small>ultimo avvio utile</small></h2>
			<div class="tv__list">
				{#each upcoming as r (r.job.id)}
					{@const rk = RISK[r.job.risk_status]}
					<div class="tv__job" style="--c:{rk.hex}">
						<b>{r.job.order_number}</b><span class="tv__risk">{rk.icon} {rk.label}</span><span class="tv__when">{fmtWhen(r.job.latest_start_at, now, cal)}</span>
						<span class="tv__sub">{r.next?.label ?? '—'}{#if r.next?.machine} · {r.next.machine}{/if} · {r.group.qty.toLocaleString('it-IT')} × {r.group.items[0].product_name} · spedizione {r.job.promised_ship_date.split('-').reverse().slice(0, 2).join('/')}</span>
					</div>
				{:else}<div class="tv__empty">Niente da avviare: tutto in lavorazione.</div>{/each}
			</div>
		</div>
		<div class="tv__col">
			<h2>🔴 A rischio <small>margine</small></h2>
			<div class="tv__list">
				{#each risky as r (r.job.id)}
					{@const rk = RISK[r.job.risk_status]}
					<div class="tv__job" style="--c:{rk.hex}">
						<b>{r.job.order_number}</b><span class="tv__risk">{rk.icon} {rk.label}</span><span class="tv__when">{r.job.predicted_delay_minutes > 0 ? `oltre di ${fmtMin(r.job.predicted_delay_minutes)}` : `margine ${fmtMin(r.job.slack_minutes ?? 0)}`}</span>
						<span class="tv__sub">{(r.current ?? r.next)?.label ?? '—'} · {r.group.customer} · spedizione {r.job.promised_ship_date.split('-').reverse().slice(0, 2).join('/')}</span>
					</div>
				{:else}<div class="tv__empty">🟢 Nessun ordine a rischio.</div>{/each}
			</div>
		</div>
	</div>
	<div class="tv__foot"><span>Aggiornamento automatico ogni 30 secondi · ultimo {fClock.format(now)}</span><span>Ritiro corriere alle {cal.ship_cutoff} · tutto pronto {cal.ship_margin_minutes} min prima</span></div>
</div>
