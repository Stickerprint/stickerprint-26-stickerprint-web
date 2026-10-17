<script lang="ts">
	import { enhance } from '$app/forms';
	import { fmtAgo } from '$lib/dashboard/produzione';
	import type { StatoPosta } from '$lib/server/posta/tipi';
	let { data, form } = $props();
	const STATO: Record<StatoPosta, { label: string; color: string; soft: string }> = {
		nuova: { label: 'Da leggere', color: '#b45309', soft: '#fef3c7' },
		ordine: { label: 'Ordine inserito', color: '#15803d', soft: '#dcfce7' },
		preventivo: { label: 'Richiesta inserita', color: '#1d4ed8', soft: '#dbeafe' },
		altro: { label: 'Niente da fare', color: '#6b7280', soft: '#eceef3' },
		ignorata: { label: 'Ignorata', color: '#6b7280', soft: '#eceef3' },
		errore: { label: 'Problema', color: '#b3261e', soft: '#fbe3e1' }
	};
	const TABS: (StatoPosta | 'tutte')[] = ['tutte', 'nuova', 'ordine', 'preventivo', 'errore', 'altro', 'ignorata'];
	let inCorso = $state('');
	const euro = (v: number) => v.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' });
	const kb = (b: number) => (b > 1e6 ? `${(b / 1e6).toFixed(1)} MB` : `${Math.round(b / 1000)} KB`);
</script>

<svelte:head><title>Posta → ordini | Dashboard</title></svelte:head>

<div class="toolbar" style="justify-content:space-between;align-items:flex-start">
	<div><h1>Posta → ordini dalle mail</h1><p class="lead">Le mail di mattia@stickerprint.it arrivano qui. Alle 9 e alle 15 l'assistente le legge: gli ordini entrano in Fatturazione → Ordini col cliente giusto, misure dai file e mockup; le richieste di preventivo in Aziende → Richieste. Quello che non torna lo scrive nei punti da controllare.</p></div>
	<form method="POST" action="?/tutte" use:enhance={() => { inCorso = 'tutte'; return async ({ update }) => { inCorso = ''; await update(); }; }}>
		<button class="btn btn--xs btn--yellow" type="submit" disabled={inCorso === 'tutte' || !data.conteggi.nuova}>{inCorso === 'tutte' ? 'Sto leggendo…' : `Elabora adesso le ${data.conteggi.nuova ?? 0} nuove`}</button>
	</form>
</div>

