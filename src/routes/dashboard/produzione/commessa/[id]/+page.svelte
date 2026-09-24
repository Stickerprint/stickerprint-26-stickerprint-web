<script lang="ts">
	import '$lib/styles/produzione.css';
	import { enhance } from '$app/forms';
	import ProdNav from '$lib/components/produzione/ProdNav.svelte';
	import RiskChip from '$lib/components/produzione/RiskChip.svelte';
	import PhaseBar from '$lib/components/produzione/PhaseBar.svelte';
	import { fmtMin, fmtWhen, fmtDay, fmtTime, fmtAgo } from '$lib/production/format';
	import { DEPARTMENTS, JOB_LABEL, PHASE_LABEL, RISK, COMPLEXITY } from '$lib/production/types';
	import { thumbOf, itemMeta, dmy } from '$lib/dashboard/orders';
	let { data, form } = $props();
	const j = $derived(data.job);
	const now = $derived(new Date(data.now));
	const cal = $derived(data.setup.calendar);
	const rk = $derived(RISK[j.risk_status]);
	const usable = $derived(data.setup.machines.filter((m) => m.is_active && !m.archived_at));
	const mName = (id: string | null) => data.setup.machines.find((m) => m.id === id)?.name ?? null;
	const cls = (s: string) => (s === 'completato' || s === 'saltata' ? 'is-done' : s === 'in_corso' ? 'is-run' : s === 'in_attesa' ? 'is-wait' : '');
	let editing = $state<string | null>(null);
	let changing = $state<string | null>(null);
	const KIND: Record<string, string> = { pianificata: '📐 Pianificata', iniziata: '▶ Avviata', completata: '✓ Completata', bloccata: '⚠ Bloccata', sbloccata: '🔓 Sbloccata', stima: '⏱ Stima modificata', macchina: '🛠 Macchinario cambiato', annullata: '✕ Annullata', nota: '📝 Nota', ricalcolo: '🔁 Ricalcolo' };
</script>

