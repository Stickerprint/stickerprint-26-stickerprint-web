<script lang="ts">
	import { untrack } from 'svelte';
	import { enhance } from '$app/forms';
	import '$lib/styles/product.css';
	import Configurator from '$lib/components/Configurator.svelte';
	import { sale, resinSaleCm2, type EngineConfig, type ShapeOption } from '$lib/pricing/engine';

	let { data, form } = $props();

	// copia modificabile del listino di QUESTO prodotto (ogni prodotto è chiuso: nessuna modifica passa ad altri)
	// svelte-ignore state_referenced_locally
	let cfg = $state<EngineConfig>(structuredClone(data.config));
	// svelte-ignore state_referenced_locally
	let active = $state(data.active);
	// svelte-ignore state_referenced_locally
	let loadedSlug = $state(data.product.slug);
	let showTest = $state(false);
	let uploadMsg = $state('');

	// cambiando prodotto dal menu la pagina viene riusata: si ricarica il listino di quel prodotto
	$effect(() => {
		const slug = data.product.slug;
		if (slug !== loadedSlug) {
			loadedSlug = slug;
			cfg = structuredClone(untrack(() => data.config));
			active = untrack(() => data.active);
			showTest = false;
			uploadMsg = '';
		}
	});

	const json = $derived(JSON.stringify(cfg));
	const mult = (f: number) => `×${(1 + f).toFixed(2).replace('.', ',')}`;
	const money = (v: number, d = 2) => v.toFixed(d).replace('.', ',');
	const isResin = $derived(cfg.kind === 'resina');
	const engineProduct = $derived(data.product.engineProduct);

	function addRange(list: 'commercialRange' | 'priceRange') {
		const last = cfg[list][cfg[list].length - 1];
		cfg[list] = [...cfg[list], { from: last ? last.from * 2 : 0, factor: last ? Math.max(0.1, last.factor - 0.05) : 1 }];
	}
	function removeRange(list: 'commercialRange' | 'priceRange', i: number) {
		cfg[list] = cfg[list].filter((_, k) => k !== i);
	}
	const parseList = (v: string) => v.split(/[,;\s]+/).map(Number).filter((n) => n > 0).sort((a, b) => a - b);
	const qtyText = $derived(cfg.quantities.join(', '));
	function setQty(v: string) {
		cfg.quantities = parseList(v);
	}

	async function uploadShapeImage(s: ShapeOption, e: Event) {
		const input = e.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;
		uploadMsg = 'Caricamento…';
		const ext = (file.name.split('.').pop() ?? 'png').toLowerCase().replace(/[^a-z0-9]/g, '') || 'png';
		const path = `${data.product.slug}/sagome/${s.id}-${Date.now()}.${ext}`;
		const { error } = await data.supabase.storage.from('engine-assets').upload(path, file, { contentType: file.type, upsert: true });
		if (error) {
			uploadMsg = `Immagine non caricata: ${error.message}`;
			return;
		}
		s.img = data.supabase.storage.from('engine-assets').getPublicUrl(path).data.publicUrl;
		uploadMsg = 'Immagine caricata. Salva il listino per vederla sul sito.';
		input.value = '';
	}
</script>

<svelte:head><title>{data.product.name} · Preventivatore | Dashboard</title></svelte:head>