{#if form?.errore}<div class="mk-err" style="background:#fbe3e1;color:#b3261e;border-radius:12px;padding:12px 16px;font-size:13.5px">{form.errore}</div>{/if}
{#if form?.messaggio}<div style="background:#e1f3e8;color:#1d7a46;border-radius:12px;padding:12px 16px;font-size:13.5px">{form.messaggio}{#if form.avviso} · <b>{form.avviso}</b>{/if}</div>{/if}
{#if !data.assistente}<div style="background:#fff8e6;border:1px solid #f4d78a;border-radius:12px;padding:12px 16px;font-size:13px;color:#6b4d00"><b>Assistente spento</b>: manca ANTHROPIC_API_KEY su Vercel, le mail arrivano ma non si leggono.</div>{/if}
{#if data.conferma}
	<div class="dcard" style="border-color:var(--blue);background:#f2f6ff">
		<h3 style="margin-bottom:6px">Gmail chiede di confermare l'inoltro</h3>
		<p style="margin:0;font-size:14px">Mail di Google del {data.conferma.quando ? new Date(data.conferma.quando).toLocaleString('it-IT') : '—'}. {#if data.conferma.codice}Codice di conferma: <b style="font-size:20px;font-family:var(--font-display)">{data.conferma.codice}</b> (incollalo in Gmail → Impostazioni → Inoltro).{/if} {#if data.conferma.link}<a class="link" href={data.conferma.link} target="_blank" rel="noopener">Oppure conferma con un clic ↗</a>{/if}</p>
	</div>
{/if}
{#if !data.totale}
	<div class="soon"><b>Ancora nessuna mail</b>Quando l'inoltro da Gmail a Postmark è attivo, le mail compaiono qui da sole.</div>
{/if}

<div class="tabs">
	{#each TABS as t (t)}<a class="tab-link" class:is-active={data.stato === t} href="?stato={t}">{t === 'tutte' ? 'Tutte' : STATO[t].label} ({t === 'tutte' ? data.totale : data.conteggi[t] ?? 0})</a>{/each}
</div>

<div class="rq-list">
	{#each data.mail as m (m.id)}
		{@const st = STATO[m.stato]}
		{@const e = m.esito}
		<div class="rq-row" class:is-unread={m.stato === 'nuova'} class:is-late={m.stato === 'errore' || (e?.blocchi?.length ?? 0) > 0}>
			<span class="rq-dot"></span>
			<div class="rq-main" style="min-width:0">
				<div class="rq-head">
					<b>{m.mittente_nome || m.mittente_email}</b><span style="color:var(--muted)">{m.oggetto || '(senza oggetto)'}</span>
					<span class="pill" style="background:{st.soft};color:{st.color}">{st.label}</span>
					{#if e?.cliente}<span class="osub">→ {e.cliente.nome}{#if e.cliente.creato} (nuovo in anagrafica){/if}</span>{/if}
				</div>
				<div class="osub">{m.mittente_email} · {m.data_mail ? fmtAgo(m.data_mail) : fmtAgo(m.ricevuta_il)}{#if m.allegati.length} · {m.allegati.length} allegati: {m.allegati.map((a) => `${a.nome} (${kb(a.byte)})`).join(', ')}{/if}</div>
				{#if m.stato === 'nuova' && m.testo}<div class="rq-msg">{m.testo.length > 220 ? m.testo.slice(0, 217) + '…' : m.testo}</div>{/if}
				{#if e?.ordine}
					<div class="rq-msg" style="margin-top:6px"><a class="oid" href="/dashboard/fatturazione/ordini/{e.ordine.group}">Ordine {e.ordine.number} →</a> · {e.ordine.righe.length} righe:
						<ul style="margin:4px 0 0;padding-left:18px;font-size:13px">{#each e.ordine.righe as r, i (i)}<li>{r.descrizione} · {r.qty} pz × {euro(r.prezzo)}{#if r.misura} · {r.misura} ({r.fonte_misura === 'tracciato' ? 'dal tracciato' : r.fonte_misura === 'ingombro' ? 'dall’ingombro' : r.fonte_misura === 'regola' ? 'accordo fisso' : r.fonte_misura}){/if}{#if r.mockup} · mockup ✓{/if}</li>{/each}</ul>
					</div>
				{/if}
				{#if e?.richiesta}<div class="rq-msg" style="margin-top:6px"><a class="oid" href="/dashboard/aziende/richieste/{e.richiesta.id}">Richiesta azienda inserita →</a></div>{/if}
				{#if m.stato === 'altro' && e?.estratto}<div class="osub">{e.estratto.motivo}</div>{/if}
				{#if m.errore}<div class="rq-msg" style="color:#b3261e">{m.errore}</div>{/if}
				{#if e?.blocchi?.length}
					<div style="margin-top:6px;background:#fff8e6;border:1px solid #f4d78a;border-radius:10px;padding:8px 12px;font-size:13px;color:#6b4d00"><b>Da controllare</b><ul style="margin:4px 0 0;padding-left:18px">{#each e.blocchi as b, i (i)}<li>{b}</li>{/each}</ul></div>
				{/if}
				<div style="display:flex;gap:6px;margin-top:8px;flex-wrap:wrap">
					<form method="POST" action="?/rielabora" use:enhance={() => { inCorso = m.id; return async ({ update }) => { inCorso = ''; await update(); }; }}><input type="hidden" name="id" value={m.id} /><button class="btn btn--xs btn--ghost" type="submit" disabled={inCorso === m.id}>{inCorso === m.id ? 'Sto leggendo…' : m.stato === 'nuova' ? 'Elabora adesso' : 'Rielabora'}</button></form>
					{#if m.stato !== 'ignorata'}<form method="POST" action="?/ignora" use:enhance><input type="hidden" name="id" value={m.id} /><button class="btn btn--xs btn--ghost" type="submit">Ignora</button></form>{/if}
					{#if m.note}<span class="osub" style="align-self:center">{m.note}</span>{/if}
				</div>
			</div>
		</div>
	{/each}
</div>
