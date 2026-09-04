<script lang="ts">
	import { enhance } from '$app/forms';
	import Manca from '$lib/components/marketing/Manca.svelte';
	import Anteprima from '$lib/components/marketing/Anteprima.svelte';
	import { dataLunga, quandoRelativo, statoContenuto, PIATTAFORMA_LABEL, euro } from '$lib/marketing/formato';
	import type { Contenuto } from '$lib/marketing/tipi';
	let { data, form } = $props();

	const tutti = $derived(data.configurato && data.contenuti.ok ? data.contenuti.contenuti : []);
	const commenti = $derived(data.configurato && data.contenuti.ok ? data.contenuti.commenti : []);
	const daApprovare = $derived(tutti.filter((c) => c.status === 'in_attesa'));
	const conModifiche = $derived(tutti.filter((c) => c.status === 'modifiche_richieste'));
	const decisi = $derived(tutti.filter((c) => !['in_attesa', 'modifiche_richieste'].includes(c.status)).slice(0, 12));

	let modifica = $state<Contenuto | null>(null);
	let apri = $state<Contenuto | null>(null);
	let inviando = $state(false);
	$effect(() => { if (form?.ok) { modifica = null; apri = null; } });
	const commentiDi = (id: string) => commenti.filter((c) => c.approval_id === id);
</script>

<svelte:head><title>Approvazioni | Marketing</title></svelte:head>

