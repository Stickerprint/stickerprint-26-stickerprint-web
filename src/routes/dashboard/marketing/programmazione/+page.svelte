<script lang="ts">
	import { enhance } from '$app/forms';
	import Manca from '$lib/components/marketing/Manca.svelte';
	import Anteprima from '$lib/components/marketing/Anteprima.svelte';
	import { isoData, piuGiorni, lunediDi, giornoSettimana, dataLunga, ora, statoContenuto, PIATTAFORME, PIATTAFORMA_LABEL } from '$lib/marketing/formato';
	import type { Contenuto } from '$lib/marketing/tipi';
	let { data, form } = $props();

	const tutti = $derived(data.configurato && data.contenuti.ok ? data.contenuti.contenuti : []);
	const inCoda = $derived(tutti.filter((c) => c.status === 'approvato'));
	const programmati = $derived(tutti.filter((c) => ['programmato', 'in_pubblicazione'].includes(c.status)).sort((a, b) => `${a.publish_date}${a.publish_time}`.localeCompare(`${b.publish_date}${b.publish_time}`)));
	const pubblicati = $derived(tutti.filter((c) => c.status === 'pubblicato').slice(0, 10));
	const falliti = $derived(tutti.filter((c) => c.publish_error));

	// la settimana: si scorre con le frecce, parte da lunedì
	let offset = $state(0);
	const oggi = isoData(new Date());
	const giorni = $derived(Array.from({ length: 7 }, (_, i) => {
		const d = piuGiorni(lunediDi(new Date()), offset * 7 + i);
		const iso = isoData(d);
		return { d, iso, eventi: tutti.filter((c) => c.publish_date === iso && ['programmato', 'in_pubblicazione', 'pubblicato'].includes(c.status)) };
	}));

	let modale = $state<Contenuto | null>(null);
	let piatt = $state<string[]>([]);
	function apri(c: Contenuto) { piatt = c.platforms?.length ? [...c.platforms] : ['instagram']; modale = c; }
	function toggle(p: string) { piatt = piatt.includes(p) ? piatt.filter((x) => x !== p) : [...piatt, p]; }
	$effect(() => { if (form?.ok) modale = null; });
</script>

<svelte:head><title>Programmazione | Marketing</title></svelte:head>

<div class="toolbar" style="justify-content:space-between">
	<div><h1>Programmazione</h1><p class="lead">Quando esce cosa. Un contenuto confermato viene pubblicato da solo alla data e all'ora scelte (ora italiana).</p></div>
	<div class="tabs"><button type="button" onclick={() => offset--}>‹</button><button type="button" class:is-active={offset === 0} onclick={() => (offset = 0)}>Questa settimana</button><button type="button" onclick={() => offset++}>›</button></div>
</div>

