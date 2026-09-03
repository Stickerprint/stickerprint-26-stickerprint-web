<script lang="ts">
	/** Livello fedeltà: badge, barra di avanzamento e cosa serve per il prossimo livello */
	import { pct, dateIt, type Loyalty } from '$lib/account';
	let { l, compact = false }: { l: Loyalty; compact?: boolean } = $props();
	const target = $derived(l.next ? l.next.points : l.keep_points);
	const progress = $derived(target > 0 ? Math.min(100, Math.round((l.period_points / target) * 100)) : 100);
	const missing = $derived(Math.max(0, target - l.period_points));
</script>

<div class="loy" class:loy--compact={compact}>
	<img class="loy__badge" src={l.img} alt="" />
	<div class="loy__body">
		<p class="eyebrow">Il tuo livello</p>
		<h3 class="loy__name">{l.name} <small>· guadagni il {pct(l.credit_rate)} in credito su ogni ordine</small></h3>
		<div class="loy__bar"><span style="width:{progress}%"></span></div>
		<p class="loy__msg">
			{#if l.next}
				{#if missing > 0}Ti mancano <b>{missing.toLocaleString('it-IT')} SP</b> per diventare <b>{l.next.name}</b> e guadagnare il {pct(l.next.credit_rate)}.{:else}Sei pronto per diventare <b>{l.next.name}</b>!{/if}
			{:else if missing > 0}
				Ti mancano <b>{missing.toLocaleString('it-IT')} SP</b> entro il {dateIt(l.expires_at, true)} per confermare <b>{l.name}</b> anche il prossimo anno.
			{:else}
				Livello <b>{l.name}</b> confermato fino al {dateIt(l.expires_at, true)}. Sei al massimo!
			{/if}
			<small>{l.period_points.toLocaleString('it-IT')} SP in questo periodo · 1 SP per ogni euro netto speso (campioni esclusi)</small>
		</p>
		{#if !compact}
			<div class="loy__levels">
				{#each l.levels as lv (lv.level)}
					<div class="loy__lv" class:is-current={lv.level === l.level}><img src={lv.img} alt="" /><b>{lv.name}</b><small>{pct(lv.credit_rate)} di credito</small>{#if lv.rank > 1}<small>{(l.levels[lv.rank - 2]?.next_points ?? 0).toLocaleString('it-IT')} SP per arrivarci · {lv.keep_points.toLocaleString('it-IT')} SP l’anno per restare</small>{:else}<small>livello di partenza</small>{/if}</div>
				{/each}
			</div>
		{/if}
	</div>
</div>
