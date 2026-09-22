<script lang="ts">
	import '$lib/styles/produzione.css';
	import ProdNav from '$lib/components/produzione/ProdNav.svelte';
	import { fmtMin, fmtWhen } from '$lib/production/format';
	import { MACHINE_TYPES } from '$lib/production/types';
	let { data } = $props();
	const now = $derived(new Date(data.now));
	const cal = $derived(data.setup.calendar);
</script>
<svelte:head><title>Macchinari | Produzione</title></svelte:head>
<div class="pv-head"><div><h1>🛠 Macchinari</h1><p class="lead">Cosa sta facendo ogni macchina, quando finisce, cosa viene dopo e quanto è carica oggi. Nessun dato sui materiali. <a class="link" href="/dashboard/setup/macchinari">Configurazione ›</a></p></div><ProdNav /></div>
<div class="mach-grid">
	{#each data.machines as mv (mv.machine.id)}
		<div class="mach is-{mv.state}">
			<div class="mach__head"><div><b>{mv.machine.name}</b><div class="osub">{MACHINE_TYPES[mv.machine.machine_type]?.label ?? mv.machine.machine_type}{#if mv.machine.usable_width_mm} · {mv.machine.usable_width_mm} mm{/if}</div></div><span class="mach__state">{mv.state === 'busy' ? '● In lavorazione' : mv.state === 'free' ? '○ Libera' : 'Disattivata'}</span></div>
			{#if mv.current}
				<div class="mach__cur"><b>{mv.current.row.job.order_number} · {mv.current.phase.label}</b>{mv.current.row.group.customer} · {mv.current.row.group.qty.toLocaleString('it-IT')} pz<br />conclusione prevista <b>{fmtWhen(mv.current.phase.planned_end_at, now, cal)}</b></div>
			{:else}<div class="mach__cur" style="color:var(--muted)">Nessuna lavorazione in corso</div>{/if}
			<div class="mach__next">{#if mv.next}<b>Prossimo:</b> {mv.next.row.job.order_number} · {mv.next.phase.label} · {fmtWhen(mv.next.phase.planned_start_at, now, cal)}{:else}Nessun lavoro in coda{/if}</div>
			<div class="mach__load" title="Carico pianificato per oggi"><i style="width:{mv.loadPct}%"></i></div>
			<div class="mach__next">Carico di oggi: <b>{fmtMin(mv.loadMinutes)}</b> ({mv.loadPct}%) · {mv.queueCount} {mv.queueCount === 1 ? 'lavorazione' : 'lavorazioni'} in coda</div>
		</div>
	{/each}
</div>
