<script lang="ts">
	/**
	 * Grafico a linee con area sotto (fatturato mese per mese): piu' serie, un punto per mese.
	 * Passando il mouse si legge il valore di ogni serie; cliccando un mese lo si seleziona (la pagina mostra il suo riepilogo).
	 * SVG disegnato a mano sulla larghezza reale del contenitore: niente librerie.
	 */
	export interface PuntoLinee { id: string; label: string; valori: number[] }
	export interface SerieLinee { nome: string; colore: string }
	let { punti, serie, selezionato = '', onselect, altezza = 240, formato = (v: number) => String(v) }: { punti: PuntoLinee[]; serie: SerieLinee[]; selezionato?: string; onselect?: (id: string) => void; altezza?: number; formato?: (v: number) => string } = $props();

	let larghezza = $state(720);
	const PAD = { sx: 56, dx: 18, su: 18, giu: 30 };
	const w = $derived(Math.max(320, larghezza));
	const h = $derived(altezza);
	const massimo = $derived.by(() => { const m = Math.max(0, ...punti.flatMap((p) => p.valori)); return m > 0 ? m : 100; });
	/* passo "tondo" per le righe orizzontali: 1-2-5 × 10^n */
	const passo = $derived.by(() => { const grezzo = massimo / 4; const pot = 10 ** Math.floor(Math.log10(grezzo)); const n = grezzo / pot; return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * pot; });
	const tetto = $derived(Math.ceil(massimo / passo) * passo);
	const righe = $derived(Array.from({ length: Math.round(tetto / passo) + 1 }, (_, i) => i * passo));
	const x = (i: number) => (punti.length < 2 ? PAD.sx : PAD.sx + (i * (w - PAD.sx - PAD.dx)) / (punti.length - 1));
	const y = (v: number) => PAD.su + (1 - v / tetto) * (h - PAD.su - PAD.giu);
	const linea = (k: number) => punti.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.valori[k] ?? 0).toFixed(1)}`).join(' ');
	const area = (k: number) => `${linea(k)} L${x(punti.length - 1).toFixed(1)},${y(0).toFixed(1)} L${x(0).toFixed(1)},${y(0).toFixed(1)} Z`;

	let sopra = $state<number | null>(null);
	const attivo = $derived(sopra ?? punti.findIndex((p) => p.id === selezionato));
	const colonna = $derived(punti.length > 1 ? (w - PAD.sx - PAD.dx) / (punti.length - 1) : w);
	const tooltipSx = $derived(attivo < 0 ? 0 : Math.min(Math.max(x(attivo) - 80, 0), w - 160));
</script>

<div class="ln" bind:clientWidth={larghezza} role="img" aria-label="Andamento mese per mese">
	<svg width={w} height={h} viewBox="0 0 {w} {h}">
		{#each righe as r (r)}
			<line x1={PAD.sx} x2={w - PAD.dx} y1={y(r)} y2={y(r)} class="ln__riga" class:is-zero={r === 0} />
			<text x={PAD.sx - 8} y={y(r) + 4} class="ln__y">{formato(r)}</text>
		{/each}
		{#each serie as s, k (s.nome)}
			<path d={area(k)} fill={s.colore} class="ln__area" />
		{/each}
		{#each serie as s, k (s.nome)}
			<path d={linea(k)} stroke={s.colore} class="ln__linea" />
		{/each}
		{#if attivo >= 0}<line x1={x(attivo)} x2={x(attivo)} y1={PAD.su} y2={y(0)} class="ln__cursore" />{/if}
		{#each punti as p, i (p.id)}
			<text x={x(i)} y={h - 8} class="ln__x" class:is-sel={p.id === selezionato} text-anchor={i === 0 ? 'start' : i === punti.length - 1 ? 'end' : 'middle'}>{p.label}</text>
			{#each serie as s, k (s.nome)}
				<circle cx={x(i)} cy={y(p.valori[k] ?? 0)} r={i === attivo ? 5.5 : 3.5} fill="#fff" stroke={s.colore} class="ln__punto" />
			{/each}
			<!-- zona cliccabile di ogni mese -->
			<rect x={x(i) - colonna / 2} y={0} width={colonna} height={h} fill="transparent" role="button" tabindex="-1" aria-label={p.label} onmouseenter={() => (sopra = i)} onmouseleave={() => (sopra = null)} onclick={() => onselect?.(p.id)} style={onselect ? 'cursor:pointer' : ''} />
		{/each}
	</svg>
	{#if attivo >= 0 && punti[attivo]}
		<div class="ln__tip" style="left:{tooltipSx}px">
			<b>{punti[attivo].label}</b>
			{#each serie as s, k (s.nome)}<span><i style="background:{s.colore}"></i>{s.nome} <strong>{formato(punti[attivo].valori[k] ?? 0)}</strong></span>{/each}
		</div>
	{/if}
	<div class="ln__legenda">{#each serie as s (s.nome)}<span><i style="background:{s.colore}"></i>{s.nome}</span>{/each}</div>
</div>

<style>
	.ln { position: relative; width: 100%; min-width: 0; }
	svg { display: block; width: 100%; height: auto; overflow: visible; }
	.ln__riga { stroke: #e9ebf3; stroke-width: 1; }
	.ln__riga.is-zero { stroke: #c9cfdd; }
	.ln__y { font-size: 11px; fill: var(--muted); text-anchor: end; font-weight: 700; font-variant-numeric: tabular-nums; }
	.ln__x { font-size: 11px; fill: var(--muted); font-weight: 800; text-transform: uppercase; letter-spacing: .04em; }
	.ln__x.is-sel { fill: var(--ink); }
	.ln__area { opacity: .12; }
	.ln__linea { fill: none; stroke-width: 2.5; stroke-linejoin: round; stroke-linecap: round; }
	.ln__punto { stroke-width: 2; pointer-events: none; }
	.ln__cursore { stroke: #c9cfdd; stroke-dasharray: 3 3; }
	.ln__tip { position: absolute; top: 0; width: 160px; background: var(--navy); color: #fff; border-radius: 10px; padding: 8px 10px; font-size: 12px; display: grid; gap: 3px; pointer-events: none; box-shadow: 0 8px 20px rgba(11,11,59,.18); }
	.ln__tip b { font-size: 12px; text-transform: capitalize; }
	.ln__tip span { display: flex; justify-content: space-between; gap: 8px; align-items: center; }
	.ln__tip i { display: inline-block; width: 8px; height: 8px; border-radius: 2px; margin-right: 6px; }
	.ln__tip strong { font-variant-numeric: tabular-nums; }
	.ln__legenda { display: flex; gap: 16px; flex-wrap: wrap; font-size: 12px; color: var(--muted); font-weight: 700; margin-top: 6px; justify-content: flex-end; }
	.ln__legenda i { display: inline-block; width: 10px; height: 10px; border-radius: 3px; margin-right: 6px; vertical-align: -1px; }
</style>
