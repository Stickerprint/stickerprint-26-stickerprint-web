<script lang="ts">
	/**
	 * Popup "Riordina": il lavoro precedente in grande, la quantità (modificabile) a sinistra,
	 * il prezzo aggiornato dal listino del prodotto a destra, e il bottone grande.
	 */
	import { addToCart } from '$lib/cart';
	import { quoteWith, eur0, type EngineConfig } from '$lib/pricing/engine';
	import { MATERIAL_LABEL, eur, fmtMm, type Order } from '$lib/account';

	let { order, cfg, onclose }: { order: Order; cfg: EngineConfig; onclose: () => void } = $props();
	// svelte-ignore state_referenced_locally
	let qty = $state(order.qty);
	let added = $state(false);
	const w = $derived(Number(order.width_mm ?? 50));
	const h = $derived(Number(order.height_mm ?? 50));
	const q = $derived(quoteWith(cfg, { w, h, forma: order.forma ?? 'sagomato', materiale: order.materiale ?? 'bianco', finitura: order.finitura ?? 'nessuna', qty: Math.max(1, qty || 1), vatIncluded: true }));

	function reorder() {
		addToCart({ product: order.product_slug, forma: order.forma ?? 'sagomato', materiale: order.materiale ?? 'bianco', w, h, qty: Math.max(1, qty || 1), gross: q.gross, fileName: null, note: `Riordino ordine ${order.number}${order.finitura ? ' · ' + order.finitura : ''}` });
		added = true;
	}
	function onkey(e: KeyboardEvent) {
		if (e.key === 'Escape') onclose();
	}
</script>

<svelte:window onkeydown={onkey} />

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="modal-bg" onclick={(e) => { if (e.target === e.currentTarget) onclose(); }} onkeydown={onkey}>
	<div class="modal" role="dialog" aria-modal="true" aria-label="Riordina {order.product_name}">
		<div class="modal__head">
			<div>
				<p class="eyebrow">Riordina</p>
				<h2 style="font-size:24px">{order.product_name} <small style="font-weight:600;font-size:14px;color:var(--muted)">· ordine {order.number}</small></h2>
			</div>
			<button type="button" class="modal__close" onclick={onclose} aria-label="Chiudi">✕</button>
		</div>

		<div class="modal__preview">
			{#if order.preview_url}<img src={order.preview_url} alt="Anteprima del lavoro precedente" />{:else}<p class="lead" style="padding:40px">Anteprima non disponibile per questo ordine.</p>{/if}
		</div>
		<p class="orow__spec" style="text-align:center">{order.forma ?? ''}{#if order.materiale} · {MATERIAL_LABEL[order.materiale] ?? order.materiale}{/if}{#if order.finitura && order.finitura !== 'nessuna'} · lamina {order.finitura}{/if} · {fmtMm(w)} × {fmtMm(h)} mm</p>

		<div class="modal__grid">
			<div class="qty-box">
				<span class="sub">Quantità (prima: {order.qty.toLocaleString('it-IT')} pz)</span>
				<input type="number" min="1" step="1" bind:value={qty} disabled={added} />
				<div class="chips">
					{#each cfg.quantities as n (n)}<button type="button" class:is-active={qty === n} disabled={added} onclick={() => (qty = n)}>{n.toLocaleString('it-IT')}</button>{/each}
				</div>
			</div>
			<div class="price-box">
				<small>Totale IVA inclusa</small>
				<span class="tot">{eur0(q.gross)}</span>
				<small>{q.perPiece.toFixed(2).replace('.', ',')} €/pz · {eur(q.net)} + IVA · guadagni {eur(q.credit)} di credito</small>
			</div>
		</div>

		<div class="modal__cta">
			{#if added}
				<a class="btn btn--green" href="/checkout">Vai al checkout →</a>
				<a class="alt" href="/prodotti">oppure continua gli acquisti</a>
			{:else}
				<button type="button" class="btn btn--green" onclick={reorder}>Riordina</button>
				<small class="sub">Stesso file e stessa configurazione dell’ordine {order.number}.</small>
			{/if}
		</div>
	</div>
</div>
