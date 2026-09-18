<script lang="ts">
	import { enhance } from '$app/forms';
	import { CATS, ORDER_STATUS, itemMeta, dmy, thumbOf } from '$lib/dashboard/orders';
	import { COLOURS, fmtAgo, fmtDay, fmtMin, fmtWhen, STAGES, TASK_STATUS } from '$lib/dashboard/produzione';
	import TaskActions from '$lib/components/dashboard/TaskActions.svelte';
	import { studioOrderHref } from '$lib/studio/products';
	let { data, form } = $props();
	const o = $derived(data.order);
	const thumb = $derived(thumbOf(o));
	let reprinting = $state(false);
	const EVENT_ICON: Record<string, string> = { pianificata: '🗓', in_produzione: '🏁', iniziata: '▶', completata: '✓', bloccata: '⚠', sbloccata: '🔓', ristampa: '↻', data_spostata: '📅', sollecito: '✉', macchina: '⚙️', nota: '📝', pronta: '📦' };
	const projectedLate = $derived(!!(data.projected && o.ship_by && new Date(data.projected) > new Date(o.ship_by + 'T15:00:00Z')));
	const doneAll = $derived(data.timeline.every((x) => x.task.status === 'completato'));
</script>

<svelte:head><title>Commessa {o.number} | Dashboard</title></svelte:head>

