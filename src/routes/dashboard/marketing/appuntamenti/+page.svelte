<script lang="ts">
	import { enhance } from '$app/forms';
	import Manca from '$lib/components/marketing/Manca.svelte';
	import { isoData, piuGiorni, lunediDi, giornoSettimana, dataLunga, ora, quandoRelativo, TIPO_ATTIVITA, STATO_RICHIESTA } from '$lib/marketing/formato';
	let { data, form } = $props();

	const r = $derived(data.configurato && data.appuntamenti.ok ? data.appuntamenti : null);
	const oggi = isoData(new Date());
	const prossimi = $derived(r ? r.appuntamenti.filter((a) => a.date >= oggi) : []);
	const passati = $derived(r ? r.appuntamenti.filter((a) => a.date < oggi).slice(-6).reverse() : []);
	let offset = $state(0);
	const giorni = $derived(Array.from({ length: 7 }, (_, i) => {
		const d = piuGiorni(lunediDi(new Date()), offset * 7 + i);
		const iso = isoData(d);
		return { d, iso, eventi: r ? r.appuntamenti.filter((a) => a.date === iso) : [] };
	}));
	let aperto = $state(false);
	$effect(() => { if (form?.ok) aperto = false; });
</script>

<svelte:head><title>Appuntamenti | Marketing</title></svelte:head>

<div class="toolbar" style="justify-content:space-between">
	<div><h1>Appuntamenti</h1><p class="lead">Riprese, call e riunioni con PERIZ. Tu chiedi quando preferisci, l'agenzia conferma.</p></div>
	<div style="display:flex;gap:8px;align-items:center">
		<div class="tabs"><button type="button" onclick={() => offset--}>‹</button><button type="button" class:is-active={offset === 0} onclick={() => (offset = 0)}>Questa settimana</button><button type="button" onclick={() => offset++}>›</button></div>
		{#if r}<button type="button" class="btn btn--sm btn--yellow" onclick={() => (aperto = true)}>Richiedi un appuntamento</button>{/if}
	</div>
</div>

{#if form?.errore}<div class="mk-err">{form.errore}</div>{/if}
{#if form?.ok}<div class="mk-ok">{form.messaggio}</div>{/if}

{#if !data.configurato}
	<Manca titolo="Collegamento con PERIZ Marketing non configurato" testo="Manca PERIZ_API_KEY nelle variabili d'ambiente del sito." />
{:else if !r}
	<div class="mk-err">{data.appuntamenti.ok ? '' : data.appuntamenti.errore}</div>
{:else}
	<div class="mk-week">
		{#each giorni as g (g.iso)}
			<div class="mk-day" class:oggi={g.iso === oggi}>
				<h5>{giornoSettimana(g.d)}<b>{g.d.getDate()}</b></h5>
				{#each g.eventi as a (a.id)}
					<div class="mk-ev {a.type}">{a.title}<small>{ora(a.time) || 'orario da definire'} · {TIPO_ATTIVITA[a.type] ?? a.type}</small></div>
				{/each}
			</div>
		{/each}
	</div>
	{#if r.avviso}<p class="mk-nota">{r.avviso}</p>{/if}

	<div class="mk-grid2">
		<div class="dcard">
			<h3>Le tue richieste</h3>
			{#if r.richieste.length}
				<div class="mk-lista">
					{#each r.richieste as q (q.id)}
						<div class="mk-riga">
							<span>{r.etichette.tipi[q.type] ?? q.type}<small>{q.preferred_date ? dataLunga(q.preferred_date) : 'data da concordare'} · {r.etichette.fasce[q.time_slot ?? ''] ?? q.time_slot ?? ''}{#if q.notes} · {q.notes}{/if}<br />chiesta {quandoRelativo(q.created_at)}</small></span>
							<span class="mk-chip {STATO_RICHIESTA[q.status]?.classe ?? 'mk-chip--gray'}">{STATO_RICHIESTA[q.status]?.label ?? q.status}</span>
						</div>
					{/each}
				</div>
			{:else}
				<p class="mk-nota">Nessuna richiesta fatta finora.</p>
			{/if}
		</div>
		<div class="dcard">
			<h3>Prossimi appuntamenti</h3>
			{#if prossimi.length}
				<div class="mk-lista">
					{#each prossimi as a (a.id)}
						<div class="mk-riga"><span>{a.title}<small>{TIPO_ATTIVITA[a.type] ?? a.type} · {dataLunga(a.date)}{#if a.time} alle {ora(a.time)}{/if}{#if a.notes} · {a.notes}{/if}</small></span></div>
					{/each}
				</div>
			{:else}
				<p class="mk-nota">Nessun appuntamento fissato.</p>
			{/if}
			{#if passati.length}
				<h3 style="margin-top:18px">Già fatti</h3>
				<div class="mk-lista">
					{#each passati as a (a.id)}<div class="mk-riga"><span>{a.title}<small>{dataLunga(a.date)}</small></span></div>{/each}
				</div>
			{/if}
		</div>
	</div>
{/if}

{#if aperto && r}
	<div class="dmodal-bg"><div class="dmodal dmodal--sm">
		<h3>Richiedi un appuntamento</h3>
		<p class="mk-nota">Scegli quando preferisci: la richiesta arriva a PERIZ Marketing per la conferma.</p>
		<form method="POST" action="?/richiedi" use:enhance class="dform dform--1">
			<label>Tipo<select name="tipo">{#each Object.entries(r.etichette.tipi) as [k, l] (k)}<option value={k}>{l}</option>{/each}</select></label>
			<div class="row2">
				<label>Data preferita<input type="date" name="data" min={oggi} /></label>
				<label>Fascia<select name="fascia">{#each Object.entries(r.etichette.fasce) as [k, l] (k)}<option value={k}>{l}</option>{/each}</select></label>
			</div>
			<label>Note<textarea name="note" rows="3" placeholder="Cosa vorresti fare, dove, con chi"></textarea></label>
			<div style="display:flex;gap:8px;justify-content:flex-end"><button type="button" class="btn btn--ghost btn--xs" onclick={() => (aperto = false)}>Annulla</button><button class="btn btn--green" type="submit">Invia la richiesta</button></div>
		</form>
	</div></div>
{/if}
