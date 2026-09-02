<script lang="ts">
	/**
	 * Pagina prodotto — BOZZA. Riceve la configurazione iniziata in home
	 * (file, sagoma, materiale) e la mostra. Il configuratore completo
	 * (misure, quantità, finitura, prezzo, carrello) arriva nello step successivo.
	 */
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { loadDraft, type Draft } from '$lib/utils/draftStore';

	let draft = $state<Draft | null>(null);
	let loaded = $state(false);

	const forma = $derived(page.url.searchParams.get('forma') ?? draft?.forma ?? 'sagomato');
	const materiale = $derived(page.url.searchParams.get('materiale') ?? draft?.materiale ?? 'bianco');

	onMount(async () => {
		draft = await loadDraft();
		loaded = true;
	});
</script>

<svelte:head><title>Adesivi personalizzati | Stickerprint</title></svelte:head>

<section class="container account">
	<div>
		<span class="tag tag--blue">Adesivi personalizzati</span>
		<h1 style="margin-top:12px">Il tuo adesivo, <span class="hl hl--green">passo dopo passo.</span></h1>
		<p class="lead" style="margin-top:12px">Questa pagina è in costruzione: qui completerai la configurazione con misure, quantità e finitura, e aggiungerai il prodotto al carrello.</p>
	</div>

	{#if loaded && draft}
		<div class="draft">
			{#if draft.preview}
				<img class="draft__img" src={draft.preview} alt="Anteprima del tuo adesivo" />
			{/if}
			<div class="draft__info">
				<h3>Configurazione ricevuta dalla home</h3>
				<ul>
					<li><b>File:</b> {draft.file.name}</li>
					<li><b>Sagoma:</b> {forma}</li>
					<li><b>Materiale:</b> {materiale}</li>
					{#if draft.widthMm}<li><b>Misura stimata:</b> {draft.widthMm} × {draft.heightMm} mm</li>{/if}
				</ul>
				<p class="note">Salvata in questo browser {new Date(draft.savedAt).toLocaleString('it-IT')}.</p>
				<p style="margin-top:16px"><a class="btn btn--ghost btn--sm" href="/#anteprima">Modifica in home</a></p>
			</div>
		</div>
	{:else if loaded}
		<p class="lead">Nessun file ancora caricato. <a class="link" href="/#anteprima">Carica il tuo file dalla home</a> per vedere subito l’anteprima automatica.</p>
	{/if}
</section>

<style>
	.draft { display: grid; grid-template-columns: 1fr 1.2fr; gap: 28px; align-items: start; border: 2px solid var(--line); border-radius: var(--radius); padding: 24px; }
	.draft__img { width: 100%; background: repeating-conic-gradient(#f3f4f8 0 25%, #fff 0 50%) 0 0 / 24px 24px; border-radius: 14px; padding: 16px; }
	.draft__info ul { list-style: none; padding: 0; margin: 12px 0; display: grid; gap: 6px; }
	@media (max-width: 800px) { .draft { grid-template-columns: 1fr; } }
</style>
