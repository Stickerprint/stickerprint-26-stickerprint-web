<script lang="ts">
	import { enhance } from '$app/forms';
	import { page } from '$app/state';
	import Manca from '$lib/components/marketing/Manca.svelte';
	import Stat from '$lib/components/marketing/Stat.svelte';
	import Avvisi from '$lib/components/marketing/Avvisi.svelte';
	import { num, numCorto, euro, segno, dataBreve, isoData, intervalloPeriodo, etichettaPeriodo, PERIODI, PIATTAFORME } from '$lib/marketing/formato';
	let { data, form } = $props();

	const SCHEDE = [['panoramica', 'Panoramica'], ['contenuti', 'Contenuti'], ['piattaforme', 'Piattaforme'], ['campagne', 'Campagne ADV'], ['report', 'Report esportabili']] as const;
	const scheda = $derived(page.url.searchParams.get('scheda') ?? 'panoramica');
	const social = $derived(data.configurato && data.social.ok && data.social.collegato ? data.social : null);
	const campagne = $derived(data.configurato && data.campagne.ok && data.campagne.collegato ? data.campagne : null);
	const motivoSocial = $derived(!data.configurato ? '' : !data.social.ok ? data.social.errore : !data.social.collegato ? data.social.motivo : '');
	const motivoCampagne = $derived(!data.configurato ? '' : !data.campagne.ok ? data.campagne.errore : !data.campagne.collegato ? data.campagne.motivo : '');
	const pubblicati = $derived(data.configurato && data.contenuti.ok ? data.contenuti.contenuti.filter((c) => c.status === 'pubblicato').slice(0, 10) : []);
	const maxTrend = $derived(social ? Math.max(1, ...social.trend.map((p) => (p.instagram ?? 0) + (p.facebook ?? 0))) : 1);
	const maxSpesa = $derived(campagne ? Math.max(1, ...campagne.serie.map((p) => p.spesa)) : 1);

	let periodo = $state<string>('30');
	const intervallo = $derived(intervalloPeriodo(periodo));
	const SEZIONI = ['Panoramica', 'Contenuti top', 'Piattaforme', 'Campagne ADV'];
</script>

<svelte:head><title>Risultati | Marketing</title></svelte:head>

