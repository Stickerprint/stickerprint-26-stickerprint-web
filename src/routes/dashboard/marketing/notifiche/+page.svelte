<script lang="ts">
	import { enhance } from '$app/forms';
	import Manca from '$lib/components/marketing/Manca.svelte';
	import { quandoRelativo } from '$lib/marketing/formato';
	let { data, form } = $props();
	const n = $derived(data.configurato && data.notifiche.ok ? data.notifiche : null);
	// il "vai a" della dashboard PERIZ tradotto nella pagina corrispondente qui
	const DOVE: Record<string, string> = {
		'/c/approvazioni': '/dashboard/marketing/approvazioni',
		'/c/programmazione': '/dashboard/marketing/programmazione',
		'/c/calendario': '/dashboard/marketing/appuntamenti',
		'/c/budget': '/dashboard/marketing/budget',
		'/c/campagne': '/dashboard/marketing/risultati?scheda=campagne',
		'/c/social': '/dashboard/marketing/risultati'
	};
	const WA: Record<string, string> = { inviato: 'WhatsApp inviato', errore: 'WhatsApp non partito', disattivato: 'WhatsApp spento', non_configurato: 'WhatsApp non configurato' };
</script>

<svelte:head><title>Notifiche | Marketing</title></svelte:head>

<div class="toolbar" style="justify-content:space-between">
	<div><h1>Notifiche</h1><p class="lead">Quello che PERIZ ti segnala: contenuti nuovi, appuntamenti confermati, pubblicazioni fatte. Con il numero, arrivano anche su WhatsApp.</p></div>
	{#if n && n.nonLette}<form method="POST" action="?/tutte" use:enhance><button class="btn btn--sm btn--ghost" type="submit">Segna tutte come lette ({n.nonLette})</button></form>{/if}
</div>

{#if form?.errore}<div class="mk-err">{form.errore}</div>{/if}
{#if form?.ok && form.messaggio}<div class="mk-ok">{form.messaggio}</div>{/if}

{#if !data.configurato}
	<Manca titolo="Collegamento con PERIZ Marketing non configurato" testo="Manca PERIZ_API_KEY nelle variabili d'ambiente del sito." />
{:else if !n}
	<div class="mk-err">{data.notifiche.ok ? '' : data.notifiche.errore}</div>
{:else}
	{#if n.avviso}<p class="mk-nota">{n.avviso}</p>{/if}
	<div class="mk-grid2" style="grid-template-columns:2fr 1fr">
		<div class="dcard">
			{#if n.notifiche.length}
				<div class="mk-lista">
					{#each n.notifiche as x (x.id)}
						<div class="mk-riga" class:non-letta={!x.letta_at}>
							<span>
								{x.titolo}<small>{x.testo ?? ''}</small>
								<small>{quandoRelativo(x.created_at)}{#if x.whatsapp_stato && x.whatsapp_stato !== 'inviato'} · {WA[x.whatsapp_stato] ?? x.whatsapp_stato}{#if x.whatsapp_errore}: {x.whatsapp_errore}{/if}{/if}</small>
							</span>
							<span style="display:flex;gap:6px;align-items:center">
								{#if x.link && DOVE[x.link]}<a class="btn btn--xs btn--white" href={DOVE[x.link]}>Vai</a>{/if}
								{#if !x.letta_at}<form method="POST" action="?/letta" use:enhance><input type="hidden" name="id" value={x.id} /><button class="btn btn--xs btn--ghost" type="submit">Letta</button></form>{/if}
							</span>
						</div>
					{/each}
				</div>
			{:else}
				<p class="mk-nota">Nessuna notifica finora.</p>
			{/if}
		</div>
		<div class="dcard">
			<h3>WhatsApp</h3>
			{#if n.whatsapp}
				<form method="POST" action="?/whatsapp" use:enhance class="dform dform--1">
					<label>Numero<input type="tel" name="numero" value={n.whatsapp.numero} placeholder="Es. 333 1234567" /></label>
					<label style="display:flex;gap:8px;align-items:center;font-weight:600"><input type="checkbox" name="attivo" checked={n.whatsapp.attivo} style="width:auto" /> Ricevi le notifiche su WhatsApp</label>
					<p class="mk-nota">Il prefisso internazionale lo aggiunge la dashboard. I messaggi arrivano dal numero WhatsApp di PERIZ Marketing.</p>
					<button class="btn btn--sm btn--green" type="submit">Salva</button>
				</form>
			{:else}
				<p class="mk-nota">Il brand non ha un account cliente nella dashboard PERIZ: le notifiche non hanno un destinatario.</p>
			{/if}
		</div>
	</div>
{/if}
