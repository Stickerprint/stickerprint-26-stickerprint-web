<script lang="ts">
	import { enhance } from '$app/forms';
	import { COMPLAINT_REASONS, TICKET_KIND, TICKET_STATUS, type TicketKind, type TicketStatus } from '$lib/dashboard/helpdesk';
	import { ORDER_STATUS, money, dmy } from '$lib/dashboard/orders';
	import { fmtAgo, fmtWhen } from '$lib/dashboard/produzione';
	let { data, form } = $props();
	const t = $derived(data.ticket);
	const st = $derived(TICKET_STATUS[t.status as TicketStatus]);
	let body = $state('');
	let next = $state('attesa_cliente');
	let sending = $state(false);
	const useTemplate = (id: string) => { const tpl = data.templates.find((x) => x.id === id); if (tpl) body = (body ? body + '\n\n' : '') + tpl.body.replace('{nome}', t.name?.split(' ')[0] ?? ''); };
	const submitAuto = (e: Event) => ((e.currentTarget as HTMLElement).closest('form') as HTMLFormElement).requestSubmit();
</script>

<svelte:head><title>{t.number} · {t.name || t.email} | Dashboard</title></svelte:head>

<p class="lead" style="margin:0"><a class="link" href="/dashboard/supporto/ticket">Richieste di aiuto</a> › <b>{t.number}</b> · {t.name || t.email} <span class="pill" style="background:{st.soft};color:{st.color};margin-left:6px">{st.label}</span></p>
{#if form?.error}<p class="error">{form.error}</p>{/if}
{#if form?.message}<p class="ok">{form.message}</p>{/if}

<div class="rq-detail">
	<div style="display:grid;gap:14px">
		<div class="dcard">
			<h3>Conversazione</h3>
			<div class="hd-thread">
				{#each data.messages as m (m.id)}
					<div class="hd-msg hd-msg--{m.direction}">
						<div class="hd-msg__head"><b>{m.direction === 'in' ? (m.author ?? t.email) : m.direction === 'out' ? `${m.author ?? 'Stickerprint'} · risposta` : `${m.author ?? 'staff'} · nota interna`}</b><span class="osub">{fmtWhen(m.created_at)} · {fmtAgo(m.created_at)}</span></div>
						<div class="hd-msg__body">{m.body}</div>
						{#if m.file_path}<a class="btn btn--ghost btn--xs" style="margin-top:6px" href={data.files[m.id] ?? '#'}>📎 Allegato</a>{/if}
					</div>
				{/each}
			</div>
		</div>

		<div class="dcard">
			<h3>Rispondi al cliente</h3>
			<form method="POST" action="?/rispondi" use:enhance={() => { sending = true; return async ({ update, result }) => { await update({ reset: false }); sending = false; if (result.type === 'success') body = ''; }; }} style="display:grid;gap:10px">
				<div class="toolbar" style="gap:8px">
					<select onchange={(e) => { useTemplate(e.currentTarget.value); e.currentTarget.value = ''; }} class="sel-sm"><option value="">📋 Inserisci una risposta pronta…</option>{#each data.templates as tpl (tpl.id)}<option value={tpl.id}>{tpl.title}</option>{/each}</select>
					<a class="link" style="font-size:12px" href="/dashboard/supporto/risposte">gestisci ›</a>
				</div>
				<textarea name="body" bind:value={body} rows="6" required placeholder="Ciao {t.name?.split(' ')[0] ?? ''}, …" style="padding:10px 12px;border:1px solid var(--line);border-radius:10px;font:inherit;font-size:14px"></textarea>
				<div class="toolbar" style="gap:10px">
					<label class="osub">Dopo l'invio <select name="next" bind:value={next} class="sel-sm"><option value="attesa_cliente">in attesa del cliente</option><option value="in_carico">resta in carico</option><option value="risolto">risolto</option><option value="chiuso">chiuso</option></select></label>
					<button class="btn btn--blue btn--xs" type="submit" disabled={sending || !body.trim()}>✉ Invia via email</button>
					<span class="osub">Il cliente riceve il testo e un link per rispondere.</span>
				</div>
			</form>
			<form method="POST" action="?/nota" use:enhance class="pr-block" style="margin-top:12px">
				<input name="body" placeholder="Nota interna (non la vede il cliente)…" required />
				<button class="btn btn--ghost btn--xs" type="submit">📝 Salva nota</button>
			</form>
		</div>
	</div>

	<aside class="pr-side">
		<div class="dcard">
			<h3>Ticket</h3>
			<form method="POST" action="?/aggiorna" use:enhance class="hd-form">
				<label class="osub">Stato<select name="status" value={t.status} class="sel-sm" onchange={submitAuto}>{#each Object.entries(TICKET_STATUS) as [k, v] (k)}<option value={k}>{v.label}</option>{/each}</select></label>
				<label class="osub">Tipo<select name="kind" value={t.kind} class="sel-sm" onchange={submitAuto}>{#each Object.entries(TICKET_KIND) as [k, v] (k)}<option value={k}>{v.icon} {v.label}</option>{/each}</select></label>
				{#if t.kind === 'lamentela' || t.kind === 'problema' || t.kind === 'reso'}
					<label class="osub">Motivo<select name="complaint_reason" value={t.complaint_reason ?? ''} class="sel-sm" onchange={submitAuto}><option value="">—</option>{#each COMPLAINT_REASONS as r (r)}<option value={r}>{r}</option>{/each}</select></label>
				{/if}
				<label class="osub">Ordine<input name="order_number" value={t.order_number ?? ''} placeholder="SP00123" class="sel-sm" onchange={submitAuto} /></label>
			</form>
			<dl class="pr-dl" style="margin-top:10px">
				<dt>Cliente</dt><dd>{t.name ?? '—'}</dd>
				<dt>Email</dt><dd><a class="link" href="mailto:{t.email}">{t.email}</a></dd>
				{#if t.phone}<dt>Telefono</dt><dd>{t.phone}</dd>{/if}
				<dt>Aperto</dt><dd>{fmtWhen(t.created_at)}</dd>
				{#if t.assigned}<dt>Seguito da</dt><dd>{t.assigned}</dd>{/if}
			</dl>
			<p class="osub" style="margin-top:8px"><a class="link" href="/assistenza/{t.token}" target="_blank" rel="noopener">Pagina vista dal cliente ›</a></p>
		</div>

		<div class="dcard">
			<h3>Ordine</h3>
			{#if data.order}
				{@const g = data.order}
				{@const os = ORDER_STATUS[g.status]}
				<p style="font-size:14px"><a class="pr-num" href="/dashboard/fatturazione/ordini/{g.key}">{g.number}</a> · {dmy(g.created_at)} · {money(g.gross)} <span class="pill" style="background:{os?.soft};color:{os?.color}">{os?.label ?? g.status}</span></p>
				<ul class="pr-list" style="margin-top:8px">
					{#each g.items as it (it.id)}
						<li>{it.qty} × {it.product_name}{#if it.shipping_status} · <span class="osub">{it.shipping_status}</span>{/if}{#if it.tracking_number} · <span class="osub">tracking {it.tracking_number}</span>{/if}
							<div class="toolbar" style="gap:6px;margin-top:4px"><a class="btn btn--ghost btn--xs" href="/dashboard/produzione/commessa/{it.id}">Commessa</a>{#if it.status === 'in_produzione' || it.status === 'pronto'}<a class="btn btn--ghost btn--xs" href="/dashboard/produzione/spedizioni">Spedizioni</a>{/if}</div>
						</li>
					{/each}
				</ul>
			{:else if t.order_number}
				<p class="osub">Nessun ordine trovato con il numero {t.order_number}: controlla il numero qui sopra.</p>
			{:else}
				<p class="osub">Il cliente non ha indicato un ordine.</p>
			{/if}
		</div>

		{#if data.others.length}
			<div class="dcard">
				<h3>Altre richieste dello stesso cliente</h3>
				<ul class="pr-list">{#each data.others as o (o.id)}<li><a class="pr-num" href="/dashboard/supporto/ticket/{o.id}">{o.number}</a> · {TICKET_KIND[o.kind as TicketKind]?.label} · {TICKET_STATUS[o.status as TicketStatus]?.label}<div class="osub">{o.subject ?? ''} · {dmy(o.created_at)}</div></li>{/each}</ul>
			</div>
		{/if}
	</aside>
</div>