<div class="toolbar" style="justify-content:space-between">
	<div><h1>Risultati</h1><p class="lead">I numeri veri di Instagram, Facebook e delle campagne, letti da Meta adesso. Quando un dato non arriva c'è un trattino e il motivo, mai uno zero.</p></div>
	{#if social}<span class="mk-nota">Ultimi {social.periodo.giorni} giorni · aggiornato {new Date(social.aggiornato).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}</span>{/if}
</div>

<div class="mk-sub">
	{#each SCHEDE as [k, l] (k)}<a href="?scheda={k}" class:is-active={scheda === k}>{l}</a>{/each}
</div>

{#if form?.errore}<div class="mk-err">{form.errore}</div>{/if}
{#if form?.ok}<div class="mk-ok">{form.messaggio}</div>{/if}

{#if !data.configurato}
	<Manca titolo="Collegamento con PERIZ Marketing non configurato" testo="Manca PERIZ_API_KEY nelle variabili d'ambiente del sito." />

{:else if scheda === 'panoramica'}
	{#if social}
		<div class="mk-stats">
			<Stat etichetta="Copertura" valore={num(social.kpi.copertura)} delta={segno(social.kpi.variazioneCopertura)} />
			<Stat etichetta="Interazioni" valore={num(social.kpi.interazioni)} nota="like e commenti dei post" />
			<Stat etichetta="Follower" valore={num(social.kpi.follower)} nota={social.kpi.nuoviFollower != null ? `${social.kpi.nuoviFollower >= 0 ? '+' : ''}${num(social.kpi.nuoviFollower)} nel periodo` : ''} />
			<Stat etichetta="Spesa ADV" valore={euro(campagne?.kpi.spesa ?? null, 2)} nota={campagne ? `${num(campagne.kpi.lead)} lead` : ''} />
		</div>
		<div class="dcard">
			<h3>Copertura giorno per giorno</h3>
			{#if social.trend.length}
				<div class="mk-bars">
					{#each social.trend as p (p.label)}
						<div class="mk-bar">
							<div class="mk-stack" style="height:{Math.round((((p.instagram ?? 0) + (p.facebook ?? 0)) / maxTrend) * 100)}%">
								{#if p.facebook}<i class="fb" style="flex:{p.facebook}"></i>{/if}
								<i style="flex:{p.instagram ?? 0};height:{Math.round(((p.instagram ?? 0) / Math.max(1, (p.instagram ?? 0) + (p.facebook ?? 0))) * 100)}%"></i>
							</div>
							<span>{p.label}</span>
						</div>
					{/each}
				</div>
				<div class="mk-legenda" style="margin-top:8px"><span><i style="background:var(--blue)"></i>Instagram</span><span><i style="background:var(--periwinkle)"></i>Facebook</span></div>
			{:else}
				<p class="mk-nota">Meta non ha dato la serie giornaliera per questo periodo.</p>
			{/if}
		</div>
		<Avvisi avvisi={social.avvisi} />
	{:else}
		<Manca titolo="Numeri social non disponibili" testo={motivoSocial} />
	{/if}

{:else if scheda === 'contenuti'}
	{#if social}
		<div class="dcard">
			<h3>I post che hanno funzionato meglio</h3>
			{#if social.contenuti.length}
				<div class="mk-lista">
					{#each social.contenuti as c, i (c.id)}
						<div class="mk-riga">
							<span><b>#{i + 1}</b> {c.didascalia ? c.didascalia.slice(0, 90) : c.tipo ?? 'Post'}{#if c.didascalia && c.didascalia.length > 90}…{/if}<small>{c.data ? dataBreve(c.data) : ''}{#if c.permalink} · <a class="link" href={c.permalink} target="_blank" rel="noopener">apri su Instagram ↗</a>{/if}</small></span>
							<span style="text-align:right"><b>{num(c.like)}</b> like<small>{num(c.commenti)} commenti</small></span>
						</div>
					{/each}
				</div>
				<p class="mk-nota">Le interazioni si contano dai like e dai commenti dei post veri: un numero che si può verificare aprendo il post.</p>
			{:else}
				<p class="mk-nota">Meta non ha restituito i post del periodo.</p>
			{/if}
		</div>
	{:else}
		<Manca titolo="Numeri social non disponibili" testo={motivoSocial} />
	{/if}
	{#if pubblicati.length}
		<div class="dcard" style="padding:0;overflow-x:auto">
			<table class="dtable">
				<thead><tr><th>Pubblicato dalla dashboard</th><th>Quando</th><th>Dove</th></tr></thead>
				<tbody>{#each pubblicati as c (c.id)}<tr><td><b>{c.title}</b></td><td>{dataBreve(c.publish_date)}</td><td>{(c.platforms ?? []).join(', ') || '—'}</td></tr>{/each}</tbody>
			</table>
		</div>
	{/if}

{:else if scheda === 'piattaforme'}
	{#if social}
		<div class="mk-grid3">
			<div class="dcard">
				<h3>Instagram</h3>
				{#if social.instagram.collegato}
					<p class="mk-nota">@{social.instagram.username ?? ''}</p>
					<div class="mk-lista">
						<div class="mk-riga"><span>Copertura</span><b>{num(social.canali.find((c) => c.nome === 'Instagram')?.valore ?? null)}</b></div>
						<div class="mk-riga"><span>Like</span><b>{num(social.engagement.find((e) => e.name === 'Mi piace')?.value ?? null)}</b></div>
						<div class="mk-riga"><span>Commenti</span><b>{num(social.engagement.find((e) => e.name === 'Commenti')?.value ?? null)}</b></div>
					</div>
				{:else}<p class="mk-nota">Nessun account Instagram collegato alla Pagina.</p>{/if}
			</div>
			<div class="dcard">
				<h3>Facebook</h3>
				{#if social.facebook.collegato}
					<p class="mk-nota">{social.facebook.nome ?? ''}</p>
					<div class="mk-lista">
						<div class="mk-riga"><span>Copertura</span><b>{num(social.canali.find((c) => c.nome === 'Facebook')?.valore ?? null)}</b></div>
						<div class="mk-riga"><span>Interazioni</span><b>{num(social.engagement.find((e) => e.name === 'Interazioni Facebook')?.value ?? null)}</b></div>
					</div>
				{:else}<p class="mk-nota">Pagina Facebook non collegata.</p>{/if}
			</div>
			<div class="dcard">
				<h3>TikTok</h3>
				<p class="mk-nota">{social.tiktok.motivo}</p>
			</div>
		</div>
		{#if social.canali.length}
			<div class="dcard">
				<h3>Da dove arriva la copertura</h3>
				{#each social.canali as c (c.nome)}
					<div class="mk-split" style="margin-bottom:6px"><span>{c.nome} <small class="mk-nota">{c.pct}%</small></span><b>{numCorto(c.valore)}</b></div>
					<div class="mk-prog" style="margin-bottom:10px"><i class={c.nome === 'Facebook' ? 'blue' : ''} style="width:{c.pct}%"></i></div>
				{/each}
			</div>
		{/if}
		{#if social.serieFollower.length}
			<div class="dcard">
				<h3>Follower Instagram nel tempo</h3>
				<div class="mk-lista">{#each social.serieFollower as p (p.label)}<div class="mk-riga"><span>{p.label}</span><b>{num(p.value ?? null)}</b></div>{/each}</div>
			</div>
		{/if}
		<Avvisi avvisi={social.avvisi} />
	{:else}
		<Manca titolo="Numeri social non disponibili" testo={motivoSocial} />
	{/if}

{:else if scheda === 'campagne'}
	{#if campagne}
		<div class="mk-stats">
			<Stat etichetta="Spesa (30 giorni)" valore={euro(campagne.kpi.spesa, 2)} />
			<Stat etichetta="Lead" valore={num(campagne.kpi.lead)} />
			<Stat etichetta="Costo per lead" valore={euro(campagne.kpi.costoPerLead, 2)} />
			<Stat etichetta="Impressioni" valore={num(campagne.kpi.impressioni)} />
			<Stat etichetta="Clic" valore={num(campagne.kpi.clic)} />
		</div>
		{#if campagne.serie.length}
			<div class="dcard">
				<h3>Spesa giorno per giorno</h3>
				<div class="mk-bars">
					{#each campagne.serie as p (p.label)}
						<div class="mk-bar"><b>{p.lead ? p.lead : ''}</b><i style="height:{Math.round((p.spesa / maxSpesa) * 100)}%;background:var(--pink)"></i><span>{p.label}</span></div>
					{/each}
				</div>
				<div class="mk-legenda" style="margin-top:8px"><span><i style="background:var(--pink)"></i>Spesa</span><span>Il numero sopra la barra sono i lead del giorno</span></div>
			</div>
		{/if}
		<div class="dcard" style="padding:0;overflow-x:auto">
			<table class="dtable">
				<thead><tr><th>Campagna</th><th>Stato</th><th>Budget</th><th>Spesa</th><th>Lead</th><th>Costo/lead</th></tr></thead>
				<tbody>
					{#each campagne.campagne as k (k.id)}
						<tr><td><b>{k.nome}</b></td><td><span class="mk-chip {k.attiva ? 'mk-chip--green' : 'mk-chip--gray'}">{k.statoEtichetta}</span></td><td>{k.budget != null ? euro(k.budget, 2) + (k.budgetTipo === 'giornaliero' ? ' / giorno' : '') : '—'}</td><td>{euro(k.spesa, 2)}</td><td>{num(k.lead)}</td><td>{euro(k.costoPerLead, 2)}</td></tr>
					{:else}
						<tr><td colspan="6" style="text-align:center;color:var(--muted);padding:24px">Nessuna campagna nell'account pubblicitario.</td></tr>
					{/each}
				</tbody>
			</table>
		</div>
		<p class="mk-nota">{campagne.tiktok.motivo}</p>
		<Avvisi avvisi={campagne.avvisi} />
	{:else}
		<Manca titolo="Campagne non disponibili" testo={motivoCampagne} />
	{/if}

{:else if scheda === 'report'}
	<div class="mk-grid2">
		<div class="dcard">
			<h3>Nuovo report</h3>
			<form method="POST" action="?/report" use:enhance class="dform dform--1">
				<label>Tipo<select name="tipo">{#if data.report.ok}{#each Object.entries(data.report.etichette.tipi) as [k, l] (k)}<option value={k}>{l}</option>{/each}{/if}</select></label>
				<label>Periodo<select bind:value={periodo}>{#each PERIODI as p (p.key)}<option value={p.key}>{p.label} · {etichettaPeriodo(p.key)}</option>{/each}</select></label>
				<input type="hidden" name="da" value={isoData(intervallo.da)} /><input type="hidden" name="a" value={isoData(intervallo.a)} />
				<div class="mk-toggle">{#each PIATTAFORME as p (p.value)}<label class="is-on"><input type="checkbox" name="piattaforme" value={p.value} checked />{p.label}</label>{/each}</div>
				<div class="mk-toggle">{#each SEZIONI as s (s)}<label class="is-on"><input type="checkbox" name="sezioni" value={s} checked />{s}</label>{/each}</div>
				<button class="btn btn--sm btn--green" type="submit">Genera e archivia</button>
			</form>
		</div>
		<div class="dcard">
			<h3>Archivio</h3>
			{#if data.report.ok && data.report.report.length}
				<div class="mk-lista">
					{#each data.report.report as r (r.id)}
						<div class="mk-riga"><span>{r.name}<small>{dataBreve(r.period_from)} → {dataBreve(r.period_to)} · {r.platforms.join(', ')}</small></span><span class="mk-chip mk-chip--green">{r.status}</span></div>
					{/each}
				</div>
			{:else if data.report.ok}
				<p class="mk-nota">{data.report.avviso ?? 'Nessun report ancora.'}</p>
			{:else}
				<div class="mk-err">{data.report.errore}</div>
			{/if}
		</div>
	</div>
{/if}
