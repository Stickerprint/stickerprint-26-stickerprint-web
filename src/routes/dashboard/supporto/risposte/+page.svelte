<script lang="ts">
	import { enhance } from '$app/forms';
	let { data, form } = $props();
	let editing = $state<string | null>(null);
	let adding = $state(false);
</script>

<svelte:head><title>Risposte pronte | Dashboard</title></svelte:head>

<div class="toolbar" style="justify-content:space-between">
	<div><h1>Risposte pronte</h1><p class="lead">Modelli per le domande che tornano sempre. Nella scheda del ticket si inseriscono con un clic e si adattano prima di inviare. La parola <code>{'{nome}'}</code> diventa il nome del cliente.</p></div>
	<button class="btn btn--xs" type="button" onclick={() => (adding = !adding)}>＋ Nuova risposta</button>
</div>
{#if form?.error}<p class="error">{form.error}</p>{/if}
{#if form?.message}<p class="ok">{form.message}</p>{/if}

{#if adding}
	<form method="POST" action="?/salva" use:enhance={() => async ({ update }) => { await update(); adding = false; }} class="dcard hd-tpl">
		<div class="toolbar"><select name="kind" class="sel-sm"><option value="supporto">Risposta helpdesk</option><option value="preventivo">Email di invio preventivo</option></select><input name="subject" placeholder="Oggetto (solo per i preventivi)" style="flex:1" /></div>
		<input name="title" placeholder="Titolo (es. Tempi di produzione)" required />
		<textarea name="body" rows="4" placeholder={"Testo… puoi usare {nome} e {numero}"} required></textarea>
		<div class="toolbar"><label class="osub">Ordine <input name="sort" type="number" value="0" style="width:70px" /></label><button class="btn btn--green btn--xs" type="submit">Salva</button><button class="btn btn--ghost btn--xs" type="button" onclick={() => (adding = false)}>Annulla</button></div>
	</form>
{/if}

<div class="rq-list">
	{#each data.templates as t (t.id)}
		{#if editing === t.id}
			<form method="POST" action="?/salva" use:enhance={() => async ({ update }) => { await update(); editing = null; }} class="dcard hd-tpl">
				<input type="hidden" name="id" value={t.id} />
				<div class="toolbar"><select name="kind" class="sel-sm" value={t.kind ?? 'supporto'}><option value="supporto">Risposta helpdesk</option><option value="preventivo">Email di invio preventivo</option></select><input name="subject" value={t.subject ?? ''} placeholder="Oggetto (solo per i preventivi)" style="flex:1" /></div>
				<input name="title" value={t.title} required />
				<textarea name="body" rows="5" required>{t.body}</textarea>
				<div class="toolbar"><label class="osub">Ordine <input name="sort" type="number" value={t.sort} style="width:70px" /></label><button class="btn btn--green btn--xs" type="submit">Salva</button><button class="btn btn--ghost btn--xs" type="button" onclick={() => (editing = null)}>Annulla</button></div>
			</form>
		{:else}
			<div class="dcard" style="display:grid;gap:6px">
				<div class="toolbar" style="justify-content:space-between"><b>{t.title} <span class="pr-chip">{t.kind === 'preventivo' ? '📄 preventivi' : '💬 helpdesk'}</span>{#if t.subject}<span class="osub"> · {t.subject}</span>{/if}</b><div class="toolbar" style="gap:6px"><button class="btn btn--ghost btn--xs" type="button" onclick={() => (editing = t.id)}>Modifica</button><form method="POST" action="?/elimina" use:enhance><input type="hidden" name="id" value={t.id} /><button class="btn btn--ghost btn--xs" type="submit">🗑️</button></form></div></div>
				<div class="hd-msg__body" style="font-size:13.5px;color:var(--ink-soft)">{t.body}</div>
			</div>
		{/if}
	{:else}
		<div class="dcard" style="text-align:center;color:var(--muted)">Nessuna risposta pronta.</div>
	{/each}
</div>
