<script lang="ts">
	/** Una lavorazione in coda: colore di rischio, commessa, prodotto, macchina, tempo previsto, scadenza, azioni */
	import { CATS, itemMeta, thumbOf } from '$lib/dashboard/orders';
	import { COLOURS, fmtMin, fmtWhen, STAGES, TASK_STATUS, TIERS, type Planned } from '$lib/dashboard/produzione';
	import TaskActions from './TaskActions.svelte';
	let { p, showStage = false, actions = true }: { p: Planned; showStage?: boolean; actions?: boolean } = $props();
	const t = $derived(p.task);
	const o = $derived(p.task.order);
	const c = $derived(COLOURS[p.risk.colour]);
	const thumb = $derived(thumbOf(o));
</script>

<div class="pr-card" style="--c:{c.hex};--cs:{c.soft}">
	<div class="pr-card__thumb">{#if thumb}<img src={thumb} alt="" />{:else}<span class="ph"></span>{/if}</div>
	<div class="pr-card__body">
		<div class="pr-card__top">
			<span class="pr-dot" title={c.label}></span>
			<a class="pr-num" href="/dashboard/produzione/commessa/{t.id ? o.id : o.id}">{o.number}</a>
			{#if showStage}<span class="pr-stage">{STAGES[t.stage]?.icon} {STAGES[t.stage]?.label}</span>{/if}
			<b class="pr-label">{t.label}</b>
			<span class="pr-tier pr-tier--{p.tier}">{TIERS[p.tier]}</span>
			{#if o.express}<span class="pr-chip pr-chip--express">⚡ express</span>{/if}
			{#if (o.reprints ?? 0) > 0}<span class="pr-chip">↻ ristampa {o.reprints}</span>{/if}
		</div>
		<div class="pr-card__meta">
			<b>{o.qty.toLocaleString('it-IT')} × {o.product_name}</b>
			<span class="cat" style="background:{CATS[o.product_slug]?.soft};color:{CATS[o.product_slug]?.color}">{CATS[o.product_slug]?.name ?? o.product_slug}</span>
			{#if itemMeta(o)}<span class="osub">{itemMeta(o)}</span>{/if}
		</div>
		<div class="pr-card__facts">
			<span title="Macchina o banco">⚙️ {t.machine ?? '—'}</span>
			<span title="Tempo previsto">⏱ {t.wait_minutes && !t.minutes ? `${fmtMin(t.wait_minutes)} di attesa` : fmtMin(t.minutes)}</span>
			<span title="Scadenza della fase" class:is-late={p.risk.late}>🎯 {fmtWhen(t.due_at)}</span>
			{#if o.ship_by}<span title="Spedizione promessa">🚚 {fmtWhen(p.risk.cutoff)}</span>{/if}
			<span class="pr-status pr-status--{t.status}">{TASK_STATUS[t.status]}{#if t.operator && t.status === 'in_corso'} · {t.operator}{/if}</span>
		</div>
		{#if t.status === 'bloccato' && t.block_reason}<div class="pr-reason">⚠ {t.block_reason}</div>{/if}
		{#if o.notes}<div class="osub">📝 {o.notes}</div>{/if}
	</div>
	{#if actions}<TaskActions task={t} />{/if}
</div>
