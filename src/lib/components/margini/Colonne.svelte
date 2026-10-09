<script lang="ts">
	/**
	 * Grafico a colonne verticali dell'Analisi margini.
	 * Ogni colonna ha un valore (v) e, se serve, un secondo valore sovrapposto (v2, piu' scuro: es. il margine dentro il fatturato).
	 * Lo zero e' una linea: i valori negativi scendono sotto, in rosso. Il numero sta sopra la colonna, l'etichetta sotto.
	 */
	export interface Colonna {
		id: string;
		label: string;
		v: number;
		v2?: number | null;
		/** testo sopra la colonna (gia' formattato) */
		sopra?: string;
		/** riga piccola sotto l'etichetta */
		sotto?: string;
		/** colonna in evidenza (blu scuro) */
		forte?: boolean;
		/** colonna senza dato: niente barra, si scrive il motivo nel titolo */
		vuota?: boolean;
		titolo?: string;
		attiva?: boolean;
		onclick?: () => void;
	}
	/* fitta: tante colonne (i mesi); quando lo spazio e' poco i numeri restano solo sulla colonna attiva */
	let { colonne, altezza = 150, etichetta = '', fitta = false }: { colonne: Colonna[]; altezza?: number; etichetta?: string; fitta?: boolean } = $props();
	const vals = $derived(colonne.filter((c) => !c.vuota).flatMap((c) => [c.v, c.v2 ?? 0]));
	const max = $derived(Math.max(0, ...vals));
	const min = $derived(Math.min(0, ...vals));
	const ampiezza = $derived(max - min || 1);
	const zero = $derived((-min / ampiezza) * 100);
	const barra = (v: number) => (v >= 0 ? `bottom:${zero}%;height:${(v / ampiezza) * 100}%` : `bottom:${zero - (-v / ampiezza) * 100}%;height:${(-v / ampiezza) * 100}%`);
</script>

<div class="mgc-box"><div class="mgc" class:is-fitta={fitta} role="img" aria-label={etichetta} style="--h:{altezza}px;--n:{colonne.length}">
	{#each colonne as c (c.id)}
		<svelte:element this={c.onclick ? 'button' : 'div'} type={c.onclick ? 'button' : undefined} class="mgc__col" class:is-forte={c.forte} class:is-attiva={c.attiva} class:is-vuota={c.vuota} title={c.titolo} onclick={c.onclick} role={c.onclick ? undefined : 'presentation'}>
			<span class="mgc__sopra" class:is-neg={(c.v2 ?? c.v) < 0}>{c.sopra ?? ''}</span>
			<span class="mgc__area">
				<i class="mgc__zero" style="bottom:{zero}%"></i>
				{#if !c.vuota}
					<i class="mgc__bar" class:is-neg={c.v < 0} style={barra(c.v)}></i>
					{#if c.v2 != null}<i class="mgc__bar mgc__bar--2" class:is-neg={c.v2 < 0} style={barra(c.v2)}></i>{/if}
				{/if}
			</span>
			<span class="mgc__label">{c.label}</span>
			<!-- sempre presente, anche vuota: tutte le colonne hanno le stesse righe e le etichette restano allineate -->
			<span class="mgc__sotto">{c.sotto || '\u00a0'}</span>
		</svelte:element>
	{/each}
</div></div>

<style>
	.mgc-box { container-type: inline-size; }
	.mgc { display: grid; grid-template-columns: repeat(var(--n), minmax(0, 1fr)); gap: 6px; align-items: end; }
	.mgc__col { display: grid; grid-template-rows: auto var(--h) auto auto; gap: 4px; justify-items: center; min-width: 0; padding: 4px 0 2px; border: 0; border-radius: 10px; background: none; font: inherit; color: inherit; text-align: center; }
	button.mgc__col { cursor: pointer; }
	button.mgc__col:hover, .mgc__col.is-attiva { background: #f1f4fb; }
	button.mgc__col:disabled { cursor: default; }
	.mgc__sopra { font-size: 11px; font-weight: 800; white-space: nowrap; font-variant-numeric: tabular-nums; color: var(--ink); max-width: 100%; overflow: hidden; text-overflow: ellipsis; }
	.mgc__sopra.is-neg { color: #b42318; }
	.mgc__area { position: relative; width: 100%; height: var(--h); }
	.mgc__zero { position: absolute; left: 0; right: 0; height: 1px; background: #c9cfdd; }
	.mgc__bar { position: absolute; left: 50%; transform: translateX(-50%); width: min(70%, 34px); border-radius: 4px 4px 0 0; background: var(--blue); min-height: 2px; }
	.mgc__bar.is-neg { background: #dc2626; border-radius: 0 0 4px 4px; }
	.is-forte .mgc__bar { background: var(--navy); }
	.mgc__bar--2 { width: min(70%, 34px); background: var(--navy); }
	.mgc__col:has(.mgc__bar--2) .mgc__bar:not(.mgc__bar--2):not(.is-neg) { background: #c3cff3; }
	.is-vuota .mgc__area { background: repeating-linear-gradient(135deg, transparent 0 6px, #eef0f6 6px 8px); border-radius: 6px; }
	/* etichette corte; se proprio non stanno vanno a capo invece di essere tagliate */
	.mgc__label { font-size: 11px; font-weight: 800; color: var(--ink-soft); max-width: 100%; line-height: 1.15; overflow-wrap: anywhere; }
	.mgc__sotto { font-size: 10.5px; font-weight: 700; color: var(--muted); white-space: nowrap; }
	@media (max-width: 820px) {
		.mgc { gap: 3px; }
		.mgc__sopra { font-size: 10px; }
		.mgc__label { font-size: 10.5px; }
		.mgc__sotto { font-size: 9.5px; }
	}
	@container (max-width: 560px) {
		.is-fitta .mgc__sopra, .is-fitta .mgc__sotto { visibility: hidden; }
		.is-fitta .is-attiva .mgc__sopra, .is-fitta .is-attiva .mgc__sotto { visibility: visible; overflow: visible; position: relative; z-index: 1; background: #fff; border-radius: 4px; padding: 0 2px; }
		.is-fitta .mgc__label { font-size: 9.5px; }
	}
	@media (prefers-reduced-motion: no-preference) { .mgc__bar { transition: height .25s ease, bottom .25s ease; } }
</style>