<div class="toolbar" style="justify-content:space-between;align-items:flex-start">
	<div>
		<h1>Commessa {o.number}</h1>
		<p class="lead">{o.qty.toLocaleString('it-IT')} × {o.product_name}{#if itemMeta(o)} · {itemMeta(o)}{/if}{#if o.customer_name} · {o.customer_name}{/if}</p>
		<div class="toolbar" style="margin-top:6px">
			<span class="pill" style="background:{ORDER_STATUS[o.status]?.soft};color:{ORDER_STATUS[o.status]?.color}">{ORDER_STATUS[o.status]?.label}</span>
			<span class="cat" style="background:{CATS[o.product_slug]?.soft};color:{CATS[o.product_slug]?.color}">{CATS[o.product_slug]?.name ?? o.product_slug}</span>
			{#if o.express}<span class="pr-chip pr-chip--express">⚡ express</span>{/if}
			{#if (o.reprints ?? 0) > 0}<span class="pr-chip">↻ {o.reprints} {o.reprints === 1 ? 'ristampa' : 'ristampe'}</span>{/if}
			<a class="link" style="font-size:13px" href="/dashboard/fatturazione/ordini/{o.checkout_group ?? o.id}">Ordine completo ›</a>
		</div>
	</div>
	<div class="pr-kpis pr-kpis--side">
		<div class="pr-kpi" class:is-hot={projectedLate}><b>{fmtDay(o.ship_by)}</b><span>spedizione promessa</span></div>
		<div class="pr-kpi"><b>{data.projected ? fmtWhen(data.projected) : '—'}</b><span>fine prevista</span></div>
		<div class="pr-kpi"><b>{fmtMin(data.doneMinutes)} / {fmtMin(data.totalMinutes)}</b><span>lavoro fatto</span></div>
	</div>
</div>
{#if form?.error}<p class="error">{form.error}</p>{/if}

<div class="pr-commessa">
	<div class="dcard">
		<h3>Lavorazioni</h3>
		{#if projectedLate && !doneAll}<p class="pr-alert">Partendo adesso la commessa finisce {fmtWhen(data.projected)}, oltre il ritiro del corriere del {fmtDay(o.ship_by)}: sposta la data o avvisa il cliente.</p>{/if}
		{#if data.approveBy && ORDER_STATUS[o.status] && ['in_attesa', 'attesa_file', 'attesa_prova', 'modifiche_richieste', 'approvazione'].includes(o.status)}
			<p class="pr-alert pr-alert--purple">In attesa del cliente. Per mantenere la spedizione del {fmtDay(o.ship_by)} la produzione deve partire entro {fmtWhen(data.approveBy)}.</p>
		{/if}
		<ol class="pr-tl">
			{#each data.timeline as { task: t, risk } (t.id)}
				{@const c = COLOURS[risk.colour]}
				<li class="pr-tl__item pr-tl__item--{t.status}" style="--c:{c.hex};--cs:{c.soft}">
					<span class="pr-tl__dot"></span>
					<div class="pr-tl__body">
						<div class="pr-tl__head">
							<b>{STAGES[t.stage]?.icon} {t.label}</b>
							<span class="pr-status pr-status--{t.status}">{TASK_STATUS[t.status]}</span>
							{#if risk.late && t.status !== 'completato'}<span class="pr-chip pr-chip--late">in ritardo</span>{/if}
						</div>
						<div class="pr-card__facts">
							<span>⏱ {t.wait_minutes && !t.minutes ? `${fmtMin(t.wait_minutes)} di attesa` : fmtMin(t.minutes)}</span>
							<span class:is-late={risk.late && t.status !== 'completato'}>🎯 entro {fmtWhen(t.due_at)}</span>
							{#if t.started_at}<span>▶ {fmtWhen(t.started_at)}</span>{/if}
							{#if t.completed_at}<span>✓ {fmtWhen(t.completed_at)}</span>{/if}
							{#if t.operator}<span>👤 {t.operator}</span>{/if}
						</div>
						{#if t.status === 'bloccato' && t.block_reason}<div class="pr-reason">⚠ {t.block_reason}</div>{/if}
						<div class="toolbar" style="margin-top:6px;gap:8px">
							<form method="POST" action="?/macchina" use:enhance class="pr-machine">
								<input type="hidden" name="task" value={t.id} />
								<select name="machine" value={t.machine ?? ''} onchange={(e) => (e.currentTarget.form as HTMLFormElement).requestSubmit()} disabled={t.status === 'completato'}>
									{#each STAGES[t.stage]?.machines ?? [] as m (m)}<option value={m}>{m}</option>{/each}
									{#if t.machine && !(STAGES[t.stage]?.machines ?? []).includes(t.machine)}<option value={t.machine}>{t.machine}</option>{/if}
								</select>
							</form>
							<TaskActions task={t} compact />
						</div>
					</div>
				</li>
			{/each}
		</ol>

		<div class="toolbar" style="margin-top:14px;gap:8px">
			{#if !reprinting}
				<button class="btn btn--ghost btn--xs" type="button" onclick={() => (reprinting = true)}>↻ Ristampa</button>
			{:else}
				<form method="POST" action="?/ristampa" use:enhance={() => { return async ({ update }) => { await update(); reprinting = false; }; }} class="pr-block">
					<input type="hidden" name="order" value={o.id} />
					<!-- svelte-ignore a11y_autofocus -->
					<input name="motivo" placeholder="Motivo della ristampa: colore, taglio fuori registro, graffi…" required autofocus />
					<button class="btn btn--xs" type="submit">Riparti dalla stampa</button>
					<button class="btn btn--ghost btn--xs" type="button" onclick={() => (reprinting = false)}>Annulla</button>
				</form>
			{/if}
			<form method="POST" action="?/data" use:enhance class="pr-machine" style="margin-left:auto">
				<input type="hidden" name="order" value={o.id} />
				<label class="osub">Spedizione promessa <input type="date" name="ship_by" value={o.ship_by ?? ''} required /></label>
				<button class="btn btn--ghost btn--xs" type="submit">Ripianifica</button>
			</form>
		</div>
	</div>

	<aside class="pr-side">
		<div class="dcard">
			<h3>File e anteprima</h3>
			{#if thumb}<img class="pr-preview" src={thumb} alt="" />{/if}
			<div class="ofiles">
				{#if data.file && studioOrderHref(o.product_slug, o.id)}<a class="btn btn--blue btn--xs" href={studioOrderHref(o.product_slug, o.id)} target="_blank" rel="noopener">Passa il file su Stickerprint Studio</a>{/if}
				{#if data.file}<a class="btn btn--ghost btn--xs" href={data.file} target="_blank" rel="noopener" download>File del cliente</a>{/if}
				{#if o.proof_url ?? o.preview_url}<a class="btn btn--ghost btn--xs" href={o.proof_url ?? o.preview_url} target="_blank" rel="noopener">File di stampa</a>{/if}
				{#if o.imposition_url}<a class="btn btn--ghost btn--xs" href={o.imposition_url} target="_blank" rel="noopener">Imposizione</a>{/if}
			</div>
			<dl class="pr-dl">
				<dt>Quantità</dt><dd>{o.qty.toLocaleString('it-IT')}</dd>
				<dt>Materiale</dt><dd>{o.materiale ?? '—'}{#if o.finitura && o.finitura !== 'nessuna'} · lamina {o.finitura}{/if}</dd>
				<dt>Misura</dt><dd>{o.width_mm && o.height_mm ? `${o.width_mm} × ${o.height_mm} mm` : '—'}</dd>
				<dt>Ordine del</dt><dd>{dmy(o.created_at)}</dd>
				{#if o.notes}<dt>Note cliente</dt><dd>{o.notes}</dd>{/if}
				{#if o.internal_notes}<dt>Note interne</dt><dd>{o.internal_notes}</dd>{/if}
			</dl>
			{#if data.siblings.length}
				<p class="osub" style="margin-top:8px">Nello stesso ordine: {#each data.siblings as s, i (s.id)}{i ? ' · ' : ''}<a class="link" href="/dashboard/produzione/commessa/{s.id}">{s.qty} × {s.product_name}</a>{/each}. L'ordine parte quando tutte le commesse sono pronte.</p>
			{/if}
		</div>

		<div class="dcard">
			<h3>Cronologia</h3>
			<form method="POST" action="?/nota" use:enhance class="pr-block" style="margin-bottom:10px">
				<input type="hidden" name="order" value={o.id} />
				<input name="testo" placeholder="Aggiungi una nota alla commessa…" required />
				<button class="btn btn--xs" type="submit">Salva</button>
			</form>
			{#if data.events.length === 0}<p class="osub">Ancora nessun evento.</p>{/if}
			<ul class="pr-events">
				{#each data.events as e (e.id)}
					<li><span class="pr-events__ic">{EVENT_ICON[e.kind] ?? '•'}</span><div><b>{e.kind.replace('_', ' ')}</b>{#if e.detail} · {e.detail}{/if}<div class="osub">{fmtWhen(e.created_at)} · {fmtAgo(e.created_at)}{#if e.operator} · {e.operator}{/if}</div></div></li>
				{/each}
			</ul>
		</div>
	</aside>
</div>
