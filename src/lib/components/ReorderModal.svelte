<script lang="ts">
	/**
	 * Popup "Riordina": il lavoro precedente in grande, la quantità (scritta a mano dal cliente),
	 * il bottone con il totale e il prezzo al pezzo, sotto il credito che si guadagna.
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
	const n = $derived(Math.max(1, Math.round(qty || 1)));
	const q = $derived(quoteWith(cfg, { w, h, forma: order.forma ?? 'sagomato', materiale: order.materiale ?? 'bianco', finitura: order.finitura ?? 'nessuna', qty: n, vatIncluded: true }));

	function reorder() {
		addToCart({ product: order.product_slug, productName: order.product_name, forma: order.forma ?? 'sagomato', materiale: order.materiale ?? 'bianco', finitura: order.finitura ?? undefined, w, h, qty: n, net: q.net, gross: q.gross, fileName: order.file_path ? order.file_path.split('/').pop() : `Ordine ${order.number}`, filePath: order.file_path ?? `riordino:${order.number}`, reorderOf: order.number, previewUrl: order.preview_url ?? null, note: `Riordino dell'ordine ${order.number}` });
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
				<p class="eyebrow">Riordina · ordine {order.number}</p>
				<h2 style="font-size:22px">{order.product_name} <small style="font-weight:600;font-size:13px;color:var(--muted)">· {order.forma ?? ''}{#if order.materiale} · {MATERIAL_LABEL[order.materiale] ?? order.materiale}{/if}{#if order.finitura && order.finitura !== 'nessuna'} · lamina {order.finitura}{/if} · {fmtMm(w)} × {fmtMm(h)} mm</small></h2>
			</div>
			<button type="button" class="modal__close" onclick={onclose} aria-label="Chiudi">✕</button>
		</div>

		<div class="modal__preview">
			{#if order.preview_url}<img src={order.preview_url} alt="Il lavoro precedente" />{:else}<p class="lead">Anteprima non disponibile per questo ordine.</p>{/if}
		</div>

		<div class="modal__row">
			<div class="qty-box">
				<span class="sub">Quantità</span>
				<input type="number" min="1" step="1" bind:value={qty} disabled={added} aria-label="Quantità" />
			</div>
			<div class="reorder-cta">
				{#if added}
					<a class="btn btn--green" href="/checkout">Vai al checkout →</a>
					<a class="alt" href="/prodotti">oppure continua gli acquisti</a>
				{:else}
					<button type="button" class="btn btn--green" onclick={reorder}>Riordina · {eur0(q.gross)} <small>{q.perPiece.toFixed(2).replace('.', ',')} € cad.</small></button>
					<small class="sub">Totale IVA inclusa · {eur(q.net)} + IVA</small>
				{/if}
			</div>
		</div>

		<div class="reorder-credit">
			<img src="/images/coin-sp.png" alt="" />
			<span>Con questo ordine guadagni <b>{eur(q.credit)}</b> di credito Stickerprint da usare sul prossimo acquisto.</span>
		</div>
	</div>
</div>
