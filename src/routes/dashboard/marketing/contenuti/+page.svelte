<script lang="ts">
	import { deserialize, applyAction } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import Manca from '$lib/components/marketing/Manca.svelte';
	import Anteprima from '$lib/components/marketing/Anteprima.svelte';
	import { dataLunga, ora, quandoRelativo, statoContenuto, euro, PIATTAFORME, PIATTAFORMA_LABEL } from '$lib/marketing/formato';
	import type { ActionResult } from '@sveltejs/kit';
	let { data } = $props();

	const tutti = $derived(data.configurato && data.contenuti.ok ? data.contenuti.contenuti : []);
	const conteggi = $derived(data.configurato && data.contenuti.ok ? data.contenuti.conteggi : null);
	const FILTRI = [
		['tutti', 'Tutti'], ['in_attesa', 'Da approvare'], ['approvato', 'Da programmare'],
		['programmato', 'Programmati'], ['pubblicato', 'Pubblicati'], ['modifiche_richieste', 'Con modifiche']
	] as const;
	let filtro = $state<string>('tutti');
	let cerca = $state('');
	const lista = $derived(tutti.filter((c) => (filtro === 'tutti' || c.status === filtro) && (!cerca || c.title.toLowerCase().includes(cerca.toLowerCase()))));
	const conteggio = (s: string) => (s === 'tutti' ? tutti.length : tutti.filter((c) => c.status === s).length);

	// caricamento di un contenuto nostro
	const TIPI = ['Post', 'Reel / video', 'Storia', 'Carosello', 'Altro'];
	let carica = $state(false);
	let file = $state<File | null>(null);
	let titolo = $state('');
	let tipo = $state('Post');
	let piatt = $state<string[]>(['instagram']);
	let fase = $state('');
	let errore = $state('');
	let esito = $state('');
	function toggle(p: string) { piatt = piatt.includes(p) ? piatt.filter((x) => x !== p) : [...piatt, p]; }

	async function azione(nome: string, campi: Record<string, string | string[]>): Promise<ActionResult> {
		const fd = new FormData();
		for (const [k, v] of Object.entries(campi)) (Array.isArray(v) ? v : [v]).forEach((x) => fd.append(k, x));
		const res = await fetch(`?/${nome}`, { method: 'POST', body: fd, headers: { 'x-sveltekit-action': 'true' } });
		return deserialize(await res.text());
	}
	async function invia() {
		errore = ''; esito = '';
		if (!file) { errore = 'Scegli un file.'; return; }
		if (!titolo.trim()) { errore = 'Manca il titolo del contenuto.'; return; }
		if (!piatt.length) { errore = 'Scegli almeno una piattaforma.'; return; }
		try {
			fase = 'Preparo il caricamento…';
			const a = await azione('inizio', { nome_file: file.name });
			if (a.type !== 'success' || !a.data?.url) { errore = (a.type === 'failure' && (a.data as { errore?: string })?.errore) || 'La dashboard non ha autorizzato il caricamento.'; fase = ''; return; }
			fase = `Carico ${file.name}…`;
			const put = await fetch(String(a.data.url), { method: 'PUT', body: file, headers: { 'Content-Type': file.type || 'application/octet-stream', 'x-upsert': 'false' } });
			if (!put.ok) { errore = `Il file non è stato caricato (${put.status}).`; fase = ''; return; }
			fase = 'Registro il contenuto…';
			const b = await azione('fine', { path: String(a.data.path), titolo: titolo.trim(), tipo, piattaforme: piatt });
			if (b.type !== 'success') { errore = (b.type === 'failure' && (b.data as { errore?: string })?.errore) || 'Il contenuto non è stato registrato.'; fase = ''; return; }
			esito = String((b.data as { messaggio?: string })?.messaggio ?? 'Caricato.');
			fase = ''; carica = false; file = null; titolo = '';
			await applyAction(b);
			await invalidateAll();
		} catch (e) {
			errore = e instanceof Error ? e.message : 'Caricamento non riuscito.';
			fase = '';
		}
	}
</script>

<svelte:head><title>Contenuti | Marketing</title></svelte:head>

