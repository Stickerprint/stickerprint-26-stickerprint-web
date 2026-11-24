<script lang="ts">
	import { untrack } from 'svelte';
	import { enhance } from '$app/forms';
	import '$lib/styles/product.css';
	import Configurator from '$lib/components/Configurator.svelte';
	import { type EngineConfig, type ShapeOption } from '$lib/pricing/engine';

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
	const isResin = $derived(cfg.kind === 'resina');
	const engineProduct = $derived(data.product.engineProduct);

	const parseList = (v: string) => v.split(/[,;\s]+/).map(Number).filter((n) => n > 0).sort((a, b) => a - b);
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

<svelte:head><title>{data.product.name} · Sagome e misure | Dashboard</title></svelte:head>

<div class="toolbar" style="justify-content:space-between">
	<div>
		<p style="font-size:13.5px"><a href="/dashboard/preventivatori">← Preventivatore (prezzi)</a></p>
		<h1>{data.product.name}: sagome e misure</h1>
		<p class="lead">
			Qui si decide solo cosa vede il cliente: sagome, misure, materiali e finiture visibili. <b>I prezzi si cambiano tutti nel <a href="/dashboard/preventivatori">preventivatore unico</a></b>. {#if data.savedAt}Ultimo salvataggio: {new Date(data.savedAt).toLocaleString('it-IT')}.{/if}
		</p>
	</div>
	<a class="btn btn--ghost btn--xs" href={data.product.href} target="_blank" rel="noopener">Apri pagina prodotto ↗</a>
</div>

{#if form?.error}<p class="error">{form.error}</p>{/if}
{#if form?.ok}<p class="success">Salvato: il sito usa già queste impostazioni.</p>{/if}

<form method="POST" action="?/save" use:enhance style="display:grid;gap:18px">
	<input type="hidden" name="config" value={json} />

	<!-- MATERIALI -->
	<div class="dcard" style="overflow-x:auto">
		<h3>Materiali</h3>
		<p class="lead" style="font-size:13.5px;margin-bottom:12px">"Visibile" lo mostra al cliente in questo prodotto. Il costo al m² di ogni materiale sta nel preventivatore unico.</p>
		<table class="dtable">
			<thead><tr><th>Codice</th><th>Nome mostrato</th><th>Descrizione</th><th>Etichetta</th><th>Visibile</th></tr></thead>
			<tbody>
				{#each cfg.materials as m (m.id)}
					<tr>
						<td><code>{m.id}</code></td>
						<td><input type="text" bind:value={m.label} /></td>
						<td><input type="text" bind:value={m.description} /></td>
						<td><input type="text" placeholder="es. Più scelto" bind:value={m.tag} /></td>
						<td><input type="checkbox" bind:checked={m.visible} /></td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>

	{#if !isResin}
		<!-- FINITURE (lamina protettiva) -->
		<div class="dcard" style="overflow-x:auto">
			<h3>Finiture</h3>
			<p class="lead" style="font-size:13.5px;margin-bottom:12px">"Aggiunge la lamina" fa pagare la lamina del preventivatore unico. Il passo compare sul sito solo se almeno due finiture sono visibili.</p>
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

	<!-- OPZIONI -->
	<div class="dcard">
		<h3>Opzioni</h3>
		<div class="dform">
			<label>Quantità consigliata<input type="number" min="1" bind:value={cfg.recommendedQty} /></label>
			<label>Credito Stickerprint (0,02 = 2% del netto, livello Creator)<input type="number" step="0.01" min="0" bind:value={cfg.creditRate} /></label>
			<label>Misura minima di questo prodotto (mm)<input type="number" min="1" bind:value={cfg.size.minMm} /></label>
			<label>Misura massima di questo prodotto (mm)<input type="number" min="1" bind:value={cfg.size.maxMm} /></label>
		</div>
		<p class="note" style="margin-top:14px"><b>Minimo per sagoma</b> (lato corto, mm): la misura proposta per prima al cliente è sempre questa; il lato lungo segue la proporzione del disegno. Vuoto = misura minima del prodotto.</p>
		<div class="dgrid">
			{#each ['sagomato', 'tondo', 'quadrato', 'ovale', 'rettangolare'] as sh (sh)}
				<label>{sh}<input type="number" min="1" value={cfg.size.minByShape?.[sh] ?? ''} onchange={(e) => { const v = +(e.currentTarget as HTMLInputElement).value; cfg.size.minByShape = { ...(cfg.size.minByShape ?? {}) }; if (v > 0) cfg.size.minByShape[sh] = v; else delete cfg.size.minByShape[sh]; }} /></label>
			{/each}
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
		<button class="btn btn--green" type="submit">Salva</button>
	</div>
</form>

<!-- TEST PREVENTIVATORE -->
<div class="dcard">
	<div class="toolbar" style="justify-content:space-between">
		<div>
			<h3 style="margin:0">Test preventivatore</h3>
			<p class="lead" style="font-size:13.5px">Lo stesso preventivatore del sito, con le impostazioni che vedi sopra (anche non ancora salvate) e i prezzi del listino online.</p>
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
			<thead><tr><th>Data</th><th></th></tr></thead>
			<tbody>
				{#each data.history as h (h.id)}
					<tr>
						<td>{new Date(h.changed_at).toLocaleString('it-IT')}</td>
						<td><form method="POST" action="?/restore" use:enhance><input type="hidden" name="id" value={h.id} /><button class="btn btn--ghost btn--xs" type="submit">Ripristina</button></form></td>
					</tr>
				{/each}
			</tbody>
		</table>
	{/if}
	<form method="POST" action="?/reset" use:enhance style="margin-top:12px" onsubmit={(e) => { if (!confirm('Tornare alle impostazioni iniziali di questo prodotto?')) e.preventDefault(); }}>
		<button class="link-btn" type="submit">Torna alle impostazioni iniziali</button>
	</form>
</div>

<style>
	.shape-img { display: grid; gap: 4px; justify-items: center; }
	.shape-img img { width: 52px; height: 52px; object-fit: contain; border-radius: 8px; background: #f3f5f8; }
	.shape-img label { cursor: pointer; font-size: 12px; }
</style>