{#if form?.errore}<div class="mk-err">{form.errore}</div>{/if}
{#if form?.ok}<div class="mk-ok">{form.messaggio}</div>{/if}

{#if !data.configurato}
	<Manca titolo="Collegamento con PERIZ Marketing non configurato" testo="Manca PERIZ_API_KEY nelle variabili d'ambiente del sito." />
{:else if !data.contenuti.ok}
	<div class="mk-err">{data.contenuti.errore}</div>
{:else}
	<div class="mk-week">
		{#each giorni as g (g.iso)}
			<div class="mk-day" class:oggi={g.iso === oggi}>
				<h5>{giornoSettimana(g.d)}<b>{g.d.getDate()}</b></h5>
				{#each g.eventi as c (c.id)}
					<button type="button" class="mk-ev" class:pubblicato={c.status === 'pubblicato'} style="text-align:left;border:0;cursor:pointer;font:inherit" onclick={() => (c.status === 'pubblicato' ? null : apri(c))}>
						{c.title}<small>{ora(c.publish_time) || 'orario libero'} · {(c.platforms ?? []).map((p) => PIATTAFORMA_LABEL[p] ?? p).join(', ')}</small>
					</button>
				{/each}
			</div>
		{/each}
	</div>

	{#if falliti.length}
		<div class="mk-err">
			<b>Pubblicazioni non riuscite</b>
			{#each falliti as c (c.id)}<div>“{c.title}”: {c.publish_error}</div>{/each}
		</div>
	{/if}

	<div class="mk-grid2">
		<div class="dcard">
			<h3>In coda, da programmare ({inCoda.length})</h3>
			{#if inCoda.length}
				<div class="mk-lista">
					{#each inCoda as c (c.id)}
						<div class="mk-riga">
							<span>{c.title}<small>{c.content_type ?? ''}{#if c.publish_date} · bozza per il {dataLunga(c.publish_date)}{/if}</small></span>
							<button class="btn btn--xs btn--yellow" type="button" onclick={() => apri(c)}>Programma</button>
						</div>
					{/each}
				</div>
			{:else}
				<p class="mk-nota">La coda è vuota. I contenuti approvati arrivano qui, e da <a class="link" href="/dashboard/marketing/contenuti">Contenuti</a> puoi caricarne di tuoi.</p>
			{/if}
		</div>
		<div class="dcard">
			<h3>Programmati ({programmati.length})</h3>
			{#if programmati.length}
				<div class="mk-lista">
					{#each programmati as c (c.id)}
						<div class="mk-riga">
							<span>{c.title}<small>{dataLunga(c.publish_date)}{#if c.publish_time} alle {ora(c.publish_time)}{/if} · {(c.platforms ?? []).map((p) => PIATTAFORMA_LABEL[p] ?? p).join(', ')}</small></span>
							<span style="display:flex;gap:6px;align-items:center">
								<span class="mk-chip {statoContenuto(c.status).classe}">{statoContenuto(c.status).label}</span>
								{#if c.status === 'programmato'}<button class="btn btn--xs btn--ghost" type="button" onclick={() => apri(c)}>Cambia</button>{/if}
							</span>
						</div>
					{/each}
				</div>
			{:else}
				<p class="mk-nota">Niente in programma.</p>
			{/if}
		</div>
	</div>

	{#if pubblicati.length}
		<div class="dcard" style="padding:0;overflow-x:auto">
			<table class="dtable">
				<thead><tr><th>Pubblicato</th><th>Quando</th><th>Dove</th></tr></thead>
				<tbody>
					{#each pubblicati as c (c.id)}
						<tr><td><b>{c.title}</b></td><td>{dataLunga(c.publish_date)}{#if c.publish_time} · {ora(c.publish_time)}{/if}</td><td>{(c.platforms ?? []).map((p) => PIATTAFORMA_LABEL[p] ?? p).join(', ') || '—'}</td></tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
{/if}

{#if modale}
	<div class="dmodal-bg"><div class="dmodal">
		<h3>Programma “{modale.title}”</h3>
		<div style="max-width:260px"><Anteprima item={modale} /></div>
		<form method="POST" action="?/programma" use:enhance class="dform dform--1">
			<input type="hidden" name="id" value={modale.id} />
			<div class="row2">
				<label>Data<input type="date" name="data" required value={modale.publish_date ?? oggi} /></label>
				<label>Ora<input type="time" name="ora" value={ora(modale.publish_time) || '11:00'} /></label>
			</div>
			<div class="mk-toggle">
				{#each PIATTAFORME as p (p.value)}
					<label class:is-on={piatt.includes(p.value)}><input type="checkbox" name="piattaforme" value={p.value} checked={piatt.includes(p.value)} onchange={() => toggle(p.value)} />{p.label}</label>
				{/each}
			</div>
			<label>Didascalia<textarea name="didascalia" rows="4" placeholder="Il testo che accompagna il post">{modale.caption ?? ''}</textarea></label>
			<p class="mk-nota">TikTok non è collegato: un contenuto solo per TikTok viene segnato come da pubblicare a mano.</p>
			<div style="display:flex;gap:8px;justify-content:space-between;flex-wrap:wrap">
				<span style="display:flex;gap:8px">
					<button type="button" class="btn btn--ghost btn--xs" onclick={() => (modale = null)}>Annulla</button>
					{#if modale.status === 'programmato'}
						<button class="btn btn--ghost btn--xs" type="submit" formaction="?/annulla">Togli dal calendario</button>
					{/if}
				</span>
				<span style="display:flex;gap:8px">
					<button class="btn btn--white btn--sm" type="submit" name="conferma" value="0" disabled={!piatt.length}>Salva come bozza</button>
					<button class="btn btn--green btn--sm" type="submit" name="conferma" value="1" disabled={!piatt.length}>Conferma programmazione</button>
				</span>
			</div>
		</form>
	</div></div>
{/if}