<div class="toolbar" style="justify-content:space-between">
	<div>
		<h1>{data.product.name}</h1>
		<p class="lead">
			Listino di questo prodotto, indipendente dagli altri. {#if data.savedAt}Ultimo salvataggio: {new Date(data.savedAt).toLocaleString('it-IT')}.{:else}Stai usando il listino iniziale: salva per averlo nel database.{/if}
		</p>
	</div>
	<a class="btn btn--ghost btn--xs" href={data.product.href} target="_blank" rel="noopener">Apri pagina prodotto ↗</a>
</div>

{#if form?.error}<p class="error">{form.error}</p>{/if}
{#if form?.ok}<p class="success">Listino salvato: il sito usa già i nuovi prezzi.</p>{/if}

<form method="POST" action="?/save" use:enhance style="display:grid;gap:18px">
	<input type="hidden" name="config" value={json} />

	<!-- MATERIALI -->
	<div class="dcard" style="overflow-x:auto">
		<h3>Materiali</h3>
		<p class="lead" style="font-size:13.5px;margin-bottom:12px">Acquisto al m² e ricarico (0 = nessuno, 0,5 = +50%). Vendita = acquisto × (1 + ricarico). "Visibile" lo mostra al cliente in questo prodotto.</p>
		<table class="dtable">
			<thead><tr><th>Codice</th><th>Nome mostrato</th><th>Descrizione</th><th>Acquisto €/m²</th><th>Ricarico</th><th>Vendita €/m²</th><th>Etichetta</th><th>Visibile</th></tr></thead>
			<tbody>
				{#each cfg.materials as m (m.id)}
					<tr>
						<td><code>{m.id}</code></td>
						<td><input type="text" bind:value={m.label} /></td>
						<td><input type="text" bind:value={m.description} /></td>
						<td><input type="number" step="0.01" min="0" bind:value={m.costM2} /></td>
						<td><input type="number" step="0.01" bind:value={m.markup} /></td>
						<td>{money(sale(m))}</td>
						<td><input type="text" placeholder="es. Più scelto" bind:value={m.tag} /></td>
						<td><input type="checkbox" bind:checked={m.visible} /></td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>

	{#if isResin}
		<!-- RESINA (sempre inclusa: è il prodotto) -->
		<div class="dcard">
			<h3>Resina</h3>
			<p class="lead" style="font-size:13.5px;margin-bottom:12px">Sempre inclusa nel prezzo, il cliente non la sceglie. Vendita al cm² = costo al kg ÷ 1000 × grammi per cm² × (1 + ricarico) = <b>{resinSaleCm2(cfg.resin).toFixed(4).replace('.', ',')} €/cm²</b>. Alla resina si applica solo il price range (come nel foglio).</p>
			<div class="dform">
				<label>Costo di acquisto resina (€/kg)<input type="number" step="0.01" min="0" bind:value={cfg.resin.costKg} /></label>
				<label>Grammi per cm²<input type="number" step="0.01" min="0" bind:value={cfg.resin.gramsPerCm2} /></label>
				<label>Ricarico resina (1,5 = +150%)<input type="number" step="0.05" min="0" bind:value={cfg.resin.markup} /></label>
			</div>
		</div>
	{:else}
		<!-- FINITURE (lamina protettiva) -->
		<div class="dcard" style="overflow-x:auto">
			<h3>Finiture</h3>
			<p class="lead" style="font-size:13.5px;margin-bottom:12px">Lamina protettiva: acquisto al m² e ricarico. Vendita: <b>{money(sale(cfg.laminate))} €/m²</b>. Il passo "Lamina protettiva" compare sul sito solo se almeno due finiture sono visibili.</p>
			<div class="dform" style="margin-bottom:14px">
				<label>Lamina: acquisto €/m²<input type="number" step="0.01" min="0" bind:value={cfg.laminate.costM2} /></label>
				<label>Lamina: ricarico<input type="number" step="0.01" bind:value={cfg.laminate.markup} /></label>
			</div>
			<table class="dtable">
				<thead><tr><th>Codice</th><th>Nome mostrato</th><th>Descrizione</th><th>Aggiunge la lamina</th><th>Visibile</th></tr></thead>
				<tbody>
					{#each cfg.finishes as f (f.id)}
						<tr><td><code>{f.id}</code></td><td><input type="text" bind:value={f.label} /></td><td><input type="text" bind:value={f.description} /></td><td><input type="checkbox" bind:checked={f.laminate} /></td><td><input type="checkbox" bind:checked={f.visible} /></td></tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}

	<!-- COSTI FISSI -->
	<div class="dcard">
		<h3>Costi fissi</h3>
		<div class="dform">
			<label>Stampa: acquisto €/m²<input type="number" step="0.01" min="0" bind:value={cfg.print.costM2} /></label>
			<label>Stampa: ricarico<input type="number" step="0.01" bind:value={cfg.print.markup} /></label>
			<label>Stampa: vendita €/m²<input type="text" readonly value={money(sale(cfg.print))} /></label>
			<label>Avvio produzione (€ per ordine, oltre gli scaglioni)<input type="number" step="0.5" min="0" bind:value={cfg.setup} /></label>
			{#each cfg.setupTiers as t, i (i)}
				<label>Avvio fino a<span class="dform__pair"><input type="number" step="1" min="1" bind:value={t.upTo} /> pz → <input type="number" step="0.5" min="0" bind:value={t.setup} /> €</span></label>
			{/each}
		</div>
	</div>

	<!-- RANGE -->
	<div class="dcard">
		<h3>Commercial price range (per m² totali)</h3>
		<p class="lead" style="font-size:13.5px;margin-bottom:12px">Come nel foglio, il fattore è applicato come (1 + fattore): 1,15 significa moltiplicare per 2,15.</p>
		<table class="dtable">
			<thead><tr><th>Da m²</th><th>Fattore</th><th>Moltiplicatore</th><th></th></tr></thead>
			<tbody>
				{#each cfg.commercialRange as r, i (i)}
					<tr><td><input type="number" step="0.1" min="0" bind:value={r.from} /></td><td><input type="number" step="0.01" min="0" bind:value={r.factor} /></td><td>{mult(r.factor)}</td><td><button type="button" class="link-btn" onclick={() => removeRange('commercialRange', i)}>Rimuovi</button></td></tr>
				{/each}
			</tbody>
		</table>
		<button type="button" class="btn btn--ghost btn--xs" style="margin-top:10px" onclick={() => addRange('commercialRange')}>+ Aggiungi scaglione</button>
	</div>
	<div class="dcard">
		<h3>Price range (per quantità)</h3>
		<table class="dtable">
			<thead><tr><th>Da pezzi</th><th>Fattore</th><th>Moltiplicatore</th><th></th></tr></thead>
			<tbody>
				{#each cfg.priceRange as r, i (i)}
					<tr><td><input type="number" min="1" bind:value={r.from} /></td><td><input type="number" step="0.01" min="0" bind:value={r.factor} /></td><td>{mult(r.factor)}</td><td><button type="button" class="link-btn" onclick={() => removeRange('priceRange', i)}>Rimuovi</button></td></tr>
				{/each}
			</tbody>
		</table>
		<button type="button" class="btn btn--ghost btn--xs" style="margin-top:10px" onclick={() => addRange('priceRange')}>+ Aggiungi scaglione</button>
	</div>

	<!-- OPZIONI -->
	<div class="dcard">
		<h3>Opzioni</h3>
		<div class="dform">
			<label>Quantità mostrate al cliente (separate da virgola)<input type="text" value={qtyText} onchange={(e) => setQty((e.currentTarget as HTMLInputElement).value)} /></label>
			<label>Quantità consigliata<input type="number" min="1" bind:value={cfg.recommendedQty} /></label>
			<label>Coefficiente IVA (1,22 = 22%)<input type="number" step="0.01" min="1" bind:value={cfg.vat} /></label>
			<label>Credito Stickerprint (0,05 = 5% del netto)<input type="number" step="0.01" min="0" bind:value={cfg.creditRate} /></label>
			<label>Misura minima di questo prodotto (mm)<input type="number" min="1" bind:value={cfg.size.minMm} /></label>
			<label>Misura massima di questo prodotto (mm)<input type="number" min="1" bind:value={cfg.size.maxMm} /></label>
		</div>
	</div>

	<!-- SAGOME -->
	<div class="dcard" style="overflow-x:auto">
		<h3>Sagome</h3>
		<p class="lead" style="font-size:13.5px;margin-bottom:12px">Immagine mostrata sul sito, nome e misure proposte per ogni sagoma (larghezze in mm, l'altezza segue la proporzione del file). {#if uploadMsg}<b>{uploadMsg}</b>{/if}</p>
		<table class="dtable">
			<thead><tr><th>Immagine</th><th>Codice</th><th>Nome mostrato</th><th>Descrizione</th><th>Misure mostrate (mm)</th><th>Visibile</th></tr></thead>
			<tbody>
				{#each cfg.shapes as s (s.id)}
					<tr>
						<td>
							<div class="shape-img">
								{#if s.img}<img src={s.img} alt="" />{/if}
								<label class="link-btn">Carica<input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" hidden onchange={(e) => uploadShapeImage(s, e)} /></label>
							</div>
						</td>
						<td><code>{s.id}</code></td>
						<td><input type="text" bind:value={s.label} /></td>
						<td><input type="text" bind:value={s.description} /></td>
						<td><input type="text" value={s.presets.join(', ')} onchange={(e) => (s.presets = parseList((e.currentTarget as HTMLInputElement).value))} /></td>
						<td><input type="checkbox" bind:checked={s.visible} /></td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>

	<div class="dcard toolbar" style="justify-content:space-between">
		<label style="display:flex;gap:8px;align-items:center;font-weight:700"><input type="checkbox" name="active" bind:checked={active} /> Pubblicato sul sito</label>
		<button class="btn btn--green" type="submit">Salva listino</button>
	</div>
</form>

<!-- TEST PREVENTIVATORE -->
<div class="dcard">
	<div class="toolbar" style="justify-content:space-between">
		<div>
			<h3 style="margin:0">Test preventivatore</h3>
			<p class="lead" style="font-size:13.5px">Lo stesso preventivatore del sito, con i valori che vedi sopra (anche non ancora salvati).</p>
		</div>
		<button type="button" class="btn btn--xs {showTest ? 'btn--ghost' : 'btn--green'}" onclick={() => (showTest = !showTest)}>{showTest ? 'Chiudi il test' : 'Test preventivatore'}</button>
	</div>
	{#if showTest}
		<Configurator {cfg} test shipDate={data.shipDate} product={data.product.slug} productName={data.product.name} {engineProduct} />
	{/if}
</div>

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
	<form method="POST" action="?/reset" use:enhance style="margin-top:12px" onsubmit={(e) => { if (!confirm('Tornare al listino iniziale di questo prodotto?')) e.preventDefault(); }}>
		<button class="link-btn" type="submit">Torna al listino iniziale</button>
	</form>
</div>

<style>
	.shape-img { display: grid; gap: 4px; justify-items: center; }
	.shape-img img { width: 52px; height: 52px; object-fit: contain; border-radius: 8px; background: #f3f5f8; }
	.shape-img label { cursor: pointer; font-size: 12px; }
</style>
