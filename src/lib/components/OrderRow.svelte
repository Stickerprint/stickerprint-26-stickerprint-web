<script lang="ts">
	import { customerStatus, trackSteps, MATERIAL_LABEL, eur, dateIt, fmtMm, type Order } from '$lib/account';
	let { o, onreorder }: { o: Order; onreorder: (o: Order) => void } = $props();
	const initials = $derived(o.product_name.split(/\s+/).map((s) => s[0]).join('').slice(0, 3).toUpperCase());
</script>

<div class="orow">
	<div class="orow__thumb">{#if o.preview_url}<img src={o.preview_url} alt="" />{:else}{initials}{/if}</div>
	<div>
		<div class="orow__meta">Ordine {o.number} · {dateIt(o.created_at, true)}</div>
		<div class="orow__title">{o.product_name}</div>
		<div class="orow__spec">{o.qty.toLocaleString('it-IT')} pz{#if o.materiale} · {MATERIAL_LABEL[o.materiale] ?? o.materiale}{/if}{#if o.width_mm && o.height_mm} · {fmtMm(o.width_mm)} × {fmtMm(o.height_mm)} mm{/if}</div>
		<div class="orow__badges">
			<span class="st {customerStatus(o).cls}">{customerStatus(o).label}</span>
			{#if o.credit_earned > 0}<span class="credit-pill"><img src="/images/coin-sp.png" alt="" />+{eur(o.credit_earned)} di credito</span>{/if}
			{#if o.tracking_url}<a class="link" style="font-size:12px" href={o.tracking_url} target="_blank" rel="noopener">Traccia la spedizione ↗</a>{/if}
		</div>
	</div>
	<div class="orow__track">
		{#each trackSteps(o) as s, i (i)}<span class="tk tk--{s.state}" title={s.label}><i></i>{#if s.state === 'current'}<small>{s.label}</small>{/if}</span>{/each}
	</div>
	<div class="orow__right">
		<span class="orow__price">{eur(o.total_gross)}</span>
		<button type="button" class="btn btn--ghost btn--xs" onclick={() => onreorder(o)}>⟳ Riordina</button>
	</div>
</div>
