<script lang="ts">
	import { enhance } from '$app/forms';
	import { quoteWith, eur0, eur2, type EngineConfig } from '$lib/pricing/engine';

	let { data, form } = $props();

	// copia modificabile del listino (volutamente presa al caricamento della pagina)
	// svelte-ignore state_referenced_locally
	let cfg = $state<EngineConfig>(structuredClone(data.config));
	// svelte-ignore state_referenced_locally
	let active = $state(data.active);
	let tab = $state<'quantita' | 'misura' | 'sagome' | 'materiali' | 'finiture' | 'generale'>('quantita');

	// prova del prezzo con il listino che stai modificando
	let tW = $state(50), tH = $state(50), tQty = $state(500);
	let tForma = $state('sagomato'), tMat = $state('bianco'), tFin = $state('lucida');
	const test = $derived(quoteWith(cfg, { w: tW, h: tH, forma: tForma, materiale: tMat, finitura: tFin, qty: cfg.tiers.some((t) => t.qty === tQty) ? tQty : cfg.tiers[0].qty, vatIncluded: true }));

	const json = $derived(JSON.stringify(cfg));

	function addTier() {
		const last = cfg.tiers[cfg.tiers.length - 1];
		cfg.tiers = [...cfg.tiers, { qty: last ? last.qty * 2 : 50, base: last ? Math.round(last.base * 1.5) : 40 }];
	}
	function removeTier(i: number) {
		cfg.tiers = cfg.tiers.filter((_, k) => k !== i);
	}
	const presetsText = $derived(cfg.size.presets.join(', '));
	function setPresets(v: string) {
		cfg.size.presets = v.split(/[,\s]+/).map(Number).filter((n) => n > 0);
	}
</script>

<svelte:head><title>{data.product.name} · Preventivatore | Dashboard</title></svelte:head>

