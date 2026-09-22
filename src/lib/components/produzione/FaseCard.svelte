<script lang="ts">
	/**
	 * Una fase di lavoro come la vede l'operatore: che ordine, cosa fare, con che macchina, entro quando. Un solo bottone.
	 * Con `tv` diventa piu' grande e senza bottoni.
	 */
	import { enhance } from '$app/forms';
	import { thumbOf, itemMeta } from '$lib/dashboard/orders';
	import { fmtMin, fmtWhen } from '$lib/production/format';
	import { DEPARTMENTS, RISK, type Job, type Phase } from '$lib/production/types';
	import type { OrderGroup } from '$lib/dashboard/orders';
	let { phase, job, group, machineName = null, tv = false, showStage = false, canAct = true, now = new Date() }: { phase: Phase; job: Job; group: OrderGroup; machineName?: string | null; tv?: boolean; showStage?: boolean; canAct?: boolean; now?: Date } = $props();
	const item = $derived(group.items.find((i) => i.id === phase.order_id) ?? group.items[0]);
	const r = $derived(RISK[job.risk_status]);
	const thumb = $derived(thumbOf(item));
	const late = $derived(!!phase.latest_start_at && new Date(phase.latest_start_at) < now && phase.status !== 'completato' && phase.status !== 'in_corso');
	const dmy = (d: string) => d.split('-').reverse().join('/');
	let busy = $state(false);
	let problem = $state(false);
</script>

<article class="fase" class:fase--tv={tv} class:is-running={phase.status === 'in_corso'} class:is-blocked={phase.status === 'bloccato'} style="--c:{r.hex};--cs:{r.soft}">
	<div class="fase__thumb">{#if thumb}<img src={thumb} alt="" />{:else}<span class="fase__ph">📄</span>{/if}</div>
	<div class="fase__body">
		<div class="fase__head">
			<a class="fase__num" href="/dashboard/produzione/commessa/{job.id}">{job.order_number}</a>
			<span class="fase__cust">{group.customer}</span>
			{#if showStage}<span class="fase__stage">{DEPARTMENTS[phase.stage]?.icon} {DEPARTMENTS[phase.stage]?.label}</span>{/if}
			{#if job.risk_status !== 'ON_TRACK'}<span class="fase__risk">{r.icon} {r.label}</span>{/if}
		</div>
		<div class="fase__what">{phase.label}{#if phase.seq > 1 || true} <small>fase {phase.seq}</small>{/if}</div>
		<div class="fase__item">{item.qty.toLocaleString('it-IT')} × {item.product_name}{#if itemMeta(item)} · {itemMeta(item)}{/if}</div>
		{#if phase.block_reason}<div class="fase__block">⚠ {phase.block_reason}</div>{/if}
	</div>
	<div class="fase__facts">
		{#if machineName}<span class="fase__fact"><small>macchina</small><b>{machineName}</b></span>{/if}
		<span class="fase__fact"><small>{phase.passive ? 'attesa' : 'tempo'}</small><b>{fmtMin(phase.passive ? phase.wait_minutes : phase.minutes)}</b></span>
		<span class="fase__fact" class:is-late={late}><small>{phase.status === 'in_corso' ? 'finire entro' : 'avviare entro'}</small><b>{fmtWhen(phase.status === 'in_corso' ? phase.due_at : phase.latest_start_at, now)}</b></span>
		<span class="fase__fact"><small>spedizione</small><b>{dmy(job.promised_ship_date)}</b></span>
	</div>
	{#if canAct && !tv}
		<div class="fase__actions">
			{#if phase.status === 'pronto' || phase.status === 'bloccato'}
				<form method="POST" action="?/inizia" use:enhance={() => { busy = true; return async ({ update }) => { busy = false; await update(); }; }}><input type="hidden" name="task" value={phase.id} /><button class="btn btn--green" type="submit" disabled={busy}>▶ Avvia</button></form>
			{:else if phase.status === 'in_corso'}
				<form method="POST" action="?/completa" use:enhance={() => { busy = true; return async ({ update }) => { busy = false; await update(); }; }}><input type="hidden" name="task" value={phase.id} /><button class="btn btn--blue" type="submit" disabled={busy}>✓ Fatta</button></form>
			{/if}
			{#if phase.status === 'in_corso' || phase.status === 'pronto'}
				<button type="button" class="fase__problem" onclick={() => (problem = !problem)}>{problem ? 'annulla' : 'segnala un problema'}</button>
				{#if problem}<form method="POST" action="?/blocca" use:enhance class="fase__block-form"><input type="hidden" name="task" value={phase.id} /><input name="motivo" placeholder="Cosa blocca la fase?" required /><button class="btn btn--ghost btn--xs" type="submit">Blocca</button></form>{/if}
			{/if}
		</div>
	{/if}
</article>
