<script lang="ts">
	import { enhance } from '$app/forms';
	import { quoteWith, sale, resinSaleCm2, eur2, type EngineConfig } from '$lib/pricing/engine';

	let { data, form } = $props();

	// copia modificabile del listino (volutamente presa al caricamento della pagina)
	// svelte-ignore state_referenced_locally
	let cfg = $state<EngineConfig>(structuredClone(data.config));
	// svelte-ignore state_referenced_locally
	let active = $state(data.active);
	type Tab = 'materiali' | 'costi' | 'range' | 'quantita' | 'opzioni' | 'generale';
	let tab = $state<Tab>('materiali');
	const TABS: [Tab, string][] = [['materiali', 'Materiali'], ['costi', 'Stampa, lamina, resina, avvio'], ['range', 'Commercial e price range'], ['quantita', 'Quantità'], ['opzioni', 'Sagome e finiture'], ['generale', 'IVA, credito, misure']];

	// prova del prezzo con il listino in modifica
	let tW = $state(50), tH = $state(50), tQty = $state(500);
	let tForma = $state('sagomato'), tMat = $state('bianco'), tFin = $state('lucida');
	const test = $derived(quoteWith(cfg, { w: tW, h: tH, forma: tForma, materiale: tMat, finitura: tFin, qty: tQty, vatIncluded: true }));
	const json = $derived(JSON.stringify(cfg));
	const pct = (f: number) => `${Math.round(f * 100)}%`;

	function addRange(list: 'commercialRange' | 'priceRange') {
		const last = cfg[list][cfg[list].length - 1];
		cfg[list] = [...cfg[list], { from: last ? last.from * 2 : 0, factor: last ? Math.max(0.1, last.factor - 0.05) : 1 }];
	}
	function removeRange(list: 'commercialRange' | 'priceRange', i: number) {
		cfg[list] = cfg[list].filter((_, k) => k !== i);
	}
	const qtyText = $derived(cfg.quantities.join(', '));
	function setQty(v: string) {
		cfg.quantities = v.split(/[,\s]+/).map(Number).filter((n) => n > 0).sort((a, b) => a - b);
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
			Listino a costi. {#if data.savedAt}Ultimo salvataggio: {new Date(data.savedAt).toLocaleString('it-IT')}.{:else}Stai usando il listino iniziale: salva per averlo nel database.{/if}
		</p>
	</div>
	<a class="btn btn--ghost btn--xs" href={data.product.href} target="_blank" rel="noopener">Apri pagina prodotto ↗</a>
</div>

{#if form?.error}<p class="error">{form.error}</p>{/if}
{#if form?.ok}<p class="success">Listino salvato: il sito usa già i nuovi prezzi.</p>{/if}

<form method="POST" action="?/save" use:enhance style="display:grid;gap:18px">
	<input type="hidden" name="config" value={json} />

	<div class="tabs">
		{#each TABS as [id, label] (id)}
			<button type="button" class:is-active={tab === id} onclick={() => (tab = id)}>{label}</button>
		{/each}
	</div>

	{#if tab === 'materiali'}
		<div class="dcard" style="overflow-x:auto">
			<h3>Materiali (acquisto al m²)</h3>
			<p class="lead" style="font-size:13.5px;margin-bottom:12px">Prezzo di vendita = acquisto × (1 + ricarico). Spunta "Visibile" per mostrarlo al cliente in questo prodotto.</p>
			<table class="dtable">
				<thead><tr><th>Codice</th><th>Nome mostrato</th><th>Descrizione</th><th>Acquisto €/m²</th><th>Ricarico</th><th>Vendita €/m²</th><th>Etichetta</th><th>Visibile</th></tr></thead>
				<tbody>
					{#each cfg.materials as m (m.id)}
						<tr>
							<td><code>{m.id}</code></td>
							<td><input type="text" bind:value={m.label} /></td>
							<td><input type="text" bind:value={m.description} /></td>
							<td><input type="number" step="0.01" min="0" bind:value={m.costM2} /></td>
							<td><input type="number" step="0.01" bind:value={m.markup} title="0 = nessun ricarico, 0.5 = +50%" /></td>
							<td>{sale(m).toFixed(2).replace('.', ',')}</td>
							<td><input type="text" placeholder="es. Più scelto" bind:value={m.tag} /></td>
							<td><input type="checkbox" bind:checked={m.visible} /></td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{:else if tab === 'costi'}
		<div class="dcard">
			<h3>Costi comuni</h3>
			<div class="dform">
				<label>Stampa: acquisto €/m²<input type="number" step="0.01" min="0" bind:value={cfg.print.costM2} /></label>
				<label>Stampa: ricarico<input type="number" step="0.01" bind:value={cfg.print.markup} /></label>
				<label>Plastifica (lucida/opaca): acquisto €/m²<input type="number" step="0.01" min="0" bind:value={cfg.laminate.costM2} /></label>
				<label>Plastifica: ricarico<input type="number" step="0.01" bind:value={cfg.laminate.markup} /></label>
				<label>Avvio produzione (€ una tantum)<input type="number" step="0.5" min="0" bind:value={cfg.setup} /></label>
				<label>Lavorazione per pezzo (€)<input type="number" step="0.001" min="0" bind:value={cfg.extraPerPiece} /></label>
				<label>Prezzo minimo netto per pezzo (€, 0 = nessuno)<input type="number" step="0.001" min="0" bind:value={cfg.minPerPiece} /></label>
			</div>
		</div>
		<div class="dcard">
			<h3>Resina <label style="font-weight:600;font-size:13px;margin-left:10px"><input type="checkbox" bind:checked={cfg.resin.enabled} /> questo prodotto è resinato</label></h3>
			<p class="lead" style="font-size:13.5px;margin-bottom:12px">Vendita €/cm² = costo al kg ÷ 1000 × grammi per cm² × (1 + ricarico). Oggi: <b>{resinSaleCm2(cfg.resin).toFixed(4).replace('.', ',')} €/cm²</b>. Nel foglio la resina non ha il commercial range, solo il price range.</p>
			<div class="dform">
				<label>Costo resina (€/kg)<input type="number" step="0.01" min="0" bind:value={cfg.resin.costKg} /></label>
				<label>Grammi per cm²<input type="number" step="0.01" min="0" bind:value={cfg.resin.gramsPerCm2} /></label>
				<label>Ricarico resina (1.5 = +150%)<input type="number" step="0.05" bind:value={cfg.resin.markup} /></label>
			</div>
		</div>
	{:else if tab === 'range'}
		<div class="dcard">
			<h3>Commercial range (per m² totali stampati)</h3>
			<table class="dtable">
				<thead><tr><th>Da m²</th><th>Fattore</th><th>%</th><th></th></tr></thead>
				<tbody>
					{#each cfg.commercialRange as r, i (i)}
						<tr><td><input type="number" step="0.1" min="0" bind:value={r.from} /></td><td><input type="number" step="0.01" min="0" bind:value={r.factor} /></td><td>{pct(r.factor)}</td><td><button type="button" class="link-btn" onclick={() => removeRange('commercialRange', i)}>Rimuovi</button></td></tr>
					{/each}
				</tbody>
			</table>
			<button type="button" class="btn btn--ghost btn--xs" style="margin-top:10px" onclick={() => addRange('commercialRange')}>+ Aggiungi scaglione</button>
		</div>
		<div class="dcard">
			<h3>Price range (per quantità)</h3>
			<table class="dtable">
				<thead><tr><th>Da pezzi</th><th>Fattore</th><th>%</th><th></th></tr></thead>
				<tbody>
					{#each cfg.priceRange as r, i (i)}
						<tr><td><input type="number" min="1" bind:value={r.from} /></td><td><input type="number" step="0.01" min="0" bind:value={r.factor} /></td><td>{pct(r.factor)}</td><td><button type="button" class="link-btn" onclick={() => removeRange('priceRange', i)}>Rimuovi</button></td></tr>
					{/each}
				</tbody>
			</table>
			<button type="button" class="btn btn--ghost btn--xs" style="margin-top:10px" onclick={() => addRange('priceRange')}>+ Aggiungi scaglione</button>
		</div>
	{:else if tab === 'quantita'}
		<div class="dcard">
			<h3>Quantità mostrate al cliente</h3>
			<div class="dform">
				<label>Quantità (separate da virgola)<input type="text" value={qtyText} onchange={(e) => setQty((e.currentTarget as HTMLInputElement).value)} /></label>
				<label>Quantità consigliata<input type="number" min="1" bind:value={cfg.recommendedQty} /></label>
			</div>
		</div>
	{:else if tab === 'opzioni'}
		<div class="dcard">
			<h3>Sagome</h3>
			<table class="dtable">
				<thead><tr><th>Codice</th><th>Nome</th><th>Descrizione</th><th>Visibile</th></tr></thead>
				<tbody>{#each cfg.shapes as s (s.id)}<tr><td><code>{s.id}</code></td><td><input type="text" bind:value={s.label} /></td><td><input type="text" bind:value={s.description} /></td><td><input type="checkbox" bind:checked={s.visible} /></td></tr>{/each}</tbody>
			</table>
		</div>
		<div class="dcard">
			<h3>Finiture <label style="font-weight:600;font-size:13px;margin-left:10px"><input type="checkbox" bind:checked={cfg.ui.showFinish} /> mostra il passo "Lamina protettiva"</label></h3>
			<table class="dtable">
				<thead><tr><th>Codice</th><th>Nome</th><th>Descrizione</th><th>Aggiunge plastifica</th><th>Visibile</th></tr></thead>
				<tbody>{#each cfg.finishes as f (f.id)}<tr><td><code>{f.id}</code></td><td><input type="text" bind:value={f.label} /></td><td><input type="text" bind:value={f.description} /></td><td><input type="checkbox" bind:checked={f.laminate} /></td><td><input type="checkbox" bind:checked={f.visible} /></td></tr>{/each}</tbody>
			</table>
			<label style="display:block;margin-top:10px;font-size:13px;font-weight:600"><input type="checkbox" bind:checked={cfg.ui.showMaterials} /> mostra il passo "Materiale" (se un solo materiale è visibile viene usato in automatico)</label>
		</div>
	{:else}
		<div class="dcard">
			<h3>IVA, credito e misure</h3>
			<div class="dform">
				<label>Coefficiente IVA (1.22 = 22%)<input type="number" step="0.01" bind:value={cfg.vat} /></label>
				<label>Credito Stickerprint (0.05 = 5% del netto)<input type="number" step="0.01" bind:value={cfg.creditRate} /></label>
				<label>Misura minima (mm)<input type="number" bind:value={cfg.size.minMm} /></label>
				<label>Misura massima (mm)<input type="number" bind:value={cfg.size.maxMm} /></label>
				<label>Misure proposte (mm)<input type="text" value={presetsText} onchange={(e) => setPresets((e.currentTarget as HTMLInputElement).value)} /></label>
			</div>
		</div>
	{/if}

	<div class="dcard">
		<h3>Prova il prezzo con questo listino</h3>
		<div class="quote-test">
			<label class="field">Sagoma<select class="input" bind:value={tForma}>{#each cfg.shapes.filter((s) => s.visible) as s (s.id)}<option value={s.id}>{s.label}</option>{/each}</select></label>
			<label class="field">Materiale<select class="input" bind:value={tMat}>{#each cfg.materials.filter((m) => m.visible) as m (m.id)}<option value={m.id}>{m.label}</option>{/each}</select></label>
			<label class="field">Finitura<select class="input" bind:value={tFin}>{#each cfg.finishes as f (f.id)}<option value={f.id}>{f.label}</option>{/each}</select></label>
			<label class="field">Larghezza mm<input class="input" type="number" bind:value={tW} /></label>
			<label class="field">Altezza mm<input class="input" type="number" bind:value={tH} /></label>
			<label class="field">Quantità<input class="input" type="number" min="1" bind:value={tQty} /></label>
			<output>
				{eur2(test.gross)} IVA inclusa · {eur2(test.net)} netto · {test.perPiece.toFixed(3).replace('.', ',')} €/pz · credito {eur2(test.credit)}
				<small style="display:block;font-family:var(--font-body);font-weight:500;font-size:13px;color:var(--muted);margin-top:6px">
					{test.breakdown.m2.toFixed(3)} m² · CR {pct(test.breakdown.cr)} · PR {pct(test.breakdown.pr)} · materiale {eur2(test.breakdown.material)} · stampa {eur2(test.breakdown.print)} · lamina {eur2(test.breakdown.laminate)} · resina {eur2(test.breakdown.resin)} · lavorazione {eur2(test.breakdown.extra)} · avvio {eur2(test.breakdown.setup)}{test.breakdown.minApplied ? ' · applicato il prezzo minimo' : ''}
				</small>
			</output>
		</div>
	</div>

	<div class="dcard toolbar" style="justify-content:space-between">
		<label style="display:flex;gap:8px;align-items:center;font-weight:700"><input type="checkbox" name="active" bind:checked={active} /> Pubblicato sul sito</label>
		<button class="btn btn--green" type="submit">Salva listino</button>
	</div>
</form>

<div class="dcard">
	<h3>Versioni precedenti</h3>
	{#if data.history.length === 0}
		<p style="color:var(--muted);font-size:14px">Nessuna modifica salvata finora.</p>
	{:else}
		<table class="dtable">
			<thead><tr><th>Data</th><th>Stampa €/m²</th><th>Avvio</th><th></th></tr></thead>
			<tbody>
				{#each data.history as h (h.id)}
					<tr>
						<td>{new Date(h.changed_at).toLocaleString('it-IT')}</td>
						<td>{h.config?.print?.costM2 ?? '—'}</td>
						<td>{h.config?.setup ?? '—'}</td>
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
