<script lang="ts">
	import '$lib/styles/produzione.css';
	import { enhance } from '$app/forms';
	let { data, form } = $props();
	const c = $derived(data.calendar);
	const DAYS = [[1, 'Lunedì'], [2, 'Martedì'], [3, 'Mercoledì'], [4, 'Giovedì'], [5, 'Venerdì'], [6, 'Sabato'], [7, 'Domenica']] as const;
	let closures = $state<{ from: string; to: string; label: string }[]>([]);
	$effect(() => { closures = (c.closures ?? []).map((x) => ({ from: x.from, to: x.to, label: x.label ?? '' })); });
</script>
<svelte:head><title>Calendario di lavoro | Setup</title></svelte:head>
<div class="pv-head"><div><h1>📅 Setup → Calendario di lavoro</h1><p class="lead">Orari, giorni lavorativi, festività e chiusure: la pianificazione conta solo le ore di lavoro. Le festività nazionali italiane sono già incluse.</p></div></div>
{#if form?.error}<p class="error">{form.error}</p>{/if}
{#if form?.ok && form.message}<p class="success">{form.message}</p>{/if}
<div class="dcard">
	<form method="POST" action="?/save" use:enhance class="setup-form">
		<label>Fuso orario <input name="timezone" value={c.timezone} /></label>
		<label>Apertura <input name="open_time" type="time" value={c.open_time} /></label>
		<label>Chiusura <input name="close_time" type="time" value={c.close_time} /></label>
		<label>Pausa dalle <input name="break_start" type="time" value={c.break_start ?? ''} /></label>
		<label>Pausa alle <input name="break_end" type="time" value={c.break_end ?? ''} /></label>
		<label>Ritiro del corriere alle <input name="ship_cutoff" type="time" value={c.ship_cutoff} /></label>
		<label>Margine prima del ritiro (min) <input name="ship_margin_minutes" type="number" value={c.ship_margin_minutes} /></label>
		<label>Soglia arancione: margine sotto i (min) <input name="orange_threshold_minutes" type="number" value={c.orange_threshold_minutes} /></label>
		<fieldset><legend>Giorni lavorativi</legend>{#each DAYS as [n, l] (n)}<label><input type="checkbox" name="working_days" value={n} checked={c.working_days.includes(n)} /> {l}</label>{/each}</fieldset>
		<label class="full">Festività aggiuntive (una per riga, AAAA-MM-GG) <textarea name="holidays" rows="3">{c.holidays.join('\n')}</textarea></label>
		<div class="full"><b style="font-size:13px">Chiusure aziendali</b>
			{#each closures as cl, i (i)}<div style="display:flex;gap:8px;margin-top:6px;align-items:center"><input type="date" bind:value={cl.from} class="sel-sm" /> → <input type="date" bind:value={cl.to} class="sel-sm" /><input bind:value={cl.label} placeholder="es. Ferie estive" class="sel-sm" style="max-width:220px" /><button type="button" class="link-btn" onclick={() => (closures = closures.filter((_, k) => k !== i))}>togli</button></div>{/each}
			<button type="button" class="btn btn--ghost btn--xs" style="margin-top:8px" onclick={() => (closures = [...closures, { from: '', to: '', label: '' }])}>+ Aggiungi chiusura</button>
			<input type="hidden" name="closures" value={JSON.stringify(closures.filter((x) => x.from && x.to))} />
		</div>
		<p class="osub full">Festività nazionali già considerate: {data.fixed.map((d) => d.split('-').reverse().join('/')).join(' · ')}.</p>
		{#if data.admin}<div class="full" style="display:flex;justify-content:flex-end"><button class="btn btn--blue" type="submit">Salva calendario</button></div>{:else}<p class="osub full">Solo l'amministratore può salvare.</p>{/if}
	</form>
</div>
