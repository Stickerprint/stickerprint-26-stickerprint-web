<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import OrderEditor from '$lib/components/dashboard/OrderEditor.svelte';
	import { ORDER_STATUS, ACTIVE_STATUSES, PROD_STAGES, CATS, COUNTRIES, money, dmy, itemMeta, thumbOf, DEVICE_ICON, CHANNEL_ICON } from '$lib/dashboard/orders';
	const statusOptions = (cur: string) => (ACTIVE_STATUSES.includes(cur) ? ACTIVE_STATUSES : [cur, ...ACTIVE_STATUSES]);
	import { draftFromGroup } from '$lib/dashboard/orderDraft';
	import { studioOrderHref } from '$lib/studio/products';
	import { paymentLabel, paymentIcon } from '$lib/dashboard/payments';
	let { data, form } = $props();
	const g = $derived(data.group);
	let editing = $state(false);
	const st = (s: string) => ORDER_STATUS[s] ?? { label: s, color: '#6b7280', soft: '#eceef3' };
	const addr = (a: Record<string, string> | null) => a ? [a.company, [a.first_name, a.last_name].filter(Boolean).join(' '), [a.street, a.street2].filter(Boolean).join(', '), [a.zip, a.city, a.province ? `(${a.province})` : ''].filter(Boolean).join(' '), COUNTRIES[a.country]?.name ?? a.country].filter(Boolean) : [];
	const first = $derived(g.items[0]);
	/* "Inizia produzione": ordine non ancora in coda (manuale appena creato, in attesa dell'anticipo, o del vecchio flusso) */
	const canStart = $derived(['attesa_pagamento', 'in_attesa', 'attesa_file', 'attesa_prova', 'modifiche_richieste', 'approvazione'].includes(g.status) || (g.status === 'in_produzione' && !first.prod_stage));
	const vat = $derived(g.gross - g.net);
	const terms = $derived(first.payment_terms ?? []);
	// dopo un salvataggio dall'editor si torna alla vista
	$effect(() => { if (form?.saved) { editing = false; invalidateAll(); } });

	/* conferma d'ordine: popup dell'email (si scrive prima di inviare), scadenze, conversazione */
	import { PAYMENT_STATUS, defaultConfirmEmail, upfrontDue } from '$lib/dashboard/conferme';
	import { fmtAgo, fmtWhen } from '$lib/dashboard/produzione';
	let sendOpen = $state(false);
	let to = $state(''); let cc = $state(''); let subject = $state(''); let message = $state(''); let sender = $state('');
	let sending = $state(false);
	const due = $derived(upfrontDue(data.payments));
	function openSend() {
		const def = defaultConfirmEmail(g, data.payments, data.sender);
		to = g.email; subject = data.conf.sent_subject ?? def.subject; message = data.conf.sent_message ?? def.body; sender = data.conf.sender_name ?? data.sender ?? '';
		sendOpen = true;
	}
	$effect(() => { if (data.openSend) openSend(); });
	$effect(() => { if (form?.sent) sendOpen = false; });
	const previewLines = $derived(message.split('\n'));
</script>

<svelte:head><title>Ordine {g.number} | Dashboard</title></svelte:head>