<div class="toolbar" style="justify-content:space-between">
	<div><h1>Contenuti</h1><p class="lead">Tutto quello che PERIZ ha preparato e quello che hai caricato tu, con lo stato di ognuno.</p></div>
	{#if data.configurato}<button type="button" class="btn btn--sm btn--green" onclick={() => (carica = true)}>＋ Carica un contenuto tuo</button>{/if}
</div>

{#if esito}<div class="mk-ok">{esito}</div>{/if}

{#if !data.configurato}
	<Manca titolo="Collegamento con PERIZ Marketing non configurato" testo="Manca PERIZ_API_KEY nelle variabili d'ambiente del sito." />
{:else if !data.contenuti.ok}
	<div class="mk-err">{data.contenuti.errore}</div>
{:else}
	<div class="dcard filters" style="grid-template-columns:1fr auto">
		<div class="tabs">
			{#each FILTRI as [k, l] (k)}<button type="button" class:is-active={filtro === k} onclick={() => (filtro = k)}>{l} <span class="osub">{conteggio(k)}</span></button>{/each}
		</div>
		<input type="text" placeholder="Cerca per titolo…" bind:value={cerca} />
	</div>
	{#if conteggi?.errori}<div class="mk-err">{conteggi.errori} pubblicazioni non riuscite: il motivo è scritto sul contenuto.</div>{/if}

	{#if lista.length}
		<div class="mk-cards">
			{#each lista as c (c.id)}
				<div class="dcard mk-card">
					<Anteprima item={c} />
					<div class="mk-card__body">
						<div class="mk-card__row"><h4>{c.title}</h4><span class="mk-chip {statoContenuto(c.status).classe}">{statoContenuto(c.status).label}</span></div>
						<span class="mk-nota">{c.content_type ?? ''}{#if c.platforms?.length} · {c.platforms.map((p) => PIATTAFORMA_LABEL[p] ?? p).join(', ')}{/if}</span>
						{#if c.publish_date}<span class="mk-nota">{c.status === 'pubblicato' ? 'Pubblicato' : 'Programmato'} il {dataLunga(c.publish_date)}{#if c.publish_time} alle {ora(c.publish_time)}{/if}</span>{/if}
						{#if c.budget_ads != null}<span class="mk-nota">Budget ADV {euro(c.budget_ads)}</span>{/if}
						{#if c.publish_error}<span class="mk-nota" style="color:#b3261e">{c.publish_error}</span>{/if}
						{#if c.sent_at}<span class="mk-nota">{quandoRelativo(c.sent_at)}</span>{/if}
					</div>
					<div class="mk-card__act">
						{#if c.status === 'in_attesa'}<a class="btn btn--xs btn--yellow" href="/dashboard/marketing/approvazioni">Approva</a>{/if}
						{#if c.status === 'approvato'}<a class="btn btn--xs btn--yellow" href="/dashboard/marketing/programmazione">Programma</a>{/if}
						{#if c.url}<a class="btn btn--xs btn--white" href={c.url} target="_blank" rel="noopener">Apri</a>{/if}
					</div>
				</div>
			{/each}
		</div>
	{:else}
		<div class="soon"><b>Nessun contenuto{#if filtro !== 'tutti'} con questo filtro{/if}</b><span>I contenuti di PERIZ arrivano da Approvazioni; i tuoi li carichi dal pulsante in alto.</span></div>
	{/if}
{/if}

{#if carica}
	<div class="dmodal-bg"><div class="dmodal dmodal--sm">
		<h3>Carica un contenuto tuo</h3>
		<p class="mk-nota">Entra nella coda già approvato (è roba tua), pronto da programmare. Foto o video.</p>
		<div class="dform dform--1">
			<label>File<input type="file" accept="image/*,video/*,.pdf" onchange={(e) => (file = (e.currentTarget as HTMLInputElement).files?.[0] ?? null)} /></label>
			<label>Titolo<input type="text" bind:value={titolo} placeholder="Es. Nuovi adesivi olografici" /></label>
			<label>Tipo<select bind:value={tipo}>{#each TIPI as t (t)}<option value={t}>{t}</option>{/each}</select></label>
			<div class="mk-toggle">
				{#each PIATTAFORME as p (p.value)}<label class:is-on={piatt.includes(p.value)}><input type="checkbox" checked={piatt.includes(p.value)} onchange={() => toggle(p.value)} />{p.label}</label>{/each}
			</div>
			{#if errore}<div class="mk-err">{errore}</div>{/if}
			{#if fase}<div class="mk-nota">{fase}</div>{/if}
			<div style="display:flex;gap:8px;justify-content:flex-end"><button type="button" class="btn btn--ghost btn--xs" onclick={() => (carica = false)} disabled={!!fase}>Annulla</button><button type="button" class="btn btn--green" onclick={invia} disabled={!!fase}>Carica</button></div>
		</div>
	</div></div>
{/if}
