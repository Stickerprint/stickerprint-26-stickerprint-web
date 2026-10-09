<script lang="ts">
	/** La fila dei numeri di un canale (o di tutti): spesa, ordini, ritorno, costo per ordine, clic; col confronto col periodo prima. */
	import Stat from './Stat.svelte';
	import { num, euro, segno } from '$lib/marketing/formato';
	import { cpa, roas, ctr, type Risultati } from '$lib/marketing/ads-tipi';
	let { kpi, prima = null, spesaMese = null, valoreStimato = false }: { kpi: Risultati; prima?: Risultati | null; spesaMese?: number | null; valoreStimato?: boolean } = $props();
	const delta = (a: number | null, b: number | null | undefined) => (a != null && b != null && b > 0 ? segno(((a - b) / b) * 100) : '');
	const r = $derived(roas(kpi)); const rp = $derived(prima ? roas(prima) : null);
	const c = $derived(cpa(kpi)); const cp = $derived(prima ? cpa(prima) : null);
</script>

<div class="mk-stats" style="grid-template-columns:repeat(auto-fit,minmax(150px,1fr))">
	<Stat etichetta="Spesa" valore={euro(kpi.spesa, 2)} delta={delta(kpi.spesa, prima?.spesa)} nota={spesaMese != null ? `questo mese ${euro(spesaMese, 2)}` : ''} />
	<Stat etichetta="Ordini" valore={num(kpi.conversioni)} delta={delta(kpi.conversioni, prima?.conversioni)} />
	<Stat etichetta="Ritorno" valore={r != null ? `${r.toFixed(1)}×` : '—'} delta={delta(r, rp)} nota={r == null ? (valoreStimato ? 'il canale non misura il valore' : 'serve il valore degli ordini') : kpi.valore != null ? `${euro(kpi.valore)} di ordini` : ''} />
	<Stat etichetta="Costo per ordine" valore={c != null ? euro(c, 2) : '—'} delta={c != null && cp != null ? delta(-c, -cp) : ''} />
	<Stat etichetta="Clic" valore={num(kpi.clic)} delta={delta(kpi.clic, prima?.clic)} nota={ctr(kpi) != null ? `CTR ${ctr(kpi)!.toFixed(2)}% · ${euro(kpi.clic ? kpi.spesa / kpi.clic : null, 2)} a clic` : ''} />
</div>
