<script lang="ts">
	import '$lib/styles/produzione.css';
	import { enhance } from '$app/forms';
	import { CAPABILITY_LABEL, DEPARTMENTS, MACHINE_TYPES, type Machine } from '$lib/production/types';
	import { PRODUCT_ENGINES } from '$lib/pricing/engine';
	let { data, form } = $props();
	let editing = $state<Machine | null | 'new'>(null);
	const used = $derived(new Set(data.usedIds));
	const v = (x: number | null) => (x == null ? null : String(x));
	const todo = (x: number | null) => (x == null ? 'Da configurare' : String(x));
	const caps = Object.keys(CAPABILITY_LABEL);
	$effect(() => { if (form?.ok) editing = null; });
	const blank = (): Machine => ({ id: '', code: '', name: '', brand: null, model: null, machine_type: 'stampante_ecosolvente', department: 'stampa', usable_width_mm: null, is_active: true, archived_at: null, setup_minutes: null, sqm_per_hour: null, minutes_per_sqm: null, pieces_per_hour: null, minutes_per_piece: null, cleanup_minutes: null, passive_minutes: null, waste_coefficient: null, capabilities: ['stampa_ecosolvente'], notes: null, sort: data.machines.length + 1 });
	const cur = $derived(editing === 'new' ? blank() : editing);
	let selType = $state('stampante_ecosolvente');
	$effect(() => { if (cur) selType = cur.machine_type; });
	const isRes = $derived(selType === 'resinatrice');
	const isCut = $derived(selType === 'plotter_taglio');
</script>

