<script lang="ts">
	import { enhance } from '$app/forms';
	import { prezzo, finituraListino, normalizzaListino, type Listino } from '$lib/pricing/listino';

	let { data, form } = $props();

	/* Il preventivatore vive in un iframe (pagina servita da ./simulatore, solo staff): a ogni modifica
	   manda qui il listino intero; il sito cambia SOLO quando si preme Salva. */
	let listino = $state('');
	let altezza = $state(1400);
	let giro = $state(0); // cambia dopo un salvataggio: l'iframe si ricarica col listino online
	let salvando = $state(false);
	const modificato = $derived(listino !== '');

	/* CONFRONTO CON IL 2026: i prezzi 2026 arrivano gia' calcolati dal server (fotografia del sito prima del listino
	   nuovo); quelli 2027 si calcolano qui dal listino che si sta guardando, quindi seguono subito ogni modifica */
	let vivo = $state<Listino | null>(null); // il listino mostrato dal simulatore in questo momento
	const L = $derived(vivo ?? (data.listino as Listino));
	let formato = $state(1); // indice in data.confronto.formati (50 mm)
	let conLamina = $state(false);
	const QV = [15, 50, 100, 200, 500, 1000, 3000];
	const euro = (v: number) => new Intl.NumberFormat('it-IT', { maximumFractionDigits: Number.isInteger(v) ? 0 : 2, minimumFractionDigits: Number.isInteger(v) ? 0 : 2 }).format(v) + ' €';
	const righe = $derived(data.confronto.prodotti.map((p) => {
		const v = p.varianti.find((x) => x.lamina === conLamina) ?? p.varianti[0];
		const lp = L.prodotti.find((x) => x.id === p.slug);
		const lato = data.confronto.formati[formato];
		const celle = QV.map((q) => {
			const i = data.confronto.quantita.indexOf(q);
			if (!lp || i < 0 || q < p.minQty) return null;
			const prima = v.prezzi[formato][i];
			const ora = prezzo(L, lp, { mat: v.materiale, fin: finituraListino(L, lp, p.kind, v.finitura, v.laminata), w: lato, h: lato, q }).lordo;
			return { prima, ora, diff: prima > 0 ? Math.round((ora / prima - 1) * 100) : 0 };
		});
		return { nome: p.nome, celle };
	}));

	$effect(() => {
		const onMsg = (e: MessageEvent) => {
			if (e.origin !== location.origin || !e.data || typeof e.data !== 'object') return;
			/* il simulatore scrive qui anche all'apertura, senza che nulla sia cambiato: conta solo se dice che e' diverso dal listino online */
			if (e.data.type === 'listino-2027' && e.data.listino) { listino = e.data.modificato ? JSON.stringify(e.data.listino) : ''; vivo = normalizzaListino(e.data.listino) ?? vivo; }
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
	<h3>Confronto con il listino 2026</h3>
	<p class="lead" style="font-size:13.5px;margin-bottom:12px">Per ogni prodotto: il prezzo di adesso (in grande), quello del 2026 (sotto, in grigio) e la differenza. Prezzi IVA inclusa, pezzo quadrato. I prezzi 2027 seguono i numeri che stai guardando qui sopra, anche prima di salvare.</p>
	<div class="cfr__ctrl">
		<label>Formato
			<select bind:value={formato}>{#each data.confronto.formati as f, i (f)}<option value={i}>{f / 10} × {f / 10} cm</option>{/each}</select>
		</label>
		<div class="cfr__seg" role="group" aria-label="Lamina">
			<button type="button" class:is-on={!conLamina} onclick={() => (conLamina = false)}>Senza lamina</button>
			<button type="button" class:is-on={conLamina} onclick={() => (conLamina = true)}>Con lamina</button>
		</div>
	</div>
	<div style="overflow-x:auto">
		<table class="dtable cfr">
			<thead><tr><th>Prodotto</th>{#each QV as q (q)}<th>{q.toLocaleString('it-IT')} pz</th>{/each}</tr></thead>
			<tbody>
				{#each righe as r (r.nome)}
					<tr>
						<td><b>{r.nome}</b></td>
						{#each r.celle as c, i (i)}
							<td>{#if c}<b>{euro(c.ora)}</b><small>2026: {euro(c.prima)}</small><span class="cfr__d" class:su={c.diff > 0} class:giu={c.diff < 0}>{c.diff > 0 ? '+' : ''}{c.diff}%</span>{:else}<span class="cfr__no">—</span>{/if}</td>
						{/each}
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
	<p style="color:var(--muted);font-size:12.5px;margin-top:10px">Il 2026 è la fotografia dei prezzi online il 19/11/2026, con il materiale bianco (trasparente per le vetrofanie). Sui resinati la lamina non c'entra: c'è sempre la resina.</p>
</div>

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
	.cfr__ctrl { display: flex; gap: 12px; align-items: flex-end; flex-wrap: wrap; margin-bottom: 12px; }
	.cfr__ctrl label { display: grid; gap: 4px; font-size: 12.5px; font-weight: 700; color: var(--muted); }
	.cfr__ctrl select { border: 1px solid var(--line, #e6e7f0); border-radius: 10px; padding: 8px 10px; font: inherit; font-weight: 700; color: var(--ink); background: #fff; }
	.cfr__seg { display: inline-flex; border: 1px solid var(--line, #e6e7f0); border-radius: 999px; padding: 2px; background: #f5f6fb; }
	.cfr__seg button { border: 0; background: none; border-radius: 999px; padding: 7px 12px; font: inherit; font-size: 13px; font-weight: 700; color: var(--muted); cursor: pointer; }
	.cfr__seg button.is-on { background: #fff; color: var(--ink); box-shadow: 0 1px 2px rgba(5, 5, 56, .15); }
	.cfr td { white-space: nowrap; font-variant-numeric: tabular-nums; vertical-align: top; }
	.cfr td small { display: block; color: var(--muted); font-size: 12px; }
	.cfr__d { display: inline-block; margin-top: 2px; font-size: 11.5px; font-weight: 700; border-radius: 999px; padding: 1px 7px; background: #eef0f6; color: var(--muted); }
	.cfr__d.su { background: #eefbe2; color: #2f7d0b; }
	.cfr__d.giu { background: #ffe9e6; color: #b3261e; }
	.cfr__no { color: var(--muted); }
	.sim { width: 100%; border: 1px solid var(--line, #e6e7f0); border-radius: 14px; background: #f4f4f1; display: block; margin-bottom: 18px; }
</style>
