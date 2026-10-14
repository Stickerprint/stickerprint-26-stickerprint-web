<script lang="ts">
	import Manca from '$lib/components/marketing/Manca.svelte';
	import Kpi from '$lib/components/marketing/Kpi.svelte';
	import Giorni from '$lib/components/marketing/Giorni.svelte';
	import Consigli from '$lib/components/marketing/Consigli.svelte';
	import Carrello from '$lib/components/marketing/Carrello.svelte';
	import Sparkline from '$lib/components/marketing/Sparkline.svelte';
	import { num, euro, segno } from '$lib/marketing/formato';
	import { NOME_CANALE, NOME_BREVE, roas, cpa, type Canale } from '$lib/marketing/ads-tipi';
	let { data, form } = $props();
	const PERIODI = [7, 14, 30, 90];
	const collegati = $derived(data.canali.filter((c) => c.configurato));
	/* spesa di tutti i canali, giorno per giorno */
	const giorniTotali = $derived.by(() => {
		const m = new Map<string, { giorno: string; spesa: number; clic: number; conversioni: number }>();
		for (const c of data.canali) for (const g of c.dati?.giorni ?? []) { const x = m.get(g.giorno) ?? { giorno: g.giorno, spesa: 0, clic: 0, conversioni: 0 }; x.spesa += g.spesa; x.clic += g.clic; x.conversioni += g.conversioni; m.set(g.giorno, x); }
		return [...m.values()].sort((a, b) => a.giorno.localeCompare(b.giorno));
	});
	const primaTotale = $derived.by(() => {
		const xs = data.canali.map((c) => c.dati?.prima).filter(Boolean);
		if (!xs.length) return null;
		const s = { spesa: 0, impressioni: 0, clic: 0, conversioni: 0, valore: null as number | null };
		for (const x of xs) { s.spesa += x!.spesa; s.impressioni += x!.impressioni; s.clic += x!.clic; s.conversioni += x!.conversioni; if (x!.valore != null) s.valore = (s.valore ?? 0) + x!.valore; }
		return s;
	});
	const PIATT: Record<string, string> = { instagram: 'Instagram', facebook: 'Facebook', audience_network: 'Audience Network', messenger: 'Messenger', threads: 'Threads' };
	/* identita' grafica di ogni canale: icona e colore della scheda */
	const LOOK: Record<Canale, { icona: string; colore: string; sfondo: string }> = { meta: { icona: '◎', colore: '#1d4ed8', sfondo: '#e8efff' }, google: { icona: 'G', colore: '#1a7a47', sfondo: '#e3f6ea' }, tiktok: { icona: '♪', colore: '#111827', sfondo: '#eef0f5' } };
	const mese = (m: string) => new Date(m + '-01T12:00:00').toLocaleDateString('it-IT', { month: 'long', year: 'numeric' });
	const spesaTotaleMese = $derived(collegati.reduce((s, c) => s + (c.dati?.spesaMese ?? 0), 0));
	const quotaSpesa = (spesa: number) => (data.totale?.kpi.spesa ? Math.round((spesa / data.totale.kpi.spesa) * 100) : 0);
</script>

<svelte:head><title>Marketing | Dashboard Stickerprint</title></svelte:head>

