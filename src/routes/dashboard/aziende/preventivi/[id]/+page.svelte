<script lang="ts">
	import { enhance } from '$app/forms';
	import OrderEditor from '$lib/components/dashboard/OrderEditor.svelte';
	import { QUOTE_STATUS, type QuoteStatus } from '$lib/dashboard/richieste';
	import { money, dmy } from '$lib/dashboard/orders';
	import { fmtAgo, fmtWhen } from '$lib/dashboard/produzione';
	let { data, form } = $props();
	const q = $derived(data.q);
	const st = $derived(QUOTE_STATUS[q.status as QuoteStatus]);
	const editable = $derived(q.status === 'bozza' || q.status === 'inviato');
	let message = $state('');
	// il PDF arriva dall'azione come base64: si apre in una nuova scheda
	$effect(() => { const b = form?.pdf as string | undefined; if (b) { const bin = atob(b); const arr = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i); window.open(URL.createObjectURL(new Blob([arr], { type: 'application/pdf' })), '_blank'); } });
	const publicLink = $derived(`${typeof location !== 'undefined' ? location.origin : ''}/preventivo/${q.token}`);
</script>

<svelte:head><title>Preventivo {q.number} | Dashboard</title></svelte:head>

<p class="lead" style="margin:0"><a class="link" href="/dashboard/aziende/preventivi">Preventivi</a> › <b>{q.number}{#if q.version > 1} rev. {q.version}{/if}</b> <span class="pill" style="background:{st.soft};color:{st.color};margin-left:6px">{st.label}</span></p>
{#if data.created}<p class="ok">Preventivo {data.created} creato.{#if data.mail} {data.mail}{/if}</p>{/if}
{#if form?.error}<p class="error">{form.error}</p>{/if}
{#if form?.message}<p class="ok">{form.message}</p>{/if}

<div class="dcard qt-bar">
	<div class="qt-facts">
		<span><b>{money(Number(q.total_gross))}</b> IVA inclusa</span>
		<span>Creato {dmy(q.created_at)}</span>
		{#if q.sent_at}<span>Inviato {fmtAgo(q.sent_at)}{#if q.reminded_at} · sollecitato {fmtAgo(q.reminded_at)}{/if}</span>{/if}
		{#if q.accepted_at}<span>✅ Accettato {fmtWhen(q.accepted_at)} da {q.accepted_by}</span>{/if}
		{#if q.rejected_reason}<span>✕ {q.rejected_reason}</span>{/if}
		{#if data.req}<span>Da richiesta: <a class="link" href="/dashboard/aziende/richieste/{data.req.id}">{data.req.company || data.req.name}</a></span>{/if}
		{#if q.order_group}<span>📦 <a class="link" href="/dashboard/fatturazione/ordini/{q.order_group}">Apri l'ordine</a></span>{/if}
		{#if data.versions.length > 1}<span>Versioni: {#each data.versions as v, i (v.id)}{i ? ' · ' : ''}{#if v.id === q.id}<b>rev. {v.version}</b>{:else}<a class="link" href="/dashboard/aziende/preventivi/{v.id}">rev. {v.version}</a>{/if}{/each}</span>{/if}
	</div>
	<div class="qt-actions">
		<form method="POST" action="?/validita" use:enhance class="pr-machine"><label class="osub">Valido fino al <input type="date" name="valid_until" value={q.valid_until ?? ''} onchange={(e) => (e.currentTarget.form as HTMLFormElement).requestSubmit()} disabled={!editable} /></label></form>
		<form method="POST" action="?/pdf" use:enhance><button class="btn btn--ghost btn--xs" type="submit">📄 Anteprima PDF</button></form>
		{#if q.status === 'inviato'}
			<form method="POST" action="?/sollecita" use:enhance><button class="btn btn--ghost btn--xs" type="submit">✉ Sollecita</button></form>
			<form method="POST" action="?/stato" use:enhance><input type="hidden" name="status" value="accettato" /><input type="hidden" name="motivo" value="confermato a voce/email" /><button class="btn btn--ghost btn--xs" type="submit" title="Il cliente ha confermato per telefono o email">✓ Segna accettato</button></form>
			<form method="POST" action="?/stato" use:enhance><input type="hidden" name="status" value="rifiutato" /><input type="hidden" name="motivo" value="rifiutato (segnato dallo staff)" /><button class="btn btn--ghost btn--xs" type="submit">✕ Rifiutato</button></form>
		{/if}
		{#if q.status === 'accettato'}
			<form method="POST" action="?/ordine" use:enhance style="display:flex;gap:6px;align-items:center"><label class="osub" style="display:flex;gap:4px;align-items:center"><input type="checkbox" name="mail" checked /> conferma via email</label><button class="btn btn--green btn--xs" type="submit">📦 Crea ordine</button></form>
		{/if}
		{#if q.status !== 'ordinato'}<form method="POST" action="?/versione" use:enhance><button class="btn btn--ghost btn--xs" type="submit" title="Copia modificabile con lo stesso numero (rev. successiva)">↻ Nuova versione</button></form>{/if}
		<a class="btn btn--ghost btn--xs" href="/preventivo/{q.token}" target="_blank" rel="noopener" title={publicLink}>🔗 Pagina del cliente</a>
	</div>
</div>

{#if editable}
	<div class="dcard" style="padding:12px 16px">
		<label class="osub" style="display:grid;gap:4px">Messaggio nell'email di invio (facoltativo)<textarea bind:value={message} rows="2" placeholder="Es. come da telefonata, ho previsto la lamina opaca; i tempi partono dall'approvazione dell'anteprima." style="padding:8px 10px;border:1px solid var(--line);border-radius:8px;font:inherit;font-size:13.5px"></textarea></label>
		<input form="order-editor" type="hidden" name="messaggio" value={message} />
	</div>
	<OrderEditor draft={q.draft} methods={data.methods} codes={data.codes} contacts={data.contacts} supabase={data.supabase} mode="edit" {form} title="Preventivo {q.number}" labels={{ lead: q.status === 'inviato' ? 'Preventivo già inviato: salvando o reinviando il cliente vede la versione aggiornata allo stesso link.' : 'Bozza: cliente, articoli con prezzi, spedizione e condizioni di pagamento.', save: 'Salva preventivo', send: 'Invia preventivo per email', back: '/dashboard/aziende/preventivi' }} />
{:else}
	<div class="dcard">
		<h3>Contenuto</h3>
		<p class="osub">Preventivo {st.label.toLowerCase()}: non si modifica più. Per cambiare qualcosa crea una nuova versione.</p>
		<table class="dtable" style="margin-top:8px"><thead><tr><th>Codice</th><th>Descrizione</th><th>Q.tà</th><th>Prezzo</th></tr></thead><tbody>{#each q.draft.items as it, i (i)}<tr><td>{it.code}</td><td>{it.description}</td><td>{it.qty}</td><td>{money(Number(it.price))}</td></tr>{/each}</tbody></table>
		<p style="margin-top:10px;font-size:14px"><b>{q.draft.customer.name}</b> · {q.draft.customer.email}{#if q.draft.customer.phone} · {q.draft.customer.phone}{/if}</p>
	</div>
{/if}
