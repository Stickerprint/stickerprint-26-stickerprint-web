<script lang="ts">
	import { enhance } from '$app/forms';
	import OrderEditor from '$lib/components/dashboard/OrderEditor.svelte';
	import { QUOTE_STATUS, defaultQuoteEmail, type QuoteStatus } from '$lib/dashboard/richieste';
	import { money, dmy } from '$lib/dashboard/orders';
	import { fmtAgo, fmtWhen } from '$lib/dashboard/produzione';
	let { data, form } = $props();
	const q = $derived(data.q);
	const st = $derived(QUOTE_STATUS[q.status as QuoteStatus]);
	const editable = $derived(q.status === 'bozza' || q.status === 'inviato');
	// il PDF arriva dall'azione come base64: si apre in una nuova scheda
	$effect(() => { const b = form?.pdf as string | undefined; if (b) { const bin = atob(b); const arr = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i); window.open(URL.createObjectURL(new Blob([arr], { type: 'application/pdf' })), '_blank'); } });

	/* popup di invio: email proposta, si modifica prima di mandarla */
	let sendOpen = $state(false);
	let to = $state('');
	let cc = $state('');
	let subject = $state('');
	let message = $state('');
	let sender = $state('');
	let autoRemind = $state(true);
	let saveTemplate = $state(false);
	let templateTitle = $state('');
	let sending = $state(false);
	function openSend() {
		// legge la bozza corrente dall'editor (cliente e righe possono essere appena stati cambiati)
		let draft = q.draft;
		try { const raw = (document.querySelector('#order-editor input[name=payload]') as HTMLInputElement | null)?.value; if (raw) draft = JSON.parse(raw); } catch { /* bozza salvata */ }
		const totals = draft.items.reduce((a, i) => a + Number(i.qty || 0) * Number(i.price || 0), 0) * (draft.price_type === 'lordi' ? 1 : 1.22);
		const def = defaultQuoteEmail({ number: q.number, draft, total_gross: Math.round(totals * 100) / 100, valid_until: q.valid_until }, data.sender);
		to = draft.customer.email ?? '';
		subject = q.sent_subject ?? def.subject;
		message = q.sent_message ?? def.body;
		sender = q.sender_name ?? data.sender ?? '';
		autoRemind = q.auto_remind ?? true;
		sendOpen = true;
	}
	function useTemplate(id: string) { const t = data.templates.find((x) => x.id === id); if (!t) return; if (t.subject) subject = t.subject; message = t.body.replace('{nome}', q.draft.customer.first_name || q.draft.customer.name).replace('{numero}', q.number); }
	$effect(() => { if (data.openSend) openSend(); });
	$effect(() => { if (form?.sent) sendOpen = false; });
	const previewLines = $derived(message.split('\n'));
	const it = (d: string | null) => (d ? new Date(d + 'T12:00:00').toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' }) : '');
</script>

<svelte:head><title>Preventivo {q.number} | Dashboard</title></svelte:head>

<p class="lead" style="margin:0"><a class="link" href="/dashboard/aziende/preventivi">Preventivi</a> › <b>{q.number}{#if q.version > 1} rev. {q.version}{/if}</b> <span class="pill" style="background:{st.soft};color:{st.color};margin-left:6px">{st.label}</span></p>
{#if data.created}<p class="ok">Preventivo {data.created} creato. Controlla le righe, poi "Invia preventivo" per scrivere l'email.</p>{/if}
{#if form?.error && !(form as { sendError?: boolean }).sendError}<p class="error">{form.error}</p>{/if}
{#if form?.message}<p class="ok">{form.message}</p>{/if}

<div class="dcard qt-bar">
	<div class="qt-facts">
		<span><b>{money(Number(q.total_gross))}</b> IVA inclusa</span>
		<span>Creato {dmy(q.created_at)}</span>
		{#if q.sent_at}<span>✉ Inviato {fmtAgo(q.sent_at)}{#if q.sender_name} da {q.sender_name}{/if}{#if q.reminded_at} · sollecitato {fmtAgo(q.reminded_at)}{/if}</span>{/if}
		{#if q.sent_at}<span title="Aperture della pagina del preventivo">👁 {q.opened_count ? `aperto ${q.opened_count} ${q.opened_count === 1 ? 'volta' : 'volte'}, l'ultima ${fmtAgo(q.opened_at ?? null)}` : 'mai aperto'}</span>{/if}
		{#if q.pdf_downloaded_at}<span>📄 PDF scaricato {fmtAgo(q.pdf_downloaded_at)}</span>{/if}
		{#if q.accepted_at}<span>✅ Accettato {fmtWhen(q.accepted_at)} da {q.accepted_by}</span>{/if}
		{#if q.rejected_reason}<span>✕ {q.rejected_reason}</span>{/if}
		{#if data.req}<span>Da richiesta: <a class="link" href="/dashboard/aziende/richieste/{data.req.id}">{data.req.company || data.req.name}</a></span>{/if}
		{#if q.order_group}<span>📦 <a class="link" href="/dashboard/fatturazione/ordini/{q.order_group}">Apri l'ordine</a></span>{/if}
		{#if data.versions.length > 1}<span>Versioni: {#each data.versions as v, i (v.id)}{i ? ' · ' : ''}{#if v.id === q.id}<b>rev. {v.version}</b>{:else}<a class="link" href="/dashboard/aziende/preventivi/{v.id}">rev. {v.version}</a>{/if}{/each}</span>{/if}
	</div>
	<div class="qt-actions">
		{#if editable}<button class="btn btn--blue btn--xs" type="button" onclick={openSend}>✉ {q.status === 'inviato' ? 'Reinvia preventivo' : 'Invia preventivo'}</button>{/if}
		<form method="POST" action="?/validita" use:enhance class="pr-machine"><label class="osub">Valido fino al <input type="date" name="valid_until" value={q.valid_until ?? ''} onchange={(e) => (e.currentTarget.form as HTMLFormElement).requestSubmit()} disabled={!editable} /></label></form>
		<form method="POST" action="?/pdf" use:enhance><button class="btn btn--ghost btn--xs" type="submit">📄 Anteprima PDF</button></form>
		{#if q.status === 'inviato'}
			<form method="POST" action="?/sollecita" use:enhance><button class="btn btn--ghost btn--xs" type="submit">⏰ Sollecita ora</button></form>
			<form method="POST" action="?/stato" use:enhance><input type="hidden" name="status" value="accettato" /><input type="hidden" name="motivo" value="confermato a voce/email" /><button class="btn btn--ghost btn--xs" type="submit" title="Il cliente ha confermato per telefono o email">✓ Segna accettato</button></form>
			<form method="POST" action="?/stato" use:enhance><input type="hidden" name="status" value="rifiutato" /><input type="hidden" name="motivo" value="rifiutato (segnato dallo staff)" /><button class="btn btn--ghost btn--xs" type="submit">✕ Rifiutato</button></form>
		{/if}
		{#if q.status === 'accettato'}
			<form method="POST" action="?/ordine" use:enhance style="display:flex;gap:6px;align-items:center"><label class="osub" style="display:flex;gap:4px;align-items:center"><input type="checkbox" name="mail" checked /> conferma via email</label><button class="btn btn--green btn--xs" type="submit">📦 Crea ordine</button></form>
		{/if}
		{#if q.status !== 'ordinato'}<form method="POST" action="?/versione" use:enhance><button class="btn btn--ghost btn--xs" type="submit" title="Copia modificabile con lo stesso numero (rev. successiva)">↻ Nuova versione</button></form>{/if}
		<a class="btn btn--ghost btn--xs" href="/preventivo/{q.token}?anteprima=1" target="_blank" rel="noopener">🔗 Pagina del cliente</a>
	</div>
</div>

{#if data.messages.length || q.status === 'inviato' || q.status === 'accettato'}
	<div class="dcard">
		<h3>Conversazione con il cliente <small class="osub">(dalla pagina del preventivo)</small></h3>
		{#if data.messages.length === 0}<p class="osub">Nessuna domanda finora.</p>{/if}
		<div class="hd-thread" style="margin-bottom:12px">
			{#each data.messages as m (m.id)}
				<div class="hd-msg hd-msg--{m.direction}"><div class="hd-msg__head"><b>{m.direction === 'in' ? (m.author ?? 'Cliente') : `${m.author ?? 'Stickerprint'} · risposta`}</b><span class="osub">{fmtWhen(m.created_at)} · {fmtAgo(m.created_at)}</span></div><div class="hd-msg__body">{m.body}</div></div>
			{/each}
		</div>
		<form method="POST" action="?/rispondi" use:enhance class="pr-block">
			<input name="body" placeholder="Rispondi al cliente: riceve un'email con il link al preventivo…" required style="flex:1" />
			<button class="btn btn--blue btn--xs" type="submit">✉ Rispondi</button>
		</form>
	</div>
{/if}

{#if editable}
	<OrderEditor draft={q.draft} methods={data.methods} codes={data.codes} contacts={data.contacts} supabase={data.supabase} mode="edit" {form} title="Preventivo {q.number}" labels={{ lead: q.status === 'inviato' ? 'Preventivo già inviato: se cambi qualcosa, salva e reinvia; il cliente vede sempre la versione aggiornata allo stesso link.' : 'Bozza: cliente, articoli con prezzi e mockup, spedizione e condizioni di pagamento. Poi "Invia preventivo" per scrivere l\'email.', save: 'Salva preventivo', send: null, back: '/dashboard/aziende/preventivi' }} />
{:else}
	<div class="dcard">
		<h3>Contenuto</h3>
		<p class="osub">Preventivo {st.label.toLowerCase()}: non si modifica più. Per cambiare qualcosa crea una nuova versione.</p>
		<table class="dtable" style="margin-top:8px"><thead><tr><th>Codice</th><th>Descrizione</th><th>Q.tà</th><th>Prezzo</th></tr></thead><tbody>{#each q.draft.items as it, i (i)}<tr><td>{it.code}</td><td>{it.description}</td><td>{it.qty}</td><td>{money(Number(it.price))}</td></tr>{/each}</tbody></table>
		<p style="margin-top:10px;font-size:14px"><b>{q.draft.customer.name}</b> · {q.draft.customer.email}{#if q.draft.customer.phone} · {q.draft.customer.phone}{/if}</p>
		{#if q.sent_message}<h3 style="margin-top:16px">Email inviata</h3><p class="osub"><b>{q.sent_subject}</b></p><div class="hd-msg__body" style="font-size:13.5px;color:var(--ink-soft)">{q.sent_message}</div>{/if}
	</div>
{/if}

{#if sendOpen}
	<div class="dmodal-bg" role="presentation" onclick={(e) => { if (e.target === e.currentTarget) sendOpen = false; }}>
		<form class="dmodal dmodal--lg qt-send" method="POST" action="?/invia" use:enhance={() => { sending = true; const payload = (document.querySelector('#order-editor input[name=payload]') as HTMLInputElement | null)?.value ?? ''; (document.querySelector('#qt-payload') as HTMLInputElement).value = payload; return async ({ update }) => { await update({ reset: false }); sending = false; }; }}>
			<input type="hidden" name="payload" id="qt-payload" value="" />
			<h3>✉ Invia il preventivo {q.number}</h3>
			<p class="osub" style="margin:-6px 0 4px">Il cliente riceve solo questa email con il bottone "Apri il preventivo": prezzi, mockup, PDF e conferma sono sulla pagina.</p>
			{#if (form as { sendError?: boolean } | null)?.sendError}<p class="error">{form?.error}</p>{/if}
			<div class="qt-send__grid">
				<div class="qt-send__form">
					{#if data.templates.length}<select class="sel-sm" onchange={(e) => { useTemplate(e.currentTarget.value); e.currentTarget.value = ''; }}><option value="">📋 Parti da un modello…</option>{#each data.templates as t (t.id)}<option value={t.id}>{t.title}</option>{/each}</select>{/if}
					<label class="osub">A <input name="to" type="email" bind:value={to} required /></label>
					<label class="osub">Copia a (facoltativo) <input name="cc" bind:value={cc} placeholder="altro@azienda.it" /></label>
					<label class="osub">Oggetto <input name="subject" bind:value={subject} required /></label>
					<label class="osub">Testo <textarea name="message" bind:value={message} rows="10" required></textarea></label>
					<label class="osub">Firma <input name="sender" bind:value={sender} placeholder="Chi segue il cliente" /></label>
					<label class="osub qt-check"><input type="checkbox" name="auto_remind" bind:checked={autoRemind} /> Ricordaglielo da solo se non risponde entro 5 giorni</label>
					<label class="osub qt-check"><input type="checkbox" name="save_template" bind:checked={saveTemplate} /> Salva questo testo come modello</label>
					{#if saveTemplate}<label class="osub">Nome del modello <input name="template_title" bind:value={templateTitle} placeholder="Es. Etichette in bobina" /></label>{/if}
				</div>
				<div class="qt-send__preview">
					<div class="qt-mail">
						<div class="qt-mail__head">STICKERPRINT</div>
						<div class="qt-mail__body">
							<div class="qt-mail__subject">{subject || '…'}</div>
							<h4>Preventivo {q.number} <u>pronto</u> 📄</h4>
							{#each previewLines as l, i (i)}<p>{l || ' '}</p>{/each}
							{#if sender}<p class="qt-mail__sig">{sender} · Stickerprint · ti seguo io: rispondi pure a questa email.</p>{/if}
							<span class="qt-mail__btn">APRI IL PREVENTIVO</span>
							<p class="qt-mail__sig">Valido fino al {it(q.valid_until)}.</p>
						</div>
					</div>
				</div>
			</div>
			<div class="toolbar" style="justify-content:flex-end;gap:8px">
				<button class="btn btn--ghost btn--xs" type="button" onclick={() => (sendOpen = false)}>Annulla</button>
				<button class="btn btn--blue" type="submit" disabled={sending || !to || !subject.trim() || !message.trim()}>{sending ? 'Invio…' : '✉ Invia adesso'}</button>
			</div>
		</form>
	</div>
{/if}
