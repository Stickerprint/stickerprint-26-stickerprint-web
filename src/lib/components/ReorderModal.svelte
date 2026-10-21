<script lang="ts">
	/**
	 * Popup "Riordina": il lavoro precedente in grande, la quantità (scritta a mano dal cliente),
	 * il bottone con il totale e il prezzo al pezzo, sotto il credito che si guadagna.
	 */
	import { addToCart } from '$lib/cart';
	import { quoteWith, type EngineConfig } from '$lib/pricing/engine';
	import { MATERIAL_LABEL, type Order } from '$lib/account';
	import { usaLingua } from '$lib/traduzioni';

	let { order, cfg, onclose }: { order: Order; cfg: EngineConfig; onclose: () => void } = $props();
	const { t, path, prezzo, prezzoUnit, numero } = usaLingua();
	const fmtMm = (v: number) => numero(v, 1);
	/* sagoma, materiale e lamina dell'ordine: dal catalogo per id, altrimenti il valore salvato */
	const opz = (tipo: 'sagome' | 'materiali' | 'finiture', id: string, fallback: string) => {
		const k = `configuratore.opzioni.${tipo}.${id}.label`;
		const v = t(k);
		return v === k ? fallback : v;
	};
	// svelte-ignore state_referenced_locally
	let qty = $state(order.qty);
	let added = $state(false);
	const w = $derived(Number(order.width_mm ?? 50));
	const h = $derived(Number(order.height_mm ?? 50));
	const n = $derived(Math.max(1, Math.round(qty || 1)));
	const q = $derived(quoteWith(cfg, { w, h, forma: order.forma ?? 'sagomato', materiale: order.materiale ?? 'bianco', finitura: order.finitura ?? 'nessuna', qty: n, vatIncluded: true }));

	function reorder() {
		addToCart({ product: order.product_slug, productName: order.product_name, forma: order.forma ?? 'sagomato', materiale: order.materiale ?? 'bianco', finitura: order.finitura ?? undefined, w, h, qty: n, net: q.net, gross: q.gross, fileName: order.file_path ? order.file_path.split('/').pop() : t('configuratore.riordina.fileOrdine', { numero: order.number }), filePath: order.file_path ?? `riordino:${order.number}`, reorderOf: order.number, previewUrl: order.preview_url ?? null, note: t('configuratore.riordina.nota', { numero: order.number }) });
		added = true;
	}
	function onkey(e: KeyboardEvent) {
		if (e.key === 'Escape') onclose();
	}
</script>

<svelte:window onkeydown={onkey} />

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="modal-bg" onclick={(e) => { if (e.target === e.currentTarget) onclose(); }} onkeydown={onkey}>
	<div class="modal" role="dialog" aria-modal="true" aria-label={t('configuratore.riordina.aria', { prodotto: order.product_name })}>
		<div class="modal__head">
			<div>
				<p class="eyebrow">{t('configuratore.riordina.titolo', { numero: order.number })}</p>
				<h2 style="font-size:22px">{order.product_name} <small style="font-weight:600;font-size:13px;color:var(--muted)">· {order.forma ? opz('sagome', order.forma, order.forma) : ''}{#if order.materiale} · {opz('materiali', order.materiale, MATERIAL_LABEL[order.materiale] ?? order.materiale)}{/if}{#if order.finitura && order.finitura !== 'nessuna'} · {t('configuratore.riordina.lamina', { finitura: opz('finiture', order.finitura, order.finitura) })}{/if} · {fmtMm(w)} × {fmtMm(h)} mm</small></h2>
			</div>
			<button type="button" class="modal__close" onclick={onclose} aria-label={t('configuratore.riordina.chiudi')}>✕</button>
		</div>

		<div class="modal__preview">
			{#if order.preview_url}<img src={order.preview_url} alt={t('configuratore.riordina.precedente')} />{:else}<p class="lead">{t('configuratore.riordina.nonDisponibile')}</p>{/if}
		</div>

		<div class="modal__row">
			<div class="rbox">
				<span class="rbox__label">{t('configuratore.riordina.quantita')}</span>
				<div class="qty-step">
					<button type="button" onclick={() => (qty = Math.max(1, n - 50))} disabled={added} aria-label={t('configuratore.riordina.meno')}>−</button>
					<input type="number" min="1" step="1" bind:value={qty} disabled={added} aria-label={t('configuratore.riordina.quantita')} />
					<button type="button" onclick={() => (qty = n + 50)} disabled={added} aria-label={t('configuratore.riordina.piu')}>+</button>
				</div>
				<span class="rbox__hint">{t('configuratore.riordina.pezziCad', { prezzo: prezzoUnit(q.perPiece) })}</span>
			</div>
			<div class="rbox rbox--total">
				<span class="rbox__label">{t('configuratore.riordina.totale')}</span>
				<b class="rbox__big">{prezzo(q.gross, 0)}</b>
				<span class="rbox__vat"><span class="is-on">{t('configuratore.riordina.ivaInclusa')}</span><span class="sep"></span><span>{t('configuratore.riordina.piuIva', { netto: prezzo(q.net) })}</span></span>
			</div>
			{#if added}
				<a class="btn btn--green rbtn" href={path('/checkout')}>{t('configuratore.riordina.checkout')}</a>
				<a class="rbox__alt" href={path('/prodotti')}>{t('configuratore.riordina.continua')}</a>
			{:else}
				<button type="button" class="btn btn--green rbtn" onclick={reorder}>{t('configuratore.riordina.ora', { totale: prezzo(q.gross, 0) })}</button>
			{/if}
		</div>

		<div class="reorder-credit">
			<img src="/images/coin-sp.png" alt="" />
			<!-- testo dal catalogo (mai da input utente) -->
			<span>{@html t('configuratore.riordina.credito', { credito: prezzo(q.credit) })}</span>
		</div>
	</div>
</div>
