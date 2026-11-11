<script lang="ts">
	import { enhance } from '$app/forms';
	import { QUOTE_STATUS, REQUEST_STATUS, type QuoteStatus, type RequestStatus } from '$lib/dashboard/richieste';
	import { money, dmy } from '$lib/dashboard/orders';
	import { fmtAgo, fmtWhen } from '$lib/dashboard/produzione';
	let { data, form } = $props();
	const r = $derived(data.r);
	/* risposta dal sito: il riquadro si apre col bottone «Rispondi» (o da solo se c'e' gia' una conversazione) */
	let replyOpen = $state(false);
	let body = $state('');
	let sending = $state(false);
	/* allegati della risposta (Mattia, 11/11/2026): massimo 5 file da 25 MB. Vanno dritti nello storage dal browser
	   (le funzioni Vercel rifiutano i corpi oltre 4,5 MB) e al server arriva solo l'elenco. */
	const MAX_FILE = 25 * 1024 * 1024;
	let fileInput = $state<HTMLInputElement | null>(null);
	let allegati = $state<File[]>([]);
	let errAllegati = $state('');
	let fase = $state('');
	const peso = (b: number) => (b >= 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1).replace('.', ',')} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);
	function scegli() {
		errAllegati = '';
		const tutti = [...allegati, ...(fileInput?.files ?? [])].filter((f, i, a) => a.findIndex((x) => x.name === f.name && x.size === f.size) === i);
		const grande = tutti.find((f) => f.size > MAX_FILE);
		if (grande) errAllegati = `${grande.name} supera i 25 MB.`;
		else if (tutti.length > 5) errAllegati = 'Al massimo 5 allegati per risposta.';
		allegati = tutti.filter((f) => f.size <= MAX_FILE).slice(0, 5);
		if (fileInput) fileInput.value = '';
	}
	async function carica() {
		const out: { path: string; name: string; size: number; type?: string }[] = [];
		for (const [i, f] of allegati.entries()) {
			fase = `Carico ${i + 1} di ${allegati.length}…`;
			const ext = (f.name.includes('.') ? (f.name.split('.').pop() ?? '') : '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8) || 'bin';
			const path = `aziende/out/${r.id}/${Date.now()}-${crypto.randomUUID().slice(0, 6)}.${ext}`;
			const { error } = await data.supabase.storage.from('requests').upload(path, f, { contentType: f.type || undefined });
			if (error) throw new Error(`${f.name}: ${error.message}`);
			out.push({ path, name: f.name, size: f.size, type: f.type || undefined });
		}
		return out;
	}
	const st = $derived(REQUEST_STATUS[r.status as RequestStatus]);
</script>

<svelte:head><title>Richiesta di {r.company || r.name} | Dashboard</title></svelte:head>

<p class="lead" style="margin:0"><a class="link" href="/dashboard/aziende/richieste">Richieste aziende</a> › <b>{r.company || r.name || r.email}</b></p>
{#if form?.error}<p class="error">{form.error}</p>{/if}
{#if form?.message}<p class="ok">{form.message}</p>{/if}

<div class="rq-detail">
	<div class="dcard">
		<div class="toolbar" style="justify-content:space-between">
			<div><h3 style="margin:0">{r.company || r.name}</h3><div class="osub">{#if r.company && r.name}{r.name} · {/if}{r.email}{#if r.phone} · {r.phone}{/if} · ricevuta {fmtWhen(r.created_at)} ({fmtAgo(r.created_at)})</div></div>
			<span class="pill" style="background:{st.soft};color:{st.color}">{st.label}</span>
		</div>
		<div class="rq-message">{r.message}</div>
		{#if data.file}<p><a class="btn btn--ghost btn--xs" href={data.file}>📎 Scarica l'allegato</a></p>{/if}

		<div class="toolbar" style="margin-top:14px;gap:8px">
			{#if !data.quotes.length}
				<form method="POST" action="?/preventivo" use:enhance><button class="btn btn--green btn--xs" type="submit">📄 Crea preventivo</button></form>
			{:else}
				<form method="POST" action="?/preventivo" use:enhance><button class="btn btn--ghost btn--xs" type="submit">📄 Altro preventivo</button></form>
			{/if}
			<button class="btn btn--blue btn--xs" type="button" onclick={() => { replyOpen = !replyOpen; if (replyOpen) setTimeout(() => document.getElementById('rq-reply-body')?.focus(), 50); }}>✉ Rispondi</button>
			<form method="POST" action="?/stato" use:enhance class="pr-machine" style="margin-left:auto">
				<label class="osub">Stato <select name="status" value={r.status} onchange={(e) => (e.currentTarget.form as HTMLFormElement).requestSubmit()}>{#each Object.entries(REQUEST_STATUS) as [k, v] (k)}<option value={k}>{v.label}</option>{/each}</select></label>
			</form>
		</div>

		{#if data.messages.length}
			<h4 class="h4" style="margin:16px 0 8px">Conversazione</h4>
			<div class="hd-thread">
				{#each data.messages as m (m.id)}
					<div class="hd-msg hd-msg--{m.direction}">
						<div class="hd-msg__head"><b>{m.author ?? 'Stickerprint'} · {m.direction === 'note' ? 'nota interna' : 'risposta'}</b><span class="osub">{fmtWhen(m.created_at)} · {fmtAgo(m.created_at)}</span></div>
						<div class="hd-msg__body">{m.body}</div>
						{#if data.files[m.id]?.length}<div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:6px">{#each data.files[m.id] as f (f.href)}<a class="btn btn--ghost btn--xs" href={f.href}>📎 {f.name}</a>{/each}</div>{/if}
					</div>
				{/each}
			</div>
		{/if}

		{#if replyOpen || data.messages.length}
			<form method="POST" action="?/rispondi" use:enhance={async ({ formData, cancel }) => {
				sending = true; errAllegati = '';
				try { formData.set('files', JSON.stringify(await carica())); }
				catch (e) { errAllegati = `Allegato non caricato. ${e instanceof Error ? e.message : ''}`; sending = false; fase = ''; cancel(); return; }
				fase = 'Invio…';
				return async ({ update, result }) => { await update({ reset: false }); sending = false; fase = ''; if (result.type === 'success') { body = ''; allegati = []; } };
			}} style="display:grid;gap:10px;margin-top:14px">
				<textarea id="rq-reply-body" name="body" bind:value={body} rows="6" required placeholder="Ciao {r.name?.split(' ')[0] ?? ''}, …" style="padding:10px 12px;border:1px solid var(--line);border-radius:10px;font:inherit;font-size:14px"></textarea>
				{#if allegati.length}<div style="display:flex;flex-wrap:wrap;gap:6px">{#each allegati as a, i (a.name + a.size)}<span class="tag2 tag2--soft">📎 {a.name} · {peso(a.size)} <button type="button" aria-label="Togli {a.name}" disabled={sending} onclick={() => (allegati = allegati.filter((_, k) => k !== i))} style="border:0;background:none;cursor:pointer;font-weight:800;padding:0 0 0 4px;color:inherit">×</button></span>{/each}</div>{/if}
				{#if errAllegati}<p class="error" style="margin:0">{errAllegati}</p>{/if}
				<div class="toolbar" style="gap:10px">
					<button class="btn btn--blue btn--xs" type="submit" disabled={sending || !body.trim()}>{sending ? fase || 'Invio…' : '✉ Invia'}</button>
					<label class="btn btn--ghost btn--xs" style="cursor:pointer">📎 Allega file<input bind:this={fileInput} type="file" multiple hidden disabled={sending} onchange={scegli} /></label>
					<span class="osub">Il cliente riceve il testo{allegati.length ? ' e gli allegati' : ''} via email a {r.email} con la tua firma; una copia arriva a mattia@stickerprint.it. Se risponde, la risposta arriva nella nostra casella.</span>
				</div>
			</form>
		{/if}
	</div>

	<aside class="pr-side">
		<div class="dcard">
			<h3>Preventivi</h3>
			{#if data.quotes.length === 0}<p class="osub">Ancora nessun preventivo per questa richiesta.</p>{/if}
			<ul class="pr-list">
				{#each data.quotes as q (q.id)}
					{@const qs = QUOTE_STATUS[q.status as QuoteStatus]}
					<li><a class="pr-num" href="/dashboard/aziende/preventivi/{q.id}">{q.number}{#if q.version > 1} rev. {q.version}{/if}</a> · {money(Number(q.total_gross))} <span class="pill" style="background:{qs.soft};color:{qs.color}">{qs.label}</span><div class="osub">{dmy(q.created_at)}{#if q.order_group} · <a class="link" href="/dashboard/fatturazione/ordini/{q.order_group}">ordine ›</a>{/if}</div></li>
				{/each}
			</ul>
		</div>
		<div class="dcard">
			<h3>Cliente</h3>
			{#if data.contact}
				<p style="font-size:14px"><b>{data.contact.name}</b><br /><span class="osub">{data.contact.email ?? ''}{#if data.contact.phone} · {data.contact.phone}{/if}{#if data.contact.city} · {data.contact.city}{/if}</span></p>
				<a class="btn btn--ghost btn--xs" href="/dashboard/anagrafica/clienti?q={encodeURIComponent(data.contact.email ?? data.contact.name)}">Apri in anagrafica ›</a>
			{:else}
				<p class="osub">Non ancora in anagrafica.</p>
				<form method="POST" action="?/anagrafica" use:enhance><button class="btn btn--ghost btn--xs" type="submit">＋ Salva in anagrafica</button></form>
			{/if}
			{#if data.others.length}
				<p class="osub" style="margin-top:10px">Altre richieste dallo stesso indirizzo:</p>
				<ul class="pr-list">{#each data.others as o (o.id)}<li><a class="link" href="/dashboard/aziende/richieste/{o.id}">{dmy(o.created_at)}</a> · {REQUEST_STATUS[o.status as RequestStatus]?.label} · <span class="osub">{o.message.slice(0, 60)}…</span></li>{/each}</ul>
			{/if}
		</div>
		<div class="dcard">
			<h3>Note interne</h3>
			<form method="POST" action="?/note" use:enhance style="display:grid;gap:8px">
				<textarea name="notes" rows="4" style="padding:10px;border:1px solid var(--line);border-radius:8px;font:inherit;font-size:13.5px">{r.notes ?? ''}</textarea>
				<button class="btn btn--xs" type="submit" style="justify-self:start">Salva note</button>
			</form>
		</div>
		<form method="POST" action="?/elimina" use:enhance onsubmit={(e) => { if (!confirm(`Eliminare la richiesta di ${r.company || r.name || r.email}?\n\nSi cancellano il messaggio, le risposte scritte da qui e gli allegati.${data.quotes.length ? `\nI preventivi già creati (${data.quotes.length}) restano in Preventivi.` : ''}\nNon si può annullare.`)) e.preventDefault(); }}>
			<button class="btn btn--ghost btn--xs rq-del" type="submit">🗑 Elimina richiesta</button>
		</form>
	</aside>
</div>

<style>
	.rq-del { color: #c0392b; border-color: #e3b5ae; }
	.rq-del:hover { background: #fdecea; border-color: #c0392b; }
</style>
