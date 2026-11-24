<script lang="ts">
	import { enhance } from '$app/forms';

	let { data, form } = $props();

	/* Il preventivatore vive in un iframe (pagina servita da ./simulatore, solo staff): a ogni modifica
	   manda qui il listino intero; il sito cambia SOLO quando si preme Salva. */
	let listino = $state('');
	let altezza = $state(1400);
	let giro = $state(0); // cambia dopo un salvataggio: l'iframe si ricarica col listino online
	let salvando = $state(false);
	const modificato = $derived(listino !== '');

	$effect(() => {
		const onMsg = (e: MessageEvent) => {
			if (e.origin !== location.origin || !e.data || typeof e.data !== 'object') return;
			/* il simulatore scrive qui anche all'apertura, senza che nulla sia cambiato: conta solo se dice che e' diverso dal listino online */
			if (e.data.type === 'listino-2027' && e.data.listino) listino = e.data.modificato ? JSON.stringify(e.data.listino) : '';
			if (e.data.type === 'listino-2027-altezza' && e.data.h > 0) altezza = Math.ceil(e.data.h) + 8;
		};
		window.addEventListener('message', onMsg);
		return () => window.removeEventListener('message', onMsg);
	});
	$effect(() => {
		const avvisa = (e: BeforeUnloadEvent) => { if (modificato) e.preventDefault(); };
		window.addEventListener('beforeunload', avvisa);
		return () => window.removeEventListener('beforeunload', avvisa);
	});

	const dopo = () => {
		salvando = true;
		return async ({ result, update }: { result: { type: string }; update: () => Promise<void> }) => {
			await update();
			salvando = false;
			if (result.type === 'success') { listino = ''; giro += 1; }
		};
	};
</script>

<svelte:head><title>Preventivatore | Dashboard Stickerprint</title></svelte:head>

<div class="toolbar" style="justify-content:space-between;align-items:flex-start">
	<div>
		<h1>Preventivatore</h1>
		<p class="lead">
			Un solo listino per tutti i prodotti. Cambi i numeri qui sotto, guardi l'effetto sui prezzi e premi <b>Salva e metti online</b>: da quel momento sito, carrello e preventivi usano i nuovi prezzi.
			{#if data.savedAt}Ultimo salvataggio: {new Date(data.savedAt).toLocaleString('it-IT')}.{:else}Online c'è il listino 2027 di partenza: non è ancora stato salvato nulla da qui.{/if}
		</p>
	</div>
</div>

{#if form?.error}<p class="error">{form.error}</p>{/if}
{#if form?.ok}<p class="success">Listino salvato: il sito usa già i nuovi prezzi.</p>{/if}

<div class="barra" class:barra--on={modificato}>
	<span>{modificato ? 'Hai modifiche non ancora online.' : 'Nessuna modifica da salvare.'}</span>
	<div style="display:flex;gap:8px;flex-wrap:wrap">
		{#if modificato}<button type="button" class="btn btn--ghost btn--xs" onclick={() => { listino = ''; giro += 1; }}>Annulla le modifiche</button>{/if}
		<form method="POST" action="?/save" use:enhance={dopo}>
			<input type="hidden" name="listino" value={listino} />
			<button class="btn btn--green" type="submit" disabled={!modificato || salvando}>{salvando ? 'Salvataggio…' : 'Salva e metti online'}</button>
		</form>
	</div>
</div>

{#key giro}
	<iframe class="sim" title="Listino prezzi 2027" src="/dashboard/preventivatori/simulatore?v={giro}" style="height:{altezza}px"></iframe>
{/key}

<div class="dcard">
	<h3>Sagome, misure e cosa vede il cliente</h3>
	<p class="lead" style="font-size:13.5px;margin-bottom:12px">Queste pagine non toccano i prezzi: servono per sagome, misure minime, materiali e finiture visibili di ogni prodotto, e per provare il preventivatore come lo vede il cliente.</p>
	<div style="display:flex;gap:8px;flex-wrap:wrap">
		{#each data.prodotti as p (p.slug)}
			<a class="btn btn--ghost btn--xs" href="/dashboard/preventivatori/{p.slug}">{p.name}</a>
		{/each}
	</div>
</div>

<div class="dcard">
	<h3>Versioni precedenti del listino</h3>
	{#if data.history.length === 0}
		<p style="color:var(--muted);font-size:14px">Nessuna versione precedente: compaiono qui a ogni salvataggio.</p>
	{:else}
		<table class="dtable">
			<thead><tr><th>Sostituita il</th><th>Ricarico</th><th>Aumento generale</th><th></th></tr></thead>
			<tbody>
				{#each data.history as h (h.id)}
					<tr>
						<td>{new Date(h.changedAt).toLocaleString('it-IT')}</td>
						<td>{h.ricarico ?? '—'}</td>
						<td>{h.aumento != null ? `${h.aumento}%` : '—'}</td>
						<td>
							<form method="POST" action="?/restore" use:enhance={dopo} onsubmit={(e) => { if (!confirm('Rimettere online questa versione del listino?')) e.preventDefault(); }}>
								<input type="hidden" name="id" value={h.id} /><button class="btn btn--ghost btn--xs" type="submit">Rimetti online</button>
							</form>
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	{/if}
	<form method="POST" action="?/reset" use:enhance={dopo} style="margin-top:12px" onsubmit={(e) => { if (!confirm('Tornare al listino 2027 di partenza? I prezzi online cambiano subito.')) e.preventDefault(); }}>
		<button class="link-btn" type="submit">Torna al listino 2027 di partenza</button>
	</form>
</div>

<style>
	.barra { position: sticky; top: 8px; z-index: 5; display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap; background: #fff; border: 1px solid var(--line, #e6e7f0); border-radius: 14px; padding: 10px 14px; margin: 14px 0; font-size: 14px; font-weight: 600; }
	.barra--on { border-color: #f4b400; background: #fffbe8; }
	.sim { width: 100%; border: 1px solid var(--line, #e6e7f0); border-radius: 14px; background: #f4f4f1; display: block; margin-bottom: 18px; }
</style>
