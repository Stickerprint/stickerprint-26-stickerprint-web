<script lang="ts">
	/** Livello fedeltà: badge, barra di avanzamento e cosa serve per il prossimo livello */
	import { pct, type Loyalty } from '$lib/account';
	import { usaLingua } from '$lib/traduzioni';
	const { t, numero, data } = usaLingua();
	let { l, compact = false }: { l: Loyalty; compact?: boolean } = $props();
	const target = $derived(l.next ? l.next.points : l.keep_points);
	const progress = $derived(target > 0 ? Math.min(100, Math.round((l.period_points / target) * 100)) : 100);
	const missing = $derived(Math.max(0, target - l.period_points));
	/* telefono: l'elenco dei livelli resta chiuso finche' non lo si chiede */
	let showLevels = $state(false);
</script>

<div class="loy" class:loy--compact={compact}>
	<img class="loy__badge" src={l.img} alt="" />
	<div class="loy__body">
		<p class="eyebrow">{t('checkout.fedelta.tuoLivello')}</p>
		<h3 class="loy__name">{l.name} <small>{t('checkout.fedelta.guadagni', { pct: pct(l.credit_rate) })}</small></h3>
		<div class="loy__bar"><span style="width:{progress}%"></span></div>
		<p class="loy__msg">
			<!-- testi dal catalogo (mai da input utente): i grassetti sono nelle stringhe -->
			{#if l.next}
				{#if missing > 0}{@html t('checkout.fedelta.mancano', { n: numero(missing), livello: l.next.name, pct: pct(l.next.credit_rate) })}{:else}{@html t('checkout.fedelta.pronto', { livello: l.next.name })}{/if}
			{:else if missing > 0}
				{@html t('checkout.fedelta.mancanoConferma', { n: numero(missing), data: data(l.expires_at), livello: l.name })}
			{:else}
				{@html t('checkout.fedelta.confermato', { livello: l.name, data: data(l.expires_at) })}
			{/if}
			<small>{t('checkout.fedelta.periodo', { n: numero(l.period_points) })}</small>
		</p>
		{#if !compact}
			<button type="button" class="loy__more" aria-expanded={showLevels} onclick={() => (showLevels = !showLevels)}>{showLevels ? t('checkout.fedelta.nascondi') : t('checkout.fedelta.vedi')} <span aria-hidden="true">{showLevels ? '▴' : '▾'}</span></button>
			<div class="loy__levels" class:is-open={showLevels}>
				{#each l.levels as lv (lv.level)}
					<div class="loy__lv" class:is-current={lv.level === l.level}><img src={lv.img} alt="" /><b>{lv.name}</b><small>{t('checkout.fedelta.diCredito', { pct: pct(lv.credit_rate) })}</small>{#if lv.rank > 1}<small>{t('checkout.fedelta.perArrivarci', { n: numero(l.levels[lv.rank - 2]?.next_points ?? 0), k: numero(lv.keep_points) })}</small>{:else}<small>{t('checkout.fedelta.partenza')}</small>{/if}</div>
				{/each}
			</div>
		{/if}
	</div>
</div>