<svelte:head><title>Macchinari | Setup</title></svelte:head>
<div class="pv-head"><div><h1>⚙️ Setup → Macchinari</h1><p class="lead">Il parco macchine e i parametri con cui la produzione calcola le durate. Le velocità che non conosci restano <span class="todo">Da configurare</span>: finché mancano vale una durata di riserva, e la stima è segnata come non affidabile.</p></div>
	{#if data.admin}<button class="btn btn--green" type="button" onclick={() => (editing = 'new')}>+ Aggiungi macchinario</button>{:else}<span class="osub">Solo l'amministratore può modificare il setup.</span>{/if}</div>
{#if form?.error}<p class="error">{form.error}</p>{/if}
{#if form?.ok && form.message}<p class="success">{form.message}</p>{/if}

{#if cur && data.admin}
	<div class="dcard" style="margin-bottom:16px;border:2px solid var(--blue)">
		<h3>{editing === 'new' ? 'Nuovo macchinario' : `Modifica ${cur.name}`}</h3>
		<form method="POST" action="?/save" use:enhance class="setup-form">
			<input type="hidden" name="id" value={cur.id} />
			<label>Nome <input name="name" value={cur.name} required placeholder="es. Roland SG3 #3" /></label>
			<label>Codice interno <input name="code" value={cur.code} required placeholder="es. SG3-3" /></label>
			<label>Tipologia <select name="machine_type" bind:value={selType}>{#each Object.entries(MACHINE_TYPES) as [k, t] (k)}<option value={k}>{t.label}</option>{/each}{#if !MACHINE_TYPES[cur.machine_type]}<option value={cur.machine_type}>{cur.machine_type}</option>{/if}</select></label>
			<label>Marca <input name="brand" value={cur.brand ?? ''} /></label>
			<label>Modello <input name="model" value={cur.model ?? ''} /></label>
			<label>Reparto <select name="department" value={cur.department}>{#each Object.entries(DEPARTMENTS).filter(([, d]) => !d.station) as [k, d] (k)}<option value={k}>{d.icon} {d.label}</option>{/each}</select></label>
			<label>Larghezza utile (mm) <input name="usable_width_mm" type="number" value={v(cur.usable_width_mm)} placeholder="es. 750 (vuoto = non nota)" /></label>
			<label>Tempo fisso di preparazione (min) <input name="setup_minutes" type="number" value={v(cur.setup_minutes)} placeholder="Da configurare" /></label>
			<label>Ordine nell'elenco <input name="sort" type="number" value={cur.sort} /></label>
			{#if !isRes}
				<label>Metri quadrati all'ora <input name="sqm_per_hour" type="number" step="0.01" value={v(cur.sqm_per_hour)} placeholder="Da configurare" /></label>
				<label>oppure minuti per m² <input name="minutes_per_sqm" type="number" step="0.01" value={v(cur.minutes_per_sqm)} placeholder="Da configurare" /></label>
				<label>Coefficiente di scarto sull'area <input name="waste_coefficient" type="number" step="0.01" value={v(cur.waste_coefficient)} placeholder="es. 1.15 (vuoto = 1)" /></label>
			{/if}
			{#if isRes}
				<label>Pezzi all'ora <input name="pieces_per_hour" type="number" step="0.1" value={v(cur.pieces_per_hour)} placeholder="Da configurare" /></label>
				<label>oppure minuti per pezzo <input name="minutes_per_piece" type="number" step="0.01" value={v(cur.minutes_per_piece)} placeholder="Da configurare" /></label>
				<label>Tempo di pulizia finale (min) <input name="cleanup_minutes" type="number" value={v(cur.cleanup_minutes)} placeholder="Da configurare" /></label>
				<label>Maturazione della resina (min, tempo passivo) <input name="passive_minutes" type="number" value={v(cur.passive_minutes)} placeholder="es. 720 = 12 h (vuoto = 12 h)" /></label>
			{:else if selType === 'stampante_ecosolvente'}
				<label>Asciugatura dopo la stampa (min, tempo passivo) <input name="passive_minutes" type="number" value={v(cur.passive_minutes)} placeholder="0 = nessuna" /></label>
			{/if}
			<fieldset><legend>Lavorazioni compatibili</legend>{#each caps as c (c)}<label><input type="checkbox" name="capabilities" value={c} checked={cur.capabilities.includes(c as Machine['capabilities'][number])} /> {CAPABILITY_LABEL[c as keyof typeof CAPABILITY_LABEL]}</label>{/each}</fieldset>
			<label class="full" style="flex-direction:row;display:flex;align-items:center;gap:8px"><input type="checkbox" name="is_active" checked={cur.is_active} /> Attivo (riceve lavori)</label>
			<label class="full">Note interne <textarea name="notes" rows="2">{cur.notes ?? ''}</textarea></label>
			{#if isCut}<p class="osub full">Taglio: la durata usa i minuti per m² moltiplicati per la complessità della commessa (semplice ×0,7 · standard ×1 · complesso ×1,6). La lunghezza reale del tracciato non viene calcolata: l'amministratore può correggere la durata sulla singola commessa.</p>{/if}
			<div class="full" style="display:flex;gap:8px;justify-content:flex-end"><button type="button" class="btn btn--ghost btn--xs" onclick={() => (editing = null)}>Annulla</button><button class="btn btn--blue" type="submit">Salva</button></div>
		</form>
	</div>
{/if}

<div class="setup-grid">
	{#each data.machines as m (m.id)}
		{@const prof = data.profiles.filter((p) => p.machine_id === m.id)}
		<div class="setup-card" class:is-off={!m.is_active} class:is-archived={!!m.archived_at}>
			<div class="mach__head"><div><b style="font-family:var(--font-display);font-size:17px">{m.name}</b><div class="osub">{m.code} · {MACHINE_TYPES[m.machine_type]?.label ?? m.machine_type}{#if m.brand || m.model} · {[m.brand, m.model].filter(Boolean).join(' ')}{/if}</div></div>
				<span class="mach__state" style={m.archived_at ? 'background:#e5e7eb' : m.is_active ? 'background:#dcfce7;color:#15803d' : 'background:#fee2e2;color:#991b1b'}>{m.archived_at ? 'Archiviato' : m.is_active ? 'Attivo' : 'Disattivato'}</span></div>
			<div class="setup-card__params">
				<span>Reparto</span><b>{DEPARTMENTS[m.department]?.label}</b>
				<span>Larghezza utile</span><b>{m.usable_width_mm ? `${m.usable_width_mm} mm` : '—'}</b>
				<span>Preparazione</span><b class:todo={m.setup_minutes == null}>{todo(m.setup_minutes)}{m.setup_minutes != null ? ' min' : ''}</b>
				{#if m.machine_type === 'resinatrice'}
					<span>Velocità</span><b class:todo={m.minutes_per_piece == null && m.pieces_per_hour == null}>{m.minutes_per_piece != null ? `${m.minutes_per_piece} min/pezzo` : m.pieces_per_hour != null ? `${m.pieces_per_hour} pezzi/h` : 'Da configurare'}</b>
					<span>Pulizia</span><b class:todo={m.cleanup_minutes == null}>{todo(m.cleanup_minutes)}{m.cleanup_minutes != null ? ' min' : ''}</b>
					<span>Maturazione (passiva)</span><b>{m.passive_minutes != null ? `${m.passive_minutes} min` : '12 h (predefinito)'}</b>
				{:else}
					<span>Velocità</span><b class:todo={m.sqm_per_hour == null && m.minutes_per_sqm == null}>{m.sqm_per_hour != null ? `${m.sqm_per_hour} m²/h` : m.minutes_per_sqm != null ? `${m.minutes_per_sqm} min/m²` : 'Da configurare'}</b>
					{#if m.passive_minutes}<span>Asciugatura (passiva)</span><b>{m.passive_minutes} min</b>{/if}
					{#if m.waste_coefficient}<span>Scarto</span><b>×{m.waste_coefficient}</b>{/if}
				{/if}
				<span>Lavorazioni</span><b>{m.capabilities.map((c) => CAPABILITY_LABEL[c]).join(', ') || '—'}</b>
			</div>
			{#if m.notes}<p class="osub">{m.notes}</p>{/if}
			{#if prof.length}<div class="osub"><b>Profili di velocità:</b> {prof.map((p) => `${p.name}${p.product_slug ? ' (' + (PRODUCT_ENGINES.find((x) => x.slug === p.product_slug)?.name ?? p.product_slug) + ')' : ''}: ${p.sqm_per_hour != null ? p.sqm_per_hour + ' m²/h' : p.minutes_per_sqm != null ? p.minutes_per_sqm + ' min/m²' : p.minutes_per_piece != null ? p.minutes_per_piece + ' min/pz' : '—'}`).join(' · ')}</div>{/if}
			{#if data.admin}
				<div style="display:flex;gap:6px;flex-wrap:wrap">
					{#if !m.archived_at}<button type="button" class="btn btn--ghost btn--xs" onclick={() => (editing = m)}>✏️ Modifica</button>{/if}
					<form method="POST" action="?/duplica" use:enhance><input type="hidden" name="id" value={m.id} /><button class="btn btn--ghost btn--xs" type="submit">⧉ Duplica</button></form>
					{#if !m.archived_at}<form method="POST" action="?/attiva" use:enhance><input type="hidden" name="id" value={m.id} /><input type="hidden" name="on" value={m.is_active ? '0' : '1'} /><button class="btn btn--ghost btn--xs" type="submit">{m.is_active ? '⏸ Disattiva' : '▶ Attiva'}</button></form>{/if}
					{#if !m.archived_at}<form method="POST" action="?/rimuovi" use:enhance onsubmit={(e) => { if (!confirm(used.has(m.id) ? `${m.name} è già stato usato in produzione: verrà archiviato (resta nella cronologia). Continuare?` : `Eliminare ${m.name}?`)) e.preventDefault(); }}><input type="hidden" name="id" value={m.id} /><button class="btn btn--ghost btn--xs" type="submit" style="color:#b3261e">🗑 {used.has(m.id) ? 'Archivia' : 'Elimina'}</button></form>{/if}
				</div>
				{#if !m.archived_at}
					<details><summary class="osub" style="cursor:pointer">+ Profilo di velocità per prodotto / qualità / materiale</summary>
						<form method="POST" action="?/profilo" use:enhance class="setup-form" style="margin-top:8px">
							<input type="hidden" name="machine_id" value={m.id} />
							<label>Nome profilo <input name="name" placeholder="es. Alta qualità" required /></label>
							<label>Prodotto <select name="product_slug"><option value="">Tutti</option>{#each PRODUCT_ENGINES as p (p.slug)}<option value={p.slug}>{p.name}</option>{/each}<option value="kit_adesivi">Kit di adesivi</option><option value="fogli_adesivi">Fogli di adesivi</option></select></label>
							<label>Materiale <input name="material" placeholder="es. bianco (vuoto = tutti)" /></label>
							{#if m.machine_type === 'resinatrice'}<label>Minuti per pezzo <input name="minutes_per_piece" type="number" step="0.01" /></label>{:else}<label>m²/h <input name="sqm_per_hour" type="number" step="0.01" /></label><label>oppure min/m² <input name="minutes_per_sqm" type="number" step="0.01" /></label>{/if}
							<label>Preparazione (min) <input name="setup_minutes" type="number" /></label>
							<label>Coefficiente <input name="coefficient" type="number" step="0.01" placeholder="1" /></label>
							<div class="full" style="display:flex;justify-content:flex-end"><button class="btn btn--ghost btn--xs" type="submit">Salva profilo</button></div>
						</form>
						{#each prof as p (p.id)}<form method="POST" action="?/profiloElimina" use:enhance class="osub" style="display:flex;gap:8px;align-items:center;margin-top:4px"><input type="hidden" name="id" value={p.id} /><span>{p.name}</span><button class="link-btn" type="submit" style="color:#b3261e">elimina</button></form>{/each}
					</details>
				{/if}
			{/if}
		</div>
	{/each}
</div>
