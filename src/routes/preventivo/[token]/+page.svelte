<script lang="ts">
	import { enhance } from '$app/forms';
	import { money } from '$lib/dashboard/orders';
	let { data, form } = $props();
	const q = $derived(data.q);
	let rejecting = $state(false);
	const pdfHref = $derived(`data:application/pdf;base64,${data.pdf}`);
	const it = (d: string | null) => (d ? new Date(d + 'T12:00:00').toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' }) : '');
	const lordi = $derived(q.draft.price_type === 'lordi');
	const done = $derived(q.status === 'accettato' || q.status === 'ordinato' || form?.ok);
</script>

<svelte:head><title>Preventivo {q.number} | Stickerprint</title><meta name="robots" content="noindex" /></svelte:head>

<section class="section" style="padding-top:40px">
	<div class="container" style="max-width:820px">
		<p class="kicker">Preventivo {q.number}{#if q.version > 1} · rev. {q.version}{/if}</p>
		<h1 style="margin-bottom:8px">{done ? 'Preventivo confermato ✅' : q.status === 'rifiutato' ? 'Preventivo rifiutato' : q.status === 'scaduto' ? 'Preventivo scaduto' : `Ciao ${q.draft.customer.first_name || q.draft.customer.name}, ecco il tuo preventivo`}</h1>
		{#if form?.error}<p class="error">{form.error}</p>{/if}
		{#if form?.message}<p class="ok">{form.message}</p>{/if}
		{#if done}
			<p class="lead">Grazie: abbiamo registrato la conferma. Ti mandiamo la conferma d'ordine con il riepilogo e i tempi. Per qualsiasi cosa rispondi all'email che hai ricevuto.</p>
		{:else if q.status === 'scaduto' || q.status === 'rifiutato'}
			<p class="lead">Questo preventivo non è più attivo. Scrivici a <a href="mailto:info@stickerprint.it">info@stickerprint.it</a> e te ne prepariamo uno aggiornato.</p>
		{:else}
			<p class="lead">Preparato per <b>{q.draft.customer.name}</b>{#if q.valid_until}, valido fino al <b>{it(q.valid_until)}</b>{/if}. Guarda le righe, scarica il PDF e conferma con un clic: la commessa entra subito in lavorazione.</p>
		{/if}

		<div class="panel" style="margin-top:22px;overflow:auto">
			<table class="dtable">
				<thead><tr><th>Descrizione</th><th style="text-align:right">Quantità</th><th style="text-align:right">Prezzo {lordi ? 'IVA incl.' : 'unitario'}</th><th style="text-align:right">Totale</th></tr></thead>
				<tbody>
					{#each q.draft.items.filter((i) => Number(i.qty) > 0) as i, k (k)}
						<tr><td>{i.code ? i.code + ' · ' : ''}{i.description}</td><td style="text-align:right">{Number(i.qty).toLocaleString('it-IT')}</td><td style="text-align:right">{money(Number(i.price))}</td><td style="text-align:right"><b>{money(Number(i.price) * Number(i.qty))}</b></td></tr>
					{/each}
				</tbody>
			</table>
			<div style="display:grid;justify-content:end;gap:4px;margin-top:14px;font-size:15px">
				<div>Imponibile <b>{money(Number(q.total_net))}</b></div>
				<div>IVA 22% <b>{money(Number(q.total_gross) - Number(q.total_net))}</b></div>
				<div style="font-size:20px">Totale <b>{money(Number(q.total_gross))}</b></div>
			</div>
			{#if q.draft.terms?.length}<p class="note" style="margin-top:10px">Pagamento: {[...new Set(q.draft.terms.map((t) => t.method))].join(' + ')}{#if q.draft.ship_date} · spedizione prevista {it(q.draft.ship_date)}{/if}</p>{/if}
		</div>

		<div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:20px;align-items:center">
			<a class="btn btn--ghost" href={pdfHref} download="Preventivo-{q.number}.pdf">📄 Scarica il PDF</a>
			{#if !done && q.status === 'inviato'}
				<form method="POST" action="?/accetta" use:enhance style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
					<input name="nome" placeholder="Nome e cognome di chi conferma" required style="padding:12px 14px;border:1px solid var(--line);border-radius:12px;font:inherit;min-width:260px" />
					<button class="btn btn--green" type="submit">✓ Accetto il preventivo</button>
				</form>
				{#if !rejecting}<button class="link-btn" type="button" onclick={() => (rejecting = true)}>Non fa per me</button>{/if}
			{/if}
		</div>
		{#if rejecting && !done}
			<form method="POST" action="?/rifiuta" use:enhance style="display:grid;gap:8px;margin-top:14px;max-width:520px">
				<textarea name="motivo" rows="3" placeholder="Se ci dici cosa non torna (prezzo, tempi, materiale) proviamo a sistemarlo." style="padding:10px 12px;border:1px solid var(--line);border-radius:12px;font:inherit"></textarea>
				<div style="display:flex;gap:8px"><button class="btn btn--ghost btn--xs" type="submit">Invia</button><button class="btn btn--ghost btn--xs" type="button" onclick={() => (rejecting = false)}>Annulla</button></div>
			</form>
		{/if}
		<p class="note" style="margin-top:26px">Accettando il preventivo confermi l'ordine alle condizioni indicate. I tempi di produzione partono dall'approvazione dell'anteprima di stampa.</p>
	</div>
</section>