<div class="toolbar" style="justify-content:space-between">
	<div>
		<h1>{data.product.name}</h1>
		<p class="lead">
			Listino e motore di calcolo. {#if data.savedAt}Ultimo salvataggio: {new Date(data.savedAt).toLocaleString('it-IT')}.{:else}Stai usando il listino iniziale nel codice: salva per renderlo modificabile.{/if}
		</p>
	</div>
	<a class="btn btn--ghost btn--xs" href={data.product.href} target="_blank" rel="noopener">Apri pagina prodotto ↗</a>
</div>

{#if form?.error}<p class="error">{form.error}</p>{/if}
{#if form?.ok}<p class="success">Listino salvato: il sito usa già i nuovi prezzi.</p>{/if}

<form method="POST" action="?/save" use:enhance style="display:grid;gap:18px">
	<input type="hidden" name="config" value={json} />

	<div class="tabs">
		{#each [['quantita', 'Quantità e prezzi base'], ['misura', 'Misura'], ['sagome', 'Sagome'], ['materiali', 'Materiali'], ['finiture', 'Finiture'], ['generale', 'IVA e credito']] as [id, label] (id)}
			<button type="button" class:is-active={tab === id} onclick={() => (tab = id as typeof tab)}>{label}</button>
		{/each}
	</div>

	{#if tab === 'quantita'}
		<div class="dcard">
			<h3>Fasce di quantità</h3>
			<p class="lead" style="font-size:13.5px;margin-bottom:12px">Il prezzo base è IVA inclusa per la misura di riferimento (50 × 50 mm, vinile bianco, non sagomato). Le altre combinazioni si calcolano moltiplicando.</p>
			<table class="dtable">
				<thead><tr><th>Quantità</th><th>Prezzo base (€)</th><th>Etichetta</th><th>€/pz</th><th></th></tr></thead>
				<tbody>
					{#each cfg.tiers as t, i (i)}
						<tr>
							<td><input type="number" min="1" bind:value={t.qty} /></td>
							<td><input type="number" min="0" step="0.5" bind:value={t.base} /></td>
							<td><input type="text" placeholder="es. Consigliato" bind:value={t.tag} /></td>
							<td>{(t.base / t.qty).toFixed(3).replace('.', ',')}</td>
							<td><button type="button" class="link-btn" onclick={() => removeTier(i)}>Rimuovi</button></td>
						</tr>
					{/each}
				</tbody>
			</table>
			<button type="button" class="btn btn--ghost btn--xs" style="margin-top:10px" onclick={addTier}>+ Aggiungi fascia</button>
		</div>
	{:else if tab === 'misura'}
		<div class="dcard">
			<h3>Fattore misura</h3>
			<p class="lead" style="font-size:13.5px;margin-bottom:12px">fattore = max(minimo, (larghezza × altezza ÷ area di riferimento)<sup>esponente</sup>). Con 50 × 50 mm il fattore è 1.</p>
			<div class="dform">
				<label>Area di riferimento (mm²)<input type="number" bind:value={cfg.size.refArea} /></label>
				<label>Esponente<input type="number" step="0.01" bind:value={cfg.size.exp} /></label>
				<label>Fattore minimo<input type="number" step="0.01" bind:value={cfg.size.floor} /></label>
				<label>Misura minima (mm)<input type="number" bind:value={cfg.size.minMm} /></label>
				<label>Misura massima (mm)<input type="number" bind:value={cfg.size.maxMm} /></label>
				<label>Misure proposte (mm, separate da virgola)<input type="text" value={presetsText} onchange={(e) => setPresets((e.currentTarget as HTMLInputElement).value)} /></label>
			</div>
		</div>
	{:else if tab === 'sagome' || tab === 'materiali' || tab === 'finiture'}
		{@const list = tab === 'sagome' ? cfg.shapes : tab === 'materiali' ? cfg.materials : cfg.finishes}
		<div class="dcard">
			<h3>{tab === 'sagome' ? 'Sagome' : tab === 'materiali' ? 'Materiali' : 'Finiture'}</h3>
			<p class="lead" style="font-size:13.5px;margin-bottom:12px">Moltiplicatore 1 = prezzo base; 1,20 = +20%.</p>
			<table class="dtable">
				<thead><tr><th>Codice</th><th>Nome mostrato</th><th>Descrizione</th><th>Moltiplicatore</th><th>Etichetta</th></tr></thead>
				<tbody>
					{#each list as o (o.id)}
						<tr>
							<td><code>{o.id}</code></td>
							<td><input type="text" bind:value={o.label} /></td>
							<td><input type="text" bind:value={o.description} /></td>
							<td><input type="number" step="0.01" min="0" bind:value={o.multiplier} /></td>
							<td><input type="text" placeholder="es. Più scelto" bind:value={o.tag} /></td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{:else}
		<div class="dcard">
			<h3>IVA e credito</h3>
			<div class="dform">
				<label>Coefficiente IVA (1.22 = 22%)<input type="number" step="0.01" bind:value={cfg.vat} /></label>
				<label>Credito Stickerprint (0.05 = 5% del netto)<input type="number" step="0.01" bind:value={cfg.creditRate} /></label>
			</div>
		</div>
	{/if}

	<div class="dcard">
		<h3>Prova il prezzo con questo listino</h3>
		<div class="quote-test">
			<label class="field">Sagoma<select class="input" bind:value={tForma}>{#each cfg.shapes as s (s.id)}<option value={s.id}>{s.label}</option>{/each}</select></label>
			<label class="field">Materiale<select class="input" bind:value={tMat}>{#each cfg.materials as m (m.id)}<option value={m.id}>{m.label}</option>{/each}</select></label>
			<label class="field">Finitura<select class="input" bind:value={tFin}>{#each cfg.finishes as f (f.id)}<option value={f.id}>{f.label}</option>{/each}</select></label>
			<label class="field">Larghezza mm<input class="input" type="number" bind:value={tW} /></label>
			<label class="field">Altezza mm<input class="input" type="number" bind:value={tH} /></label>
			<label class="field">Quantità<select class="input" bind:value={tQty}>{#each cfg.tiers as t (t.qty)}<option value={t.qty}>{t.qty}</option>{/each}</select></label>
			<output>{eur0(test.gross)} IVA inclusa · {eur2(test.net)} netto · {test.perPiece.toFixed(2).replace('.', ',')} €/pz · credito {eur2(test.credit)}</output>
		</div>
	</div>

	<div class="dcard toolbar" style="justify-content:space-between">
		<label style="display:flex;gap:8px;align-items:center;font-weight:700"><input type="checkbox" name="active" bind:checked={active} /> Pubblicato sul sito</label>
		<div class="toolbar">
			<button class="btn btn--green" type="submit">Salva listino</button>
		</div>
	</div>
</form>

<div class="dcard">
	<h3>Versioni precedenti</h3>
	{#if data.history.length === 0}
		<p style="color:var(--muted);font-size:14px">Nessuna modifica salvata finora.</p>
	{:else}
		<table class="dtable">
			<thead><tr><th>Data</th><th>Fasce</th><th></th></tr></thead>
			<tbody>
				{#each data.history as h (h.id)}
					<tr>
						<td>{new Date(h.changed_at).toLocaleString('it-IT')}</td>
						<td>{(h.config?.tiers ?? []).map((t: { qty: number; base: number }) => `${t.qty}→${t.base}€`).join(' · ')}</td>
						<td><form method="POST" action="?/restore" use:enhance><input type="hidden" name="id" value={h.id} /><button class="btn btn--ghost btn--xs" type="submit">Ripristina</button></form></td>
					</tr>
				{/each}
			</tbody>
		</table>
	{/if}
	<form method="POST" action="?/reset" use:enhance style="margin-top:12px" onsubmit={(e) => { if (!confirm('Tornare al listino iniziale nel codice?')) e.preventDefault(); }}>
		<button class="link-btn" type="submit">Torna al listino iniziale</button>
	</form>
</div>
