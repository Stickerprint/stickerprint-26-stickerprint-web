<script lang="ts">
	import { enhance } from '$app/forms';
	import { TICKET_STATUS, type TicketStatus } from '$lib/dashboard/helpdesk';
	let { data, form } = $props();
	const t = $derived(data.ticket);
	const st = $derived(TICKET_STATUS[t.status as TicketStatus]);
	const when = (d: string) => new Date(d).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
	let body = $state('');
</script>

<svelte:head><title>Richiesta {t.number} | Stickerprint</title><meta name="robots" content="noindex" /></svelte:head>

<section class="section" style="padding-top:40px">
	<div class="container" style="max-width:760px">
		<p class="kicker">Richiesta {t.number} · {st?.label}</p>
		<h1 style="margin-bottom:8px">Ciao {t.name?.split(' ')[0] || ''}, qui c'è tutta la conversazione</h1>
		<p class="lead">Ogni risposta ti arriva anche via email. Se vuoi aggiungere dettagli o una foto, scrivi qui sotto.{#if t.order_number}&nbsp;Ordine collegato: <b>{t.order_number}</b>.{/if}</p>
		{#if form?.error}<p class="error">{form.error}</p>{/if}
		{#if form?.ok}<p class="ok">Messaggio inviato: ti rispondiamo il prima possibile.</p>{/if}

		<div class="hd-thread" style="margin-top:22px">
			{#each data.messages as m (m.id)}
				<div class="hd-msg hd-msg--{m.direction}">
					<div class="hd-msg__head"><b>{m.direction === 'in' ? 'Tu' : 'Stickerprint'}</b><span class="note">{when(m.created_at)}</span></div>
					<div class="hd-msg__body">{m.body}</div>
					{#if m.file_path && data.files[m.id]}<a class="link" style="font-size:13px" href={data.files[m.id]} target="_blank" rel="noopener">📎 Allegato</a>{/if}
				</div>
			{/each}
		</div>

		<form method="POST" use:enhance={() => async ({ update, result }) => { await update({ reset: false }); if (result.type === 'success') body = ''; }} enctype="multipart/form-data" class="panel" style="display:grid;gap:10px;margin-top:22px">
			<label style="display:grid;gap:6px;font-weight:700;font-size:14px">Rispondi<textarea name="body" bind:value={body} rows="4" required style="padding:12px 14px;border:1px solid var(--line);border-radius:12px;font:inherit"></textarea></label>
			<label style="display:grid;gap:6px;font-size:13px">Allegato (foto o file, max 25 MB)<input name="file" type="file" accept="image/*,.pdf,.zip" /></label>
			<button class="btn btn--blue" type="submit" style="justify-self:start" disabled={!body.trim()}>Invia</button>
		</form>
	</div>
</section>
