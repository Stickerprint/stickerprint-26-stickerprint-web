<script lang="ts">
	import { firmaHtml } from '$lib/firma';
	let { data } = $props();

	/* il sito: oggi l'anteprima usa l'indirizzo da cui stai guardando, ma nella firma vera vanno gli
	   indirizzi definitivi, altrimenti in Gmail il logo non si vede */
	let sito = $state('https://stickerprint.it');
	let assets = $state(data.origin);
	let nome = $state(data.io.nome || 'Mattia Boccotti');
	let ruolo = $state(data.io.ruolo || 'Titolare');
	let email = $state(data.io.email || 'info@stickerprint.it');
	let conStelle = $state(true);
	let claim = $state('Prodotti con cura nel nostro laboratorio');
	/* le sedi: la prima arriva dai dati di fatturazione, la seconda e' quella americana */
	let sedeIt = $state(data.sedeIt);
	let sedeUs = $state('18 Bridge Street 2A - 11201 Brooklyn (NY)');
	let nomeIt = $state('Stickerprint Italy Srl');
	let nomeUs = $state('Stickerprint North America Inc');

	const html = $derived(
		firmaHtml({
			nome, ruolo, email, sito, assets, claim,
			sedi: [
				{ nome: nomeIt, indirizzo: sedeIt },
				...(sedeUs.trim() ? [{ nome: nomeUs, indirizzo: sedeUs }] : [])
			],
			legale: data.legale,
			stelle: conStelle ? data.stelle : null
		})
	);

	let copiato = $state('');
	async function copia() {
		copiato = '';
		try {
			/* si copia il formato RICCO: incollando in Gmail arriva la firma impaginata, non il codice */
			const item = new ClipboardItem({ 'text/html': new Blob([html], { type: 'text/html' }), 'text/plain': new Blob([html], { type: 'text/plain' }) });
			await navigator.clipboard.write([item]);
			copiato = 'Firma copiata: ora incollala in Gmail.';
		} catch {
			copiato = 'Il browser non mi fa copiare da solo: seleziona l’anteprima qui sotto e premi Cmd+C.';
		}
	}
	function scarica() {
		const blob = new Blob([`<!doctype html><meta charset="utf-8">${html}`], { type: 'text/html' });
		const a = document.createElement('a');
		a.href = URL.createObjectURL(blob);
		a.download = 'firma-stickerprint.html';
		a.click();
		setTimeout(() => URL.revokeObjectURL(a.href), 4000);
	}
</script>

<svelte:head><title>Firma email | Dashboard Stickerprint</title></svelte:head>

<div class="dhead"><h1>Firma email</h1><p class="lead">Si compila qui, si copia e si incolla in Gmail. Le stelle sono quelle vere delle recensioni pubblicate.</p></div>

<div class="fi-wrap">
	<div class="dcard fi-form">
		<h3>I tuoi dati</h3>
		<label class="fi-f"><span>Nome e cognome</span><input bind:value={nome} /></label>
		<label class="fi-f"><span>Ruolo</span><input bind:value={ruolo} /></label>
		<label class="fi-f"><span>Email</span><input bind:value={email} /></label>
		<label class="fi-f"><span>Frase sotto le stelle</span><input bind:value={claim} /></label>
		<h3>Sedi</h3>
		<label class="fi-f"><span>Italia · nome</span><input bind:value={nomeIt} /></label>
		<label class="fi-f"><span>Italia · indirizzo</span><input bind:value={sedeIt} /></label>
		<label class="fi-f"><span>Stati Uniti · nome</span><input bind:value={nomeUs} /></label>
		<label class="fi-f"><span>Stati Uniti · indirizzo <em>(vuoto = non compare)</em></span><input bind:value={sedeUs} /></label>
		<h3>Indirizzi</h3>
		<label class="fi-f"><span>Sito nei link</span><input bind:value={sito} /></label>
		<label class="fi-f"><span>Dove stanno le immagini</span><input bind:value={assets} />
			<em class="fi-note">Deve essere un indirizzo pubblico e raggiungibile: è da lì che Gmail prende il logo.</em></label>
		<label class="fi-check"><input type="checkbox" bind:checked={conStelle} disabled={!data.stelle} />
			{#if data.stelle}Mostra le stelle: <b>{data.stelle.media.toFixed(1).replace('.', ',')}/5</b> (calcolata su {data.stelle.quante} recensioni pubblicate, il numero non si vede nella firma){:else}Nessuna recensione pubblicata: la riga delle stelle resta fuori{/if}</label>

		<div class="fi-act">
			<button class="btn btn--blue" type="button" onclick={copia}>📋 Copia la firma</button>
			<button class="btn btn--ghost" type="button" onclick={scarica}>⬇ Scarica come file</button>
		</div>
		{#if copiato}<p class="ok">{copiato}</p>{/if}

		<h3>Come si mette in Gmail</h3>
		<ol class="fi-steps">
			<li>Premi <b>Copia la firma</b> qui sopra.</li>
			<li>In Gmail apri l’ingranaggio in alto a destra → <b>Visualizza tutte le impostazioni</b>.</li>
			<li>Nella scheda <b>Generali</b> scendi fino a <b>Firma</b> e premi <b>+ Crea nuova</b>, dandole un nome (per esempio “Stickerprint”).</li>
			<li>Clicca dentro il riquadro bianco della firma e incolla con <b>Cmd+V</b>.</li>
			<li>Sotto, in <b>Impostazioni predefinite firma</b>, scegli la firma nuova per i messaggi nuovi e per le risposte.</li>
			<li>In fondo alla pagina premi <b>Salva modifiche</b>.</li>
		</ol>
		<p class="fi-note">Se incollando vedi il codice invece della firma, usa <b>Modifica → Incolla e adatta stile</b>, oppure apri il file scaricato in Chrome, selezionalo tutto con Cmd+A, copia e incolla.</p>
	</div>

	<div class="dcard fi-prev">
		<h3>Anteprima</h3>
		<div class="fi-mail">
			<p class="fi-mailtxt">…grazie e a presto,</p>
			<!-- eslint-disable-next-line svelte/no-at-html-tags -->
			{@html html}
		</div>
	</div>
</div>

<style>
	.fi-wrap { display: grid; grid-template-columns: minmax(0, 380px) minmax(0, 1fr); gap: 16px; align-items: start; }
	.fi-form h3, .fi-prev h3 { margin: 0 0 10px; font-size: 14px; }
	.fi-form h3 + h3 { margin-top: 18px; }
	.fi-f { display: block; margin-bottom: 10px; font-size: 12.5px; font-weight: 700; }
	.fi-f span { display: block; margin-bottom: 4px; }
	.fi-f em, .fi-note { font-style: normal; font-weight: 500; color: var(--muted); font-size: 11.5px; }
	.fi-f input { width: 100%; padding: 8px 10px; border: 1px solid var(--line); border-radius: 8px; font: inherit; font-size: 13px; }
	.fi-check { display: flex; gap: 8px; align-items: flex-start; font-size: 12.5px; margin: 12px 0; }
	.fi-act { display: flex; gap: 8px; flex-wrap: wrap; margin: 14px 0 6px; }
	.fi-steps { margin: 0; padding-left: 18px; font-size: 13px; line-height: 1.7; }
	.fi-mail { background: #fff; border: 1px solid var(--line); border-radius: 12px; padding: 18px; overflow-x: auto; }
	.fi-mailtxt { margin: 0 0 14px; font: 400 13px/1.6 Arial, Helvetica, sans-serif; color: #202124; }
	@media (max-width: 1000px) { .fi-wrap { grid-template-columns: 1fr; } }
</style>
