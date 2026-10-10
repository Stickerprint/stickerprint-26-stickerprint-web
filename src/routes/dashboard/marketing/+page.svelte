<script lang="ts">
	import Manca from '$lib/components/marketing/Manca.svelte';
	import Kpi from '$lib/components/marketing/Kpi.svelte';
	import Giorni from '$lib/components/marketing/Giorni.svelte';
	import Consigli from '$lib/components/marketing/Consigli.svelte';
	import { num, euro, segno } from '$lib/marketing/formato';
	import { NOME_CANALE, NOME_BREVE, roas, cpa } from '$lib/marketing/ads-tipi';
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
	const mese = (m: string) => new Date(m + '-01T12:00:00').toLocaleDateString('it-IT', { month: 'long', year: 'numeric' });
</script>

<svelte:head><title>Marketing | Dashboard Stickerprint</title></svelte:head>

<div class="toolbar" style="justify-content:space-between">
	<div><h1>Marketing · Panoramica</h1><p class="lead">Tutti i canali insieme: Meta (Instagram e Facebook), Google Ads e TikTok Ads, letti adesso dalle piattaforme. I consigli vengono dalle regole della dashboard e dall'assistente.</p></div>
	<div class="mk-periodo">{#each PERIODI as p (p)}<a href="?giorni={p}" class:is-active={data.giorni === p}>{p} giorni</a>{/each}</div>
</div>
{#if form?.errore}<div class="mk-err">{form.errore}</div>{/if}
{#if form?.ok}<div class="mk-ok">{form.messaggio}</div>{/if}

{#if !collegati.length}
	<Manca titolo="Nessun canale pubblicitario collegato" testo="Per ogni canale servono le chiavi su Vercel (Settings → Environment Variables). Apri le pagine Meta, Google Ads e TikTok Ads qui a sinistra: ognuna dice esattamente quali variabili mancano e dove si prendono. Le istruzioni passo passo sono in docs/marketing-interno.md." />
{:else}
	{#if data.totale}
		<section>
			<h3 class="h4" style="margin-bottom:10px">Ultimi {data.giorni} giorni, tutti i canali</h3>
			<Kpi kpi={data.totale.kpi} prima={primaTotale} spesaMese={collegati.reduce((s, c) => s + (c.dati?.spesaMese ?? 0), 0)} valoreStimato={data.analisi.some((a) => a.kpi.valoreStimato)} />
		</section>
	{/if}

	<div class="mk-canali">
		{#each data.canali as c (c.canale)}
			{@const a = data.analisi.find((x) => x.canale === c.canale)}
			<div class="dcard mk-canale">
				<div class="mk-canale__testa">
					<h3>{NOME_CANALE[c.canale]}</h3>
					{#if !c.configurato}<span class="pill pill--off">non collegato</span>{:else if c.errore}<span class="pill pill--off">errore</span>{:else}<span class="pill pill--on">collegato</span>{/if}
				</div>
				{#if !c.configurato}
					<p class="mk-nota">Mancano su Vercel: {c.mancanti.join(', ')}. <a href="/dashboard/marketing/{c.canale}">Vedi come collegarlo →</a></p>
				{:else if c.errore}
					<div class="mk-err">{c.errore}</div>
				{:else if c.dati && a}
					<div class="mk-canale__num">
						<div><small>Spesa</small><b>{euro(c.dati.kpi.spesa)}</b>{#if c.dati.prima?.spesa}<span class="mk-delta">{segno(((c.dati.kpi.spesa - c.dati.prima.spesa) / c.dati.prima.spesa) * 100)} vs prima</span>{/if}</div>
						<div><small>Ordini</small><b>{num(c.dati.kpi.conversioni)}</b>{#if cpa(c.dati.kpi) != null}<span class="mk-delta">{euro(cpa(c.dati.kpi), 2)} l'uno</span>{/if}</div>
						<div><small>Ritorno</small><b>{a.kpi.roas != null ? `${a.kpi.roas.toFixed(1)}×` : '—'}</b>{#if a.kpi.valoreStimato}<span class="mk-delta">stimato</span>{:else if roas(c.dati.kpi) == null}<span class="mk-delta">valore non misurato</span>{/if}</div>
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

	<Consigli report={data.report} assistente={data.assistente} mostraCanale />

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
{/if}