<div class="toolbar" style="justify-content:space-between">
	<div><h1>Approvazioni</h1><p class="lead">I contenuti che PERIZ ha preparato e aspettano il tuo sì. Approvato o con modifiche, l'agenzia riceve subito un WhatsApp.</p></div>
	{#if daApprovare.length}<span class="pill" style="background:var(--pink);color:#fff">{daApprovare.length} da approvare</span>{/if}
</div>

{#if form?.errore}<div class="mk-err">{form.errore}</div>{/if}
{#if form?.ok}<div class="mk-ok">{form.messaggio}</div>{/if}

{#if !data.configurato}
	<Manca titolo="Collegamento con PERIZ Marketing non configurato" testo="Manca PERIZ_API_KEY nelle variabili d'ambiente del sito." />
{:else if !data.contenuti.ok}
	<div class="mk-err">{data.contenuti.errore}</div>
{:else}
	<section>
		<h3 class="h4" style="margin-bottom:10px">Da approvare</h3>
		{#if daApprovare.length}
			<div class="mk-cards">
				{#each daApprovare as c (c.id)}
					<div class="dcard mk-card">
						<Anteprima item={c} />
						<div class="mk-card__body">
							<div class="mk-card__row"><h4>{c.title}</h4><span class="mk-chip {statoContenuto(c.status).classe}">{statoContenuto(c.status).label}</span></div>
							<span class="mk-nota">{c.content_type ?? ''}{#if c.platforms?.length} · {c.platforms.map((p) => PIATTAFORMA_LABEL[p] ?? p).join(', ')}{/if}{#if c.version} · v{c.version}{/if}</span>
							{#if c.message_to_client}<p style="margin:0;font-size:13px;line-height:1.5">“{c.message_to_client}”</p>{/if}
							{#if c.respond_by}<span class="mk-nota">Risposta entro il {dataLunga(c.respond_by)}</span>{/if}
							{#if c.suggested_budget != null}<span class="mk-nota">Budget ADV consigliato: <b>{euro(c.suggested_budget)}</b></span>{/if}
							{#if c.sent_at}<span class="mk-nota">Inviato {quandoRelativo(c.sent_at)}</span>{/if}
						</div>
						<div class="mk-card__act">
							<form method="POST" action="?/approva" use:enhance={() => { inviando = true; return async ({ update }) => { inviando = false; await update(); }; }}>
								<input type="hidden" name="id" value={c.id} />
								<button class="btn btn--sm btn--green" type="submit" disabled={inviando}>Approva</button>
							</form>
							<button class="btn btn--sm btn--ghost" type="button" onclick={() => (modifica = c)}>Chiedi modifiche</button>
							{#if c.url}<button class="btn btn--sm btn--white" type="button" onclick={() => (apri = c)}>Guarda</button>{/if}
						</div>
					</div>
				{/each}
			</div>
		{:else}
			<div class="soon"><b>Niente da approvare</b><span>Quando PERIZ prepara un contenuto nuovo lo trovi qui, e ricevi una notifica.</span></div>
		{/if}
	</section>

	{#if conModifiche.length}
		<section>
			<h3 class="h4" style="margin-bottom:10px">Con modifiche richieste</h3>
			<div class="mk-cards">
				{#each conModifiche as c (c.id)}
					<div class="dcard mk-card">
						<Anteprima item={c} />
						<div class="mk-card__body">
							<div class="mk-card__row"><h4>{c.title}</h4><span class="mk-chip {statoContenuto(c.status).classe}">{statoContenuto(c.status).label}</span></div>
							{#each commentiDi(c.id).slice(0, 2) as k (k.id)}
								<span class="mk-nota"><b>{k.author_role === 'client' ? 'Tu' : 'PERIZ'}:</b> {k.message}</span>
							{/each}
							<span class="mk-nota">PERIZ sta preparando la versione nuova.</span>
						</div>
					</div>
				{/each}
			</div>
		</section>
	{/if}

	{#if decisi.length}
		<section>
			<h3 class="h4" style="margin-bottom:10px">Già decisi</h3>
			<div class="dcard" style="padding:0;overflow-x:auto">
				<table class="dtable">
					<thead><tr><th>Contenuto</th><th>Tipo</th><th>Stato</th><th>Pubblicazione</th></tr></thead>
					<tbody>
						{#each decisi as c (c.id)}
							<tr>
								<td><b>{c.title}</b></td>
								<td>{c.content_type ?? '—'}</td>
								<td><span class="mk-chip {statoContenuto(c.status).classe}">{statoContenuto(c.status).label}</span></td>
								<td>{c.publish_date ? dataLunga(c.publish_date) : '—'}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</section>
	{/if}
{/if}

{#if modifica}
	<div class="dmodal-bg"><div class="dmodal dmodal--sm">
		<h3>Chiedi modifiche a “{modifica.title}”</h3>
		<form method="POST" action="?/modifiche" use:enhance class="dform dform--1">
			<input type="hidden" name="id" value={modifica.id} />
			<label>Cosa va cambiato<textarea name="messaggio" rows="4" required placeholder="Es. il testo in copertina è troppo piccolo, e il logo va a destra"></textarea></label>
			<div style="display:flex;gap:8px;justify-content:flex-end"><button type="button" class="btn btn--ghost btn--xs" onclick={() => (modifica = null)}>Annulla</button><button class="btn btn--yellow" type="submit">Invia a PERIZ</button></div>
		</form>
	</div></div>
{/if}

{#if apri}
	<div class="dmodal-bg" role="presentation" onclick={() => (apri = null)}><div class="dmodal" role="presentation" onclick={(e) => e.stopPropagation()}>
		<h3>{apri.title}</h3>
		{#if apri.media === 'video'}
			<!-- svelte-ignore a11y_media_has_caption -->
			<video src={apri.url} controls playsinline style="width:100%;border-radius:12px"></video>
		{:else if apri.media === 'immagine'}
			<img src={apri.url} alt={apri.title} style="width:100%;border-radius:12px" />
		{:else}
			<a class="btn btn--sm btn--blue" href={apri.url} target="_blank" rel="noopener">Apri il file ↗</a>
		{/if}
		{#if apri.caption}<p class="mk-nota">{apri.caption}</p>{/if}
		<div style="display:flex;justify-content:flex-end"><button type="button" class="btn btn--ghost btn--xs" onclick={() => (apri = null)}>Chiudi</button></div>
	</div></div>
{/if}