<p class="lead" style="margin:0"><a class="link" href="/dashboard/fatturazione/ordini">← Torna agli ordini</a></p>
{#if data.created}<p class="success">Ordine {data.created} creato.{#if data.mail} {data.mail}{/if}</p>{/if}
{#if form?.error && !(form as { sendError?: boolean }).sendError}<p class="error">{form.error}</p>{/if}
{#if form?.ok && form.message}<p class="success">{form.message}</p>{/if}

{#if editing}
	<OrderEditor draft={draftFromGroup(g, data.methods)} methods={data.methods} codes={data.codes} contacts={data.contacts} supabase={data.supabase} mode="edit" {form} title="Modifica ordine {g.number}" oncancel={() => (editing = false)} />
{:else}
	<div class="ohead">
		<div class="ohead__title">
			<h1>Ordine {g.number}</h1>
			<p class="lead">{dmy(g.created_at)} · {g.customer} · <span title={CHANNEL_ICON[g.channel]?.label}>{CHANNEL_ICON[g.channel]?.icon} {CHANNEL_ICON[g.channel]?.label}</span>{#if g.device} · {DEVICE_ICON[g.device]} da {g.device}{/if} · {COUNTRIES[g.country]?.flag ?? ''} {COUNTRIES[g.country]?.name ?? g.country}</p>
		</div>
		<!-- stato: lo porta avanti la produzione (reparti) e la pagina Spedizioni; da qui si cambia solo nei casi eccezionali -->
		<div class="ostate" style="background:{st(g.status).soft};color:{st(g.status).color};border-color:{st(g.status).color}">
			<small>Stato attuale</small>
			<b>{st(g.status).label}{#if g.status === 'in_produzione' && first.prod_stage} · {PROD_STAGES[first.prod_stage] ?? first.prod_stage}{/if}</b>
			<details class="ostate__more">
				<summary>Cambia a mano</summary>
				<form method="POST" action="?/status" use:enhance class="ostate__form">
					<select name="status" value={g.status} class="sel-sm">{#each statusOptions(g.status) as k (k)}<option value={k}>{ORDER_STATUS[k]?.label ?? k}</option>{/each}</select>
					<input type="hidden" name="prod_stage" value={first.prod_stage ?? ''} />
					<button class="btn btn--ghost btn--xs" type="submit">Applica</button>
				</form>
			</details>
		</div>
	</div>
	<!-- tutti i comandi dell'ordine: solo qui, mai in fondo alla pagina -->
	<div class="obar">
		{#if canStart}<form method="POST" action="?/produzione" use:enhance><button class="btn btn--green btn--xs" type="submit" title="L'ordine entra nella coda di produzione (prima lavorazione: stampa)">▶ Inizia produzione</button></form>{/if}
		<button type="button" class="btn btn--blue btn--xs" onclick={openSend} disabled={!g.email} title={g.email ? '' : 'L’ordine non ha un’email'}>✉️ {data.conf.sent_at ? 'Reinvia conferma' : 'Invia conferma'}</button>
		<button type="button" class="btn btn--yellow btn--xs" onclick={() => (editing = true)}>✏️ Modifica</button>
		<a class="btn btn--ghost btn--xs" href="/dashboard/fatturazione/ordini/nuovo?da={g.key}" title="Ordine nuovo, con numero nuovo, gia' compilato con questi dati">⧉ Duplica</a>
		<a class="btn btn--ghost btn--xs" href="/dashboard/fatturazione/ordini/{g.key}/pdf" target="_blank" rel="noopener">⬇ PDF conferma</a>
		<a class="btn btn--ghost btn--xs" href="/conferma/{data.conf.token}?anteprima=1" target="_blank" rel="noopener">🔗 Pagina del cliente</a>
		{#if data.conf.sent_at}<span class="osub">✉ inviata {fmtAgo(data.conf.sent_at)}{#if data.conf.sender_name} da {data.conf.sender_name}{/if} · 👁 {data.conf.opened_count ? `aperta ${data.conf.opened_count}×, ${fmtAgo(data.conf.opened_at)}` : 'mai aperta'}{#if data.conf.pdf_downloaded_at} · 📄 PDF scaricato{/if}</span>{/if}
		<form method="POST" action="?/delete" use:enhance onsubmit={(e) => { if (!confirm('Eliminare questo ordine?')) e.preventDefault(); }} style="margin-left:auto"><button class="link-btn" type="submit" style="color:#b3261e">🗑️ Elimina ordine</button></form>
	</div>

	<div class="grid3" style="grid-template-columns:1fr 1fr">
		<div class="dcard">
			<h3>👤 Cliente</h3>
			<p><b>{g.customer}</b><br />{#if g.email}<a class="link" href="mailto:{g.email}">{g.email}</a><br />{/if}{#if first.billing?.phone ?? first.shipping?.phone}{first.billing?.phone ?? first.shipping?.phone}{/if}</p>
			<div class="row2">
				<div><h4 class="h4">Fatturazione</h4><p class="small">{#each addr(first.billing) as l, k (k)}{l}<br />{/each}{#if first.billing?.vat}P.IVA {first.billing.vat}<br />{/if}{#if first.billing?.fiscal_code}C.F. {first.billing.fiscal_code}<br />{/if}{#if first.billing?.sdi}SDI {first.billing.sdi}{/if}</p></div>
				<div><h4 class="h4">Spedizione</h4><p class="small">{#each addr(first.shipping) as l, k (k)}{l}<br />{/each}</p></div>
			</div>
		</div>
		<div class="dcard">
			<h3>🚚 Spedizione e documenti</h3>
			<div class="sumrow"><span>Metodo</span><b>{g.shipping_method ?? 'Corriere espresso'}</b></div>
			<div class="sumrow"><span>Spedizione prevista</span><b>{dmy(g.delivery_date)}</b></div>
			{#if first.courier}<div class="sumrow"><span>Corriere</span><b>{first.courier}{#if first.parcels} · {first.parcels} {first.parcels === 1 ? 'collo' : 'colli'}{/if}</b></div>{/if}
			<form method="POST" action="?/tracking" use:enhance class="sumrow" style="align-items:center"><span>Tracking</span><span style="display:flex;gap:6px"><input name="tracking" class="sel-sm" style="max-width:220px" placeholder="link tracking" value={first.tracking_url ?? ''} /><button class="ibtn" type="submit" title="Salva">💾</button>{#if first.tracking_url}<a class="link" href={first.tracking_url} target="_blank" rel="noopener">↗</a>{/if}</span></form>
			{#if data.ddts.length}<div class="sumrow"><span>DDT</span><b style="text-align:right">{#each data.ddts as d, i (d.id)}{#if i > 0} · {/if}<a class="link" href="/dashboard/fatturazione/ddt/{d.id}/pdf" target="_blank">{d.number}</a>{/each}</b></div>{/if}
			{#if data.invoices.length}<div class="sumrow"><span>Fatture</span><b style="text-align:right">{#each data.invoices as inv, i (inv.id)}{#if i > 0}<br />{/if}<a class="link" href="/dashboard/fatturazione/fatture/{inv.id}">{inv.number}</a> · {money(Number(inv.amount_gross))}{/each}</b></div>{/if}
			{#if !['spedito', 'in_consegna', 'consegnato', 'annullato'].includes(g.status)}
				<details class="delay">
					<summary>🙏 Avvisa il cliente di un nostro ritardo{#if first.shipping_notified?.includes('ritardo_nostro')} <span class="pr-chip">già avvisato</span>{/if}</summary>
					<form method="POST" action="?/ritardo" use:enhance style="display:grid;gap:8px;margin-top:8px">
						<label class="osub delay__field">Nuova data di spedizione <input type="date" name="nuova_data" class="sel-sm" /></label>
						<label class="osub delay__field delay__field--col">Motivo (come lo legge il cliente)<textarea name="motivo" rows="6" class="sel-sm delay__text">Durante il controllo qualità sulla tua tiratura abbiamo trovato un dettaglio di stampa che non ci convinceva, e abbiamo preferito rifarla piuttosto che spedirti qualcosa di imperfetto.</textarea></label>
						<button class="btn btn--ghost btn--xs" type="submit" style="justify-self:start" disabled={!g.email}>✉ Invia le scuse{#if first.user_id} (con link all'ordine){/if}</button>
					</form>
				</details>
			{/if}
			<div class="sumrow"><span>Stato pagamento</span><b>{first.payment_status === 'paid' ? 'Pagato' : first.payment_status === 'test' ? 'Test (nessun addebito)' : 'In attesa'}</b></div>
			{#if first.internal_notes}<h4 class="h4">Note interne</h4><p class="small">{first.internal_notes}</p>{/if}
			{#if first.notes}<h4 class="h4">Note del cliente</h4><p class="small">{first.notes}</p>{/if}
		</div>
	</div>

	<div class="dcard">
		<h3>📦 Articoli e file</h3>
		<div class="items">
			{#each g.items as it (it.id)}
				{@const img = thumbOf(it)}
				<div class="oitem">
					<div class="oitem__file">
						{#if img}<img src={img} alt="Anteprima {it.product_name}" />{:else}<div class="oitem__nofile">Nessuna anteprima</div>{/if}
						<span class="oitem__tag">{it.auto_proof ? 'Prova automatica confermata dal cliente' : it.channel === 'manuale' ? 'Mockup' : 'In attesa di prova'}</span>
					</div>
					<div class="oitem__body">
						<div class="toolbar" style="justify-content:space-between">
							<div><b class="oid">{it.number}</b> · <b>{it.product_name}</b><div class="osub">{itemMeta(it)}{#if it.product_code} · codice {it.product_code}{/if}{#if it.lamination && it.lamination !== 'nessuna'} · laminazione {it.lamination}{/if}</div></div>
							<span class="cat" style="background:{CATS[it.product_slug]?.soft};color:{CATS[it.product_slug]?.color}">{CATS[it.product_slug]?.name ?? it.product_slug}</span>
						</div>
						<div class="sumrow"><span>Quantità</span><b>{it.qty.toLocaleString('it-IT')} pz</b></div>
						<div class="sumrow"><span>Prezzo unitario</span><b>{money(Number(it.unit_net ?? Number(it.total_net) / it.qty))}</b></div>
						<div class="sumrow"><span>Imponibile</span><b>{money(Number(it.total_net))}</b></div>
						<div class="ofiles">
							{#if data.files[it.id] && studioOrderHref(it.product_slug, it.id)}<a class="btn btn--blue btn--xs" href={studioOrderHref(it.product_slug, it.id)} target="_blank" rel="noopener">Passa il file su Stickerprint Studio</a>{/if}
							{#if data.fileLists[it.id]?.length}
								{#each data.fileLists[it.id] as f, k (f.name)}<a class="btn btn--ghost btn--xs" href={f.url} target="_blank" rel="noopener" download={f.name}>⬇ {f.name.startsWith('cavallotto') ? 'Cavallotto' : 'Adesivo ' + f.name.replace(/\D/g, '')} ({f.name.split('.').pop()?.toUpperCase()})</a>{/each}
							{:else if data.files[it.id]}<a class="btn btn--ghost btn--xs" href={data.files[it.id]} target="_blank" rel="noopener" download>⬇ Scarica file cliente</a>{:else}<span class="btn btn--ghost btn--xs is-off">File cliente non presente</span>{/if}
						</div>
						{#if g.items.length > 1}
							<form method="POST" action="?/status" use:enhance class="oitem__status">
								<input type="hidden" name="item" value={it.id} />
								<label>Stato<select name="status" value={it.status} class="sel-sm">{#each statusOptions(it.status) as k (k)}<option value={k}>{ORDER_STATUS[k]?.label ?? k}</option>{/each}</select></label>
								<input type="hidden" name="prod_stage" value={it.prod_stage ?? ''} />
								<button class="btn btn--ghost btn--xs" type="submit">Salva</button>
							</form>
						{/if}
					</div>
				</div>
			{/each}
		</div>
	</div>

	<div class="dcard">
		<h3>🧾 Riepilogo <span class="note">Compare nella conferma d'ordine in PDF</span></h3>
		<div class="riepilogo">
			<div>
				<div class="h4" style="margin-top:0">Scadenze di pagamento</div>
				{#if data.payments.length}
					<table class="dtable"><thead><tr><th>Metodo di pagamento</th><th>Scadenza</th><th style="text-align:right">Importo</th><th>Stato</th></tr></thead>
						<tbody>{#each data.payments as p (p.id)}{@const ps = PAYMENT_STATUS[p.status]}<tr><td>{#if paymentIcon(p.method)}<img src={paymentIcon(p.method)} alt="" style="height:16px;vertical-align:middle;margin-right:6px" />{/if}{paymentLabel(p.method)}{#if p.upfront} <span class="pr-chip" title="Si incassa prima di produrre">anticipato</span>{/if}</td><td>{dmy(p.due)}</td><td style="text-align:right"><b>{money(Number(p.amount))}</b></td><td><span class="pill" style="background:{ps.soft};color:{ps.color}">{ps.label}</span>{#if p.status === 'pagato'}<div class="osub">{fmtWhen(p.paid_at)}{#if p.provider_ref} · {p.provider_ref}{/if}</div><form method="POST" action="?/pagamento" use:enhance style="margin-top:4px"><input type="hidden" name="seq" value={p.seq} /><input type="hidden" name="stato" value="da_pagare" /><button class="link-btn" type="submit" style="font-size:12px">annulla</button></form>{:else}<form method="POST" action="?/pagamento" use:enhance class="pr-block" style="margin-top:4px"><input type="hidden" name="seq" value={p.seq} /><input type="hidden" name="stato" value="pagato" /><input name="rif" placeholder="rif. bonifico (facoltativo)" style="min-width:150px;font-size:12px" /><button class="btn btn--green btn--xs" type="submit">✓ Segna pagato</button></form>{/if}</td></tr>{/each}</tbody></table>
					{#if due > 0}<div class="osub" style="margin-top:8px">⏳ Anticipo da incassare: <b>{money(due)}</b>. La produzione parte quando è pagato.{#if data.conf.sent_at} <form method="POST" action="?/promemoria" use:enhance style="display:inline"><button class="link-btn" type="submit" style="font-size:12px">Manda un promemoria</button></form>{/if}</div>{/if}
				{:else if terms.length}
					<table class="dtable"><thead><tr><th>Metodo di pagamento</th><th>Scadenza</th><th style="text-align:right">Importo</th></tr></thead>
						<tbody>{#each terms as t, i (i)}<tr><td>{#if paymentIcon(t.method)}<img src={paymentIcon(t.method)} alt="" style="height:16px;vertical-align:middle;margin-right:6px" />{/if}{paymentLabel(t.method)}</td><td>{dmy(t.due)}</td><td style="text-align:right"><b>{money(Number(t.amount))}</b></td></tr>{/each}</tbody></table>
				{:else}
					<div class="sumrow"><span>Metodo di pagamento</span><b>{#if paymentIcon(g.payment_method)}<img src={paymentIcon(g.payment_method)} alt="" style="height:18px;vertical-align:middle;margin-right:6px" />{/if}{paymentLabel(g.payment_method)}</b></div>
				{/if}
			</div>
			<div class="tot-box">
				<div class="sumrow"><span>Imponibile</span><b>{money(g.net)}</b></div>
				<div class="sumrow"><span>IVA 22%</span><b>{money(vat)}</b></div>
				<div class="sumrow sumrow--tot"><span>Totale IVA inclusa</span><b>{money(g.gross)}</b></div>
			</div>
		</div>
	</div>

	{#if data.messages.length || data.conf.sent_at}
		<div class="dcard">
			<h3>💬 Dalla pagina della conferma <span class="note">domande e segnalazioni del cliente</span></h3>
			{#if data.messages.length === 0}<p class="osub">Nessun messaggio finora.</p>{/if}
			<div class="hd-thread" style="margin-bottom:12px">
				{#each data.messages as m (m.id)}
					<div class="hd-msg hd-msg--{m.direction}"><div class="hd-msg__head"><b>{m.direction === 'in' ? `${m.author ?? 'Cliente'}${m.kind === 'errore' ? ' · ⚠ segnala un errore' : ''}` : `${m.author ?? 'Stickerprint'} · risposta`}</b><span class="osub">{fmtWhen(m.created_at)} · {fmtAgo(m.created_at)}</span></div><div class="hd-msg__body">{m.body}</div></div>
				{/each}
			</div>
			<form method="POST" action="?/rispondi" use:enhance class="pr-block"><input name="body" placeholder="Rispondi al cliente: riceve un'email con il link alla conferma…" required style="flex:1" /><button class="btn btn--blue btn--xs" type="submit">✉ Rispondi</button></form>
		</div>
	{/if}

	{#if sendOpen}
		<div class="dmodal-bg" role="presentation" onclick={(e) => { if (e.target === e.currentTarget) sendOpen = false; }}>
			<form class="dmodal dmodal--lg qt-send" method="POST" action="?/invia" use:enhance={() => { sending = true; return async ({ update }) => { await update({ reset: false }); sending = false; }; }}>
				<h3>✉ Invia la conferma d'ordine {g.number}</h3>
				<p class="osub" style="margin:-6px 0 4px">Il cliente riceve solo questa email con il bottone "Apri la conferma d'ordine": dettagli, PDF, scadenze e pagamento sono sulla pagina.</p>
				{#if (form as { sendError?: boolean } | null)?.sendError}<p class="error">{form?.error}</p>{/if}
				<div class="qt-send__grid">
					<div class="qt-send__form">
						<label class="osub">A <input name="to" type="email" bind:value={to} required /></label>
						<label class="osub">Copia a (facoltativo) <input name="cc" bind:value={cc} placeholder="altro@azienda.it" /></label>
						<label class="osub">Oggetto <input name="subject" bind:value={subject} required /></label>
						<label class="osub">Testo <textarea name="message" bind:value={message} rows="11" required></textarea></label>
						<label class="osub">Firma <input name="sender" bind:value={sender} placeholder="Chi segue il cliente" /></label>
					</div>
					<div class="qt-send__preview">
						<div class="qt-mail">
							<div class="qt-mail__head">STICKERPRINT</div>
							<div class="qt-mail__body">
								<div class="qt-mail__subject">{subject || '…'}</div>
								<h4>Conferma d'ordine {g.number} <u>pronta</u> 📦</h4>
								{#each previewLines as l, i (i)}<p>{l || '\u00a0'}</p>{/each}
								{#if due > 0}<p style="background:#fef6db;padding:10px 12px;border-radius:8px"><b>Da pagare adesso: {money(due)}</b>. Trovi le istruzioni e i bottoni di pagamento nella pagina della conferma.</p>{/if}
								{#if sender}<p class="qt-mail__sig">{sender} · Stickerprint · ti seguo io: rispondi pure a questa email.</p>{/if}
								<span class="qt-mail__btn">APRI LA CONFERMA D'ORDINE</span>
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
{/if}
