<script lang="ts">
	/**
	 * Barra dei mesi come nella pagina Ordini: una cella per mese con conteggio e importo, "Preced." e "Succ." per
	 * quello che cade fuori dall'anno scelto. `month` e' bindable: null = tutti i mesi, '0'..'11' = mese, 'prev'/'next'.
	 */
	import { MONTHS, money, monthKey } from '$lib/dashboard/orders';
	let { month = $bindable<string | null>(null), year, items, dateOf, amountOf, unit = 'doc.' }: { month?: string | null; year: number; items: unknown[]; dateOf: (x: never) => string; amountOf: (x: never) => number; unit?: string } = $props();
	const buckets = $derived.by(() => {
		const b: Record<string, { n: number; amt: number }> = { prev: { n: 0, amt: 0 }, next: { n: 0, amt: 0 } };
		for (let m = 0; m < 12; m++) b[m] = { n: 0, amt: 0 };
		for (const x of items) { const k = monthKey(dateOf(x as never), year); b[k].n++; b[k].amt += amountOf(x as never); }
		return b;
	});
</script>

<div class="month-bar">
	<div class="month-cells">
		{#each [['prev', 'Preced.'], ...MONTHS.map((m, i) => [String(i), m]), ['next', 'Succ.']] as [k, label] (k)}
			<button type="button" class="month-cell" class:has-data={buckets[k].n > 0} class:is-active={month === k} class:is-current={year === new Date().getFullYear() && k === String(new Date().getMonth())} onclick={() => (month = month === k ? null : k)}>
				<span class="mc-label">{label}</span><span class="mc-doc">{buckets[k].n} {unit}</span><span class="mc-amt">{money(buckets[k].amt)}</span>
			</button>
		{/each}
	</div>
	<button type="button" class="btn btn--xs {month === null ? 'btn--blue' : 'btn--ghost'}" onclick={() => (month = null)}>Tutti i mesi</button>
</div>