<svelte:head><title>Commessa {j.order_number} | Produzione</title></svelte:head>
<p class="lead" style="margin:0 0 8px"><a class="link" href="/dashboard/produzione/reparto/stampa">← Stampa</a></p>
{#if form?.error}<p class="error">{form.error}</p>{/if}
<div class="pv-head">
	<div>
		<h1>Commessa {j.order_number} <span class="jstate jstate--{j.status}" style="vertical-align:middle;font-size:12px">{JOB_LABEL[j.status]}</span></h1>
		<p class="lead">{data.group.customer}{#if data.group.email} · {data.group.email}{/if} · ordine del {dmy(data.group.created_at)}{#if j.paid_at} · pagato {fmtWhen(j.paid_at, now, cal)}{/if} · <a class="link" href="/dashboard/fatturazione/ordini/{data.group.key}">scheda ordine ›</a></p>
	</div>
	<ProdNav />
</div>

<div class="grid3" style="grid-template-columns:1.2fr 1fr 1fr;align-items:stretch">
	<div class="promised promised--big"><span>🔒 Spedizione promessa: {dmy(j.promised_ship_date)}</span><small>Data di spedizione promessa al cliente — non modificabile dalla produzione</small></div>
	<div class="dcard" style="display:grid;gap:6px;align-content:center">
		<RiskChip risk={j.risk_status} lg />
		<div><b>Avvia entro:</b> {fmtWhen(j.latest_start_at, now, cal)}</div>
		<div><b>Fine lavorazioni prevista:</b> {fmtWhen(j.estimated_packaging_at, now, cal)}</div>
		<div>{#if j.predicted_delay_minutes > 0}<b style="color:{rk.hex}">Previsione oltre la spedizione di {fmtMin(j.predicted_delay_minutes)}</b>{:else}<b>Margine:</b> {fmtMin(j.slack_minutes ?? 0)}{/if}</div>
		<div><b>Tempo produttivo residuo:</b> {fmtMin(j.total_minutes)}</div>
	</div>
	<div class="dcard" style="display:grid;gap:8px;align-content:center">
		{#if j.status === 'READY_TO_START'}<form method="POST" action="?/avvia" use:enhance><input type="hidden" name="job" value={j.id} /><button class="btn btn--green" type="submit" style="width:100%">▶ Avvia produzione</button></form>{/if}
		<PhaseBar phases={data.phases} />
		<div class="osub">{data.phases.filter((p) => p.status === 'completato').length} di {data.phases.length} fasi completate{#if j.status === 'COMPLETED'} · <a class="link" href="/dashboard/produzione/spedizioni">in Spedizioni ›</a>{/if} · macchinari: {[...new Set(data.phases.map((p) => mName(p.machine_id)).filter(Boolean))].join(', ') || '—'}</div>
		{#if data.admin && j.status !== 'CANCELLED' && j.status !== 'COMPLETED'}
			<details><summary class="osub" style="cursor:pointer;color:#b3261e">✕ Annulla commessa (solo amministratore)</summary>
				<form method="POST" action="?/annulla" use:enhance style="display:grid;gap:6px;margin-top:6px" onsubmit={(e) => { if (!confirm('Annullare la commessa? L’ordine risulterà annullato.')) e.preventDefault(); }}><input type="hidden" name="job" value={j.id} /><input name="motivo" placeholder="Motivo" class="sel-sm" style="max-width:none" /><button class="btn btn--ghost btn--xs" type="submit">Conferma annullamento</button></form>
			</details>
		{/if}
	</div>
</div>

<div class="dcard" style="margin-top:14px">
	<h3>Fasi</h3>
	<div class="ph-list">
		{#each data.phases as p (p.id)}
			<div class="ph-row {cls(p.status)}">
				<span class="ph-row__n">{p.seq}</span>
				<div><b>{p.label}</b>{#if p.passive} <span class="osub">(tempo passivo)</span>{/if}<div class="osub">{DEPARTMENTS[p.stage]?.icon} {DEPARTMENTS[p.stage]?.label}{#if p.block_reason} · <span style="color:#b3261e">⚠ {p.block_reason}</span>{/if}</div></div>
				<div><span class="ph-row__lbl">Macchinario</span>
					{#if changing === p.id}
						<form method="POST" action="?/macchina" use:enhance={() => async ({ update }) => { changing = null; await update(); }} class="ph-inline"><input type="hidden" name="task" value={p.id} /><select name="machine">{#each usable.filter((m) => !p.capability || m.capabilities.includes(p.capability)) as m (m.id)}<option value={m.id} selected={m.id === p.machine_id}>{m.name}</option>{/each}</select><button class="btn btn--ghost btn--xs" type="submit">OK</button></form>
					{:else}<b>{mName(p.machine_id) ?? (p.passive ? '—' : DEPARTMENTS[p.stage]?.label)}</b>{#if p.machine_locked} <span title="Scelta a mano">📌</span>{/if}{/if}
				</div>
				<div><span class="ph-row__lbl">Durata stimata</span>
					{#if editing === p.id}
						<form method="POST" action="?/stima" use:enhance={() => async ({ update }) => { editing = null; await update(); }} class="ph-inline"><input type="hidden" name="task" value={p.id} /><input type="number" name="minuti" min="0" value={p.passive ? p.wait_minutes : p.minutes} style="width:80px" /> min <button class="btn btn--ghost btn--xs" type="submit">OK</button></form>
					{:else}<b>{fmtMin(p.passive ? p.wait_minutes : p.minutes)}</b>{#if p.manual_minutes} <span title="Corretta a mano">✍</span>{/if}{#if p.complexity && p.capability === 'taglio'} <span class="osub">· {COMPLEXITY[p.complexity]?.label}</span>{/if}{/if}
				</div>
				<div><span class="ph-row__lbl">Stato</span><b>{PHASE_LABEL[p.status]}</b></div>
				<div><span class="ph-row__lbl">{p.status === 'completato' ? 'Avvio → fine effettivi' : 'Pianificata'}</span>
					{#if p.status === 'completato'}<b>{fmtTime(p.started_at)} → {fmtTime(p.completed_at)}</b>
					{:else if p.status === 'in_corso' || p.status === 'in_attesa'}<b>dalle {fmtTime(p.started_at)}</b> · fine prevista {fmtWhen(p.planned_end_at, now, cal)}
					{:else}<b>{fmtWhen(p.planned_start_at, now, cal)}</b><div class="osub">entro {fmtWhen(p.latest_start_at, now, cal)}</div>{/if}
				</div>
				<div class="ph-row__act">
					{#if p.status === 'pronto' || p.status === 'bloccato'}<form method="POST" action="?/inizia" use:enhance><input type="hidden" name="task" value={p.id} /><button class="btn btn--green btn--xs" type="submit">▶ Avvia fase</button></form>{/if}
					{#if p.status === 'in_corso'}<form method="POST" action="?/completa" use:enhance><input type="hidden" name="task" value={p.id} /><button class="btn btn--blue btn--xs" type="submit">✓ Termina fase</button></form>{/if}
					{#if data.admin && p.status !== 'completato' && p.status !== 'saltata'}
						<button type="button" class="btn btn--ghost btn--xs" onclick={() => (editing = editing === p.id ? null : p.id)}>⏱ Modifica stima</button>
						{#if !p.passive}<button type="button" class="btn btn--ghost btn--xs" onclick={() => (changing = changing === p.id ? null : p.id)}>🛠 Cambia macchinario</button>{/if}
					{/if}
				</div>
			</div>
		{/each}
	</div>
</div>

<div class="grid3" style="grid-template-columns:1fr 1fr;margin-top:14px;align-items:start">
	<div class="dcard">
		<h3>📅 Piano giornaliero</h3>
		{#if Object.keys(data.days).length === 0}<p class="osub">Nessuna fase da pianificare.</p>{/if}
		<div class="pv-days">
			{#each Object.keys(data.days).sort() as day (day)}
				<div class="pv-day"><h4>{fmtDay(day, now, cal)} · {dmy(day)}</h4>
					{#each data.days[day] as s (s.phase.id + s.start)}
						<div class="pv-day__seg" class:is-passive={s.phase.passive}><span>{fmtTime(s.start)} – {fmtTime(s.end)}</span><span>{s.phase.seq}. {s.phase.label}</span><span>{mName(s.phase.machine_id) ?? DEPARTMENTS[s.phase.stage]?.label}</span><span>{s.phase.passive ? 'attesa' : fmtMin(s.minutes)}</span></div>
					{/each}
				</div>
			{/each}
		</div>
		<p class="osub" style="margin-top:8px">Scadenza finale: tutto pronto entro {fmtWhen(new Date(new Date(`${j.promised_ship_date}T12:00:00Z`).getTime()), now, cal).split(' alle')[0]} alle {cal.ship_cutoff} meno {cal.ship_margin_minutes} min.</p>
	</div>
	<div class="dcard">
		<h3>📦 Prodotto, file e anteprima</h3>
		{#each data.group.items as it (it.id)}
			<div style="display:grid;grid-template-columns:110px 1fr;gap:12px;align-items:start;padding:10px 0;border-top:1px solid var(--line)">
				<div>{#if thumbOf(it)}<img src={thumbOf(it)} alt="" style="width:110px;height:110px;object-fit:cover;border-radius:12px;background:#f1f3f8" />{:else}<div style="width:110px;height:110px;border-radius:12px;background:#f1f3f8;display:grid;place-items:center;color:var(--muted)">nessuna anteprima</div>{/if}</div>
				<div>
					<b>{it.qty.toLocaleString('it-IT')} × {it.product_name}</b><div class="osub">{itemMeta(it)}{#if it.width_mm && it.height_mm} · {it.width_mm}×{it.height_mm} mm{/if}</div>
					<div class="osub">Protezione: <b>{it.lamination && it.lamination !== 'nessuna' ? it.lamination : it.finitura && it.finitura !== 'nessuna' ? it.finitura : 'nessuna'}</b> · materiale {it.materiale ?? '—'} (informativo)</div>
					<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px">
						{#if data.files[it.id]}<a class="btn btn--ghost btn--xs" href={data.files[it.id]} target="_blank" rel="noopener" download>⬇ File cliente</a>{/if}
						{#if it.proof_url ?? it.preview_url}<a class="btn btn--ghost btn--xs" href={it.proof_url ?? it.preview_url} target="_blank" rel="noopener">👁 Anteprima automatica</a>{/if}
						<a class="btn btn--ghost btn--xs" href="/dashboard/fatturazione/ordini/{data.group.key}">Scheda ordine</a>
					</div>
				</div>
			</div>
		{/each}
		<h3 style="margin-top:14px">🕘 Cronologia</h3>
		<form method="POST" action="?/nota" use:enhance class="pr-block" style="display:flex;gap:6px;margin-bottom:8px"><input type="hidden" name="job" value={j.id} /><input name="testo" placeholder="Aggiungi una nota…" class="sel-sm" style="flex:1;max-width:none" /><button class="btn btn--ghost btn--xs" type="submit">Salva</button></form>
		<div class="pv-events">
			{#each data.events as e (e.id)}<div><span class="osub">{fmtWhen(e.created_at, now, cal)}</span><b>{KIND[e.kind] ?? e.kind}</b><span>{e.detail ?? ''}{#if e.operator} <span class="osub">· {e.operator}</span>{/if}{#if e.actual_minutes != null} <span class="osub">· effettivi {fmtMin(e.actual_minutes)} su {fmtMin(e.est_minutes ?? 0)} stimati</span>{/if}{#if e.slack_minutes != null} <span class="osub">· margine {fmtMin(e.slack_minutes)}</span>{/if}</span></div>{:else}<p class="osub">Nessun evento.</p>{/each}
		</div>
	</div>
</div>
