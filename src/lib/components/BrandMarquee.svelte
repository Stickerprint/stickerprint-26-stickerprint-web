<script lang="ts">
	/**
	 * Fascia dei loghi che scorre (home e pagina Aziende).
	 * Su iPhone la vecchia versione spariva: un solo nastro larghissimo (44 loghi) animato dentro un
	 * contenitore con mask-image. Safari non ridisegna i livelli cosi' larghi e con la maschera li perde.
	 * Qui: due nastri identici piu' corti, ognuno animato per conto suo, niente maschera (le sfumature ai
	 * lati sono due fasce sopra), immagini caricate subito e con altezza fissa.
	 */
	import { BRANDS } from '$lib/brands';
	const fallback = (e: Event, name: string) => { const el = e.currentTarget as HTMLImageElement; const s = document.createElement('span'); s.textContent = name; el.replaceWith(s); };
</script>

<div class="bm" aria-hidden="true">
	{#each [0, 1] as t (t)}
		<div class="bm__track">
			{#each BRANDS as b (b.name)}
				{#if b.img}<img src="/images/brands/{b.img}" alt={b.name} title={b.name} height="36" loading="eager" decoding="async" onerror={(e) => fallback(e, b.name)} />{:else}<span>{b.name}</span>{/if}
			{/each}
		</div>
	{/each}
</div>

<style>
	.bm { --gap: 64px; --fade: var(--paper, #fff); position: relative; display: flex; overflow: hidden; margin-top: 52px; width: 100%; opacity: 1; flex-wrap: nowrap; justify-content: flex-start; gap: 0; }
	.bm::before, .bm::after { content: ""; position: absolute; top: 0; bottom: 0; width: 9%; z-index: 1; pointer-events: none; }
	.bm::before { left: 0; background: linear-gradient(90deg, var(--fade), transparent); }
	.bm::after { right: 0; background: linear-gradient(270deg, var(--fade), transparent); }
	.bm__track { flex: 0 0 auto; display: flex; align-items: center; gap: var(--gap); padding-right: var(--gap); animation: bm 45s linear infinite; transform: translate3d(0, 0, 0); backface-visibility: hidden; -webkit-backface-visibility: hidden; }
	.bm__track img { height: 36px; width: auto; max-width: 180px; object-fit: contain; flex: 0 0 auto; display: block; }
	.bm__track span { font-weight: 800; font-size: 22px; color: var(--ink); letter-spacing: -0.02em; white-space: nowrap; }
	@keyframes bm { from { transform: translate3d(0, 0, 0); } to { transform: translate3d(-100%, 0, 0); } }
	@media (max-width: 700px) {
		.bm { --gap: 38px; margin-top: 30px; }
		.bm__track { animation-duration: 38s; }
		.bm__track img { height: 28px; max-width: 120px; }
		.bm__track span { font-size: 17px; }
	}
	/* chi ha chiesto meno animazioni: nastro fermo ma scorribile col dito */
	@media (prefers-reduced-motion: reduce) { .bm { overflow-x: auto; } .bm__track + .bm__track { display: none; } }
</style>
