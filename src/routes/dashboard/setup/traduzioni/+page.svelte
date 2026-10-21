<script lang="ts">
	import { enhance } from '$app/forms';
	let { data, form } = $props();
	let inCorso = $state(false);
	const esito = $derived(form as { ok?: boolean; error?: string; fatte?: number; restano?: number } | null);
</script>

<svelte:head><title>Traduzioni dei contenuti | Dashboard Stickerprint</title></svelte:head>

<div>
	<h1>Traduzioni dei contenuti</h1>
	<p class="lead">FAQ, categorie, articoli del blog e offerte scritti qui in italiano vengono tradotti in spagnolo, francese, tedesco, olandese e inglese dal traduttore automatico (ogni notte alle 6:30, oppure subito con il bottone). Se cambi un testo italiano, la traduzione si rifà da sola al giro dopo.</p>
</div>

{#if data.errore}<p class="error">{data.errore}</p>{/if}
{#if esito?.error}<p class="error">{esito.error}{#if esito.fatte} · tradotte {esito.fatte}{/if}</p>{/if}
{#if esito?.ok}<p class="success">Tradotte {esito.fatte} righe{#if (esito.restano ?? 0) > 0}, ne restano {esito.restano}: premi ancora{:else}: tutto tradotto{/if}.</p>{/if}

<div class="card" style="margin-top:18px">
	<p><b>{data.totale - data.restano}</b> su <b>{data.totale}</b> contenuti tradotti{#if data.restano > 0} · <b>{data.restano}</b> da tradurre{/if}{#if !data.attivo} · <span style="color:#b45309">traduttore non attivo (manca la chiave API)</span>{/if}</p>
	<form method="POST" action="?/traduci" use:enhance={() => { inCorso = true; return async ({ update }) => { await update(); inCorso = false; }; }}>
		<button class="btn" type="submit" disabled={inCorso || !data.attivo || !data.restano}>{inCorso ? 'Traduzione in corso…' : 'Traduci ora'}</button>
	</form>
	{#if data.elenco.length}
		<h3 style="margin-top:16px">Da tradurre</h3>
		<ul class="osub">{#each data.elenco as l (l.tabella + l.id)}<li><small>{l.tabella}</small> · {l.testo}</li>{/each}</ul>
	{/if}
</div>