<div class="toolbar mk-toolbar">
	<div><h1>Marketing · Panoramica</h1><p class="lead">Pubblicità (Meta, Google Ads, TikTok) e carrello del sito in un colpo d'occhio. I consigli vengono dalle regole della dashboard e dall'assistente.</p></div>
	<div class="mk-periodo" title="Periodo letto dalle piattaforme pubblicitarie">{#each PERIODI as p (p)}<a href="?giorni={p}" class:is-active={data.giorni === p}>{p} giorni</a>{/each}</div>
</div>
{#if form?.errore}<div class="mk-err">{form.errore}</div>{/if}
{#if form?.ok}<div class="mk-ok">{form.messaggio}</div>{/if}

<!-- 1. Risultati di tutta la pubblicità -->
<section class="mk-sezione">
	<div class="mk-sezione__testa"><span class="mk-n">1</span><div><h2>Pubblicità · ultimi {data.giorni} giorni</h2><p class="mk-nota">Tutti i canali collegati insieme{#if spesaTotaleMese}, {euro(spesaTotaleMese, 2)} spesi questo mese{/if}. Il confronto è con i {data.giorni} giorni prima.</p></div></div>
	{#if !collegati.length}
		<Manca titolo="Nessun canale pubblicitario collegato" testo="Per ogni canale servono le chiavi su Vercel (Settings → Environment Variables). Apri le pagine Meta, Google Ads e TikTok Ads qui a sinistra: ognuna dice esattamente quali variabili mancano e dove si prendono. Le istruzioni passo passo sono in docs/marketing-interno.md." />
	{:else if data.totale}
		<Kpi kpi={data.totale.kpi} prima={primaTotale} spesaMese={spesaTotaleMese} valoreStimato={data.analisi.some((a) => a.kpi.valoreStimato)} />
	{/if}
</section>

<!-- 2. Un riquadro per canale -->
<section class="mk-sezione">
	<div class="mk-sezione__testa"><span class="mk-n">2</span><div><h2>I canali</h2><p class="mk-nota">Ogni scheda: quanto spende, quanti ordini porta, cosa rende e cosa spegnere. La linea è la spesa giorno per giorno.</p></div></div>
	<div class="mk-canali">
		{#each data.canali as c (c.canale)}
			{@const a = data.analisi.find((x) => x.canale === c.canale)}
			{@const look = LOOK[c.canale]}
			<div class="dcard mk-canale mk-canale--{c.canale}" class:is-off={!c.configurato || !!c.errore} style="--c:{look.colore};--c-soft:{look.sfondo}">
				<div class="mk-canale__testa">
					<span class="mk-canale__logo">{look.icona}</span>
					<h3>{NOME_CANALE[c.canale]}</h3>
					{#if !c.configurato}<span class="mk-stato mk-stato--off">non collegato</span>{:else if c.errore}<span class="mk-stato mk-stato--err">errore</span>{:else}<span class="mk-stato mk-stato--on">collegato</span>{/if}
				</div>
				{#if !c.configurato}
					<p class="mk-nota">Mancano su Vercel: {c.mancanti.join(', ')}.</p>
					<a class="btn btn--sm btn--ghost" href="/dashboard/marketing/{c.canale}">Vedi come collegarlo →</a>
				{:else if c.errore}
					<div class="mk-err">{c.errore}</div>
					<a class="btn btn--sm btn--ghost" href="/dashboard/marketing/{c.canale}">Apri {NOME_BREVE[c.canale]} →</a>
				{:else if c.dati && a}
					<div class="mk-canale__spesa">
						<div><small>Spesa in {data.giorni} giorni</small><b>{euro(c.dati.kpi.spesa, 2)}</b><span class="mk-delta">{#if c.dati.prima?.spesa}{segno(((c.dati.kpi.spesa - c.dati.prima.spesa) / c.dati.prima.spesa) * 100)} vs prima · {/if}{quotaSpesa(c.dati.kpi.spesa)}% del totale</span></div>
						<Sparkline valori={c.dati.giorni.map((g) => g.spesa)} colore={look.colore} />
					</div>
					<div class="mk-canale__num">
						<div><small>Ordini</small><b>{num(c.dati.kpi.conversioni)}</b><span class="mk-delta">{cpa(c.dati.kpi) != null ? `${euro(cpa(c.dati.kpi), 2)} l'uno` : '—'}</span></div>
						<div><small>Ritorno</small><b>{a.kpi.roas != null ? `${a.kpi.roas.toFixed(1)}×` : '—'}</b><span class="mk-delta">{a.kpi.valoreStimato ? 'stimato' : roas(c.dati.kpi) == null ? 'valore non misurato' : 'misurato'}</span></div>
						<div><small>Clic</small><b>{num(c.dati.kpi.clic)}</b><span class="mk-delta">{c.dati.kpi.clic ? `${euro(c.dati.kpi.spesa / c.dati.kpi.clic, 2)} a clic` : '—'}</span></div>
						<div><small>Campagne attive</small><b>{c.dati.campagne.filter((x) => x.stato === 'attiva').length}</b><span class="mk-delta">su {c.dati.campagne.length}</span></div>
					</div>
					{#if c.dati.piattaforme && Object.keys(c.dati.piattaforme).length}
						<div class="mk-canale__piatt">{#each Object.entries(c.dati.piattaforme).sort((x, y) => y[1].spesa - x[1].spesa) as [p, x] (p)}<span><b>{PIATT[p] ?? p}</b> {euro(x.spesa)}{x.conversioni ? ` · ${num(x.conversioni)} ordini` : ''}</span>{/each}</div>
					{/if}
					<div class="mk-lista">
						{#if a.migliori[0]}<div class="mk-riga"><span><span class="mk-chip mk-chip--green">Rende meglio</span> {a.migliori[0].nome}</span><b>{a.migliori[0].roas != null ? `${a.migliori[0].roas.toFixed(1)}×` : `${a.migliori[0].conversioni} ord.`}</b></div>{/if}
						{#if a.daSpegnere.length}<div class="mk-riga"><span><span class="mk-chip mk-chip--pink">Da spegnere</span> {a.daSpegnere.map((g) => g.nome).join(', ')}</span><b>{euro(a.daSpegnere.reduce((s, g) => s + g.spesa, 0))}</b></div>{/if}
						<div class="mk-riga"><span>Budget consigliato</span><b>{euro(a.budget.propostoMese)}/mese</b></div>
					</div>
					<a class="btn btn--sm btn--ghost" href="/dashboard/marketing/{c.canale}">Apri {NOME_BREVE[c.canale]} →</a>
				{/if}
			</div>
		{/each}
	</div>
</section>

<!-- 3. Il sito: aggiunte al carrello -->
<section class="mk-sezione">
	<div class="mk-sezione__testa"><span class="mk-n">3</span><div><h2>Il sito</h2><p class="mk-nota">Cosa succede su stickerprint.it: quante volte si aggiunge al carrello e cosa. Il traffico completo è nella pagina Google Analytics.</p></div></div>
	<Carrello dati={data.carrello} />
</section>

{#if collegati.length}
	<!-- 4. Consigli -->
	<section class="mk-sezione">
		<div class="mk-sezione__testa"><span class="mk-n">4</span><div><h2>Cosa fare</h2><p class="mk-nota">I verdetti delle regole sulle campagne e il commento dell'assistente.</p></div></div>
		<Consigli report={data.report} assistente={data.assistente} mostraCanale />
	</section>

	<!-- 5. Storico -->
	<section class="mk-sezione">
		<div class="mk-sezione__testa"><span class="mk-n">5</span><div><h2>Andamento</h2><p class="mk-nota">La spesa giorno per giorno nel periodo e i mesi passati.</p></div></div>
		{#if giorniTotali.length}<Giorni giorni={giorniTotali} titolo="Spesa giorno per giorno, tutti i canali" />{/if}
		{#if data.mesi.length}
			<div class="dcard" style="padding:0;overflow-x:auto">
				<table class="dtable mk-mesi">
					<thead><tr><th>Mese</th><th>Spesa</th><th>Clic</th><th>Ordini</th><th>Costo per ordine</th><th>Ritorno</th></tr></thead>
					<tbody>{#each data.mesi as m (m.mese)}<tr><td class="mk-td-mese"><b style="text-transform:capitalize">{mese(m.mese)}</b></td><td data-l="Spesa">{euro(m.spesa)}</td><td data-l="Clic">{num(m.clic)}</td><td data-l="Ordini">{num(m.conversioni)}</td><td data-l="Costo per ordine">{m.conversioni ? euro(m.spesa / m.conversioni, 2) : '—'}</td><td data-l="Ritorno">{m.valore != null && m.spesa ? `${(m.valore / m.spesa).toFixed(1)}×` : '—'}</td></tr>{/each}</tbody>
				</table>
				<p class="mk-nota" style="padding:10px 16px">Storico salvato ogni notte dal sito (tabella ads_giorni): parte dal giorno in cui i canali sono stati collegati.</p>
			</div>
		{/if}
	</section>
{/if}
