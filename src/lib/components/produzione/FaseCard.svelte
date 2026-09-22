<script lang="ts">
	/**
	 * Una fase di lavoro come la vede l'operatore: cosa fare, per quale ordine, su quale macchina, entro quando.
	 * Grande e leggibile; con `tv` diventa ancora piu' grande e senza bottoni.
	 */
	import { enhance } from '$app/forms';
	import { thumbOf, itemMeta } from '$lib/dashboard/orders';
	import { fmtMin, fmtWhen } from '$lib/production/format';
	import { DEPARTMENTS, PHASE_LABEL, RISK, type Job, type Phase } from '$lib/production/types';
	import type { OrderGroup } from '$lib/dashboard/orders';
	let { phase, job, group, machineName = null, tv = false, showStage = false, canAct = true, now = new Date() }: { phase: Phase; job: Job; group: OrderGroup; machineName?: string | null; tv?: boolean; showStage?: boolean; canAct?: boolean; now?: Date } = $props();
	const item = $derived(group.items.find((i) => i.id === phase.order_id) ?? group.items[0]);
	const r = $derived(RISK[job.risk_status]);
	const thumb = $derived(thumbOf(item));
	const late = $derived(!!phase.latest_start_at && new Date(phase.latest_start_at) < now && phase.status !== 'completato');
	let busy = $state(false);
</script>

<div class="fase" class:fase--tv={tv} class:is-running={phase.status === 'in_corso'} class:is-blocked={phase.status === 'bloccato'} style="--c:{r.hex};--cs:{r.soft}">
	<div class="fase__thumb">{#if thumb}<img src={thumb} alt="" />{:else}<span class="fase__ph">📄</span>{/if}</div>
	<div class="fase__body">
		<div class="fase__top">
			<span class="fase__risk" title={r.label}>{r.icon} {r.label}</span>
			<a class="fase__num" href="/dashboard/produzione/commessa/{job.id}">{job.order_number}</a>
			{#if showStage}<span class="fase__stage">{DEPARTMENTS[phase.stage]?.icon} {DEPARTMENTS[phase.stage]?.label}</span>{/if}
			<span class="fase__status" class:is-on={phase.status === 'in_corso'}>{PHASE_LABEL[phase.status]}</span>
		</div>
		<div class="fase__what"><b>{phase.label}</b> · {group.customer}</div>
		<div class="fase__sub">{item.qty.toLocaleString('it-IT')} × {item.product_name}{#if itemMeta(item)} · {itemMeta(item)}{/if}</div>
		<div class="fase__facts">
			{#if machineName}<span>🛠 {machineName}</span>{/if}
			<span>⏱ {phase.passive ? `${fmtMin(phase.wait_minutes)} di attesa` : fmtMin(phase.minutes)}</span>
			<span class:is-late={late}>🕒 {late ? 'avvio previsto superato' : `avvia entro ${fmtWhen(phase.latest_start_at, now)}`}</span>
			<span>🔒 spedizione {job.promised_ship_date.split('-').reverse().join('/')}</span>
		</div>
		{#if phase.block_reason}<div class="fase__block">⚠ {phase.block_reason}</div>{/if}
	</div>
	{#if canAct && !tv}
		<div class="fase__actions">
			{#if phase.status === 'pronto' || phase.status === 'bloccato'}
				<form method="POST" action="?/inizia" use:enhance={() => { busy = true; return async ({ update }) => { busy = false; await update(); }; }}><input type="hidden" name="task" value={phase.id} /><button class="btn btn--green" type="submit" disabled={busy}>▶ Avvia fase</button></form>
			{:else if phase.status === 'in_corso'}
				<form method="POST" action="?/completa" use:enhance={() => { busy = true; return async ({ update }) => { busy = false; await update(); }; }}><input type="hidden" name="task" value={phase.id} /><button class="btn btn--blue" type="submit" disabled={busy}>✓ Termina fase</button></form>
			{/if}
			{#if phase.status === 'in_corso' || phase.status === 'pronto'}
				<details class="fase__more"><summary>Problema</summary>
					<form method="POST" action="?/blocca" use:enhance class="fase__block-form"><input type="hidden" name="task" value={phase.id} /><input name="motivo" placeholder="Cosa blocca la fase?" required /><button class="btn btn--ghost btn--xs" type="submit">Blocca</button></form>
				</details>
			{/if}
		</div>
	{/if}
</div>
