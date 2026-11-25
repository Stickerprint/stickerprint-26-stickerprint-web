<script lang="ts">
	/* Pannello «Costi e margini» accanto all'editor del preventivo (Mattia, 25/11/2026): quanto costa il lavoro fra
	   materiale e manodopera, a pezzo e in tutto, quanto si guadagna al prezzo scritto, a che prezzo uscire e quanti
	   giorni servono. Il calcolo sta in $lib/margini/preventivo; qui solo la vista e i campi. */
	import { money, moneyUnit } from '$lib/dashboard/orders';
	import type { OrderDraft } from '$lib/dashboard/orderDraft';
	import { analizzaPreventivo, prezzoPezzoPerMargine, MARGINE_DEFAULT, SFRIDO_DEFAULT, type AnalisiRiga, type Contesto, type VoceCosto } from '$lib/margini/preventivo';

	let { bozza, contesto, onmodifica }: { bozza: OrderDraft; contesto: Contesto; onmodifica: (fn: (d: OrderDraft) => void) => void } = $props();

	const a = $derived(analizzaPreventivo(bozza, contesto));
	let aperta = $state<number | null>(null);
	const lordi = $derived(bozza.price_type === 'lordi');

	/* ---- scritture nella bozza dell'editor ---- */
	const voce = (i: number, patch: Partial<VoceCosto>) => onmodifica((d) => { const it = d.items[i]; if (it) it.costo = { ...(it.costo ?? {}), ...patch }; });
	const impostazioni = (patch: { margine?: number | null }) => onmodifica((d) => { d.costi = { ...(d.costi ?? {}), ...patch }; });
	const n = (e: Event): number | null => { const v = (e.currentTarget as HTMLInputElement).value.replace(',', '.'); return v === '' || !Number.isFinite(Number(v)) ? null : Number(v); };

	/** prezzo a pezzo scritto nell'editor: l'editor lo vuole IVA inclusa se la bozza e' a prezzi lordi */
	const perEditor = (netto: number) => Math.round((lordi ? netto * 1.22 : netto) * 10000) / 10000;
	const applicaListino = (r: AnalisiRiga) => { if (r.listino != null && r.qty > 0) onmodifica((d) => { if (d.items[r.i]) d.items[r.i].price = perEditor(r.listino! / r.qty); }); };
	const applicaRiga = (r: AnalisiRiga, margine: number) => { const p = prezzoPezzoPerMargine(r, margine); if (p > 0) onmodifica((d) => { if (d.items[r.i]) d.items[r.i].price = perEditor(p); }); };
	/** tutte le righe al margine voluto: il costo del corriere si spalma sulle righe in proporzione al loro costo */
	function applicaTutte(margine: number) {
		const lavori = a.righe.filter((r) => r.tipo !== 'servizio' && r.completo && r.costo > 0 && r.qty > 0);
		const base = lavori.reduce((s, r) => s + r.costo, 0);
		if (!base) return;
		onmodifica((d) => { for (const r of lavori) { const costo = r.costo + a.spedizione * (r.costo / base); if (d.items[r.i]) d.items[r.i].price = perEditor(prezzoPezzoPerMargine({ costo, qty: r.qty }, margine)); } });
	}

	/* ---- vista ---- */
	const tempo = (min: number) => { const m = Math.round(min); if (m < 60) return `${m} min`; const h = Math.floor(m / 60), r = m % 60; return r ? `${h} h ${r} min` : `${h} h`; };
	const perc = (v: number | null) => (v == null ? '—' : `${v.toLocaleString('it-IT', { maximumFractionDigits: 1 })}%`);
	const obiettivo = $derived(a.margineObiettivo);
	/** colore del margine: verde se raggiunge l'obiettivo, arancio sopra il 30% (o sopra meta' obiettivo), rosso sotto */
	const tono = (p: number | null) => (p == null ? 'grigio' : p < 0 ? 'rosso' : p >= obiettivo ? 'verde' : p >= Math.min(30, obiettivo) ? 'arancio' : 'rosso');
	const giudizio = $derived(
		a.marginePct == null ? 'Scrivi i prezzi per vedere il margine' :
		a.marginePct < 0 ? 'Sei sotto costo' :
		a.marginePct >= obiettivo ? 'Sopra l’obiettivo: c’è spazio per trattare' :
		a.marginePct >= Math.min(30, obiettivo) ? 'Sotto l’obiettivo, ma si guadagna' : 'Margine basso'
	);
	/* barra del lavoro intero: come si divide il prezzo fra costi e guadagno */
	const barra = $derived.by(() => {
		const tot = Math.max(a.ricavo, a.costo, 0.01);
		const parti = [
			{ nome: 'Materiale', valore: a.materiale, classe: 'mat' },
			{ nome: 'Manodopera', valore: a.manodopera ?? 0, classe: 'man' },
			{ nome: 'Altri costi', valore: a.altri, classe: 'alt' },
			{ nome: 'Corriere', valore: a.spedizione, classe: 'cor' },
			{ nome: 'Guadagno', valore: Math.max(0, a.margine), classe: 'gua' }
		].filter((p) => p.valore > 0);
		return parti.map((p) => ({ ...p, pct: Math.round((p.valore / tot) * 1000) / 10 }));
	});
	/** quanto si puo' scendere dal prezzo scritto prima di andare sotto il margine minimo (30%) */
	const spazio = $derived.by(() => { const min = a.consigli.find((c) => c.nome === 'Minimo'); return min && a.ricavo > min.prezzo ? Math.round((a.ricavo - min.prezzo) * 100) / 100 : 0; });
	const statoRiga = (r: AnalisiRiga) => (r.tipo === 'servizio' ? { t: 'servizio', c: 'grigio' } : r.stato === 'manca' ? { t: 'da completare', c: 'rosso' } : r.stato === 'stima' ? { t: 'stima', c: 'arancio' } : { t: 'calcolato', c: 'verde' });
</script>

<div class="cp">
	<header class="cp__testa">
		<div><h3>💰 Costi e margini</h3><p>Quanto ci costa questo lavoro e fino a dove possiamo spingerci.</p></div>
		<span class="cp__chip cp__chip--{a.completo ? 'verde' : a.righe.length ? 'arancio' : 'grigio'}">{a.completo ? 'conto completo' : a.righe.length ? 'conto parziale' : 'in attesa'}</span>
	</header>

	<!-- due numeri che decidono tutto: quanto costa un'ora e a che margine si vuole uscire -->
	<div class="cp__imposta">
		<!-- il costo orario non si scrive qui: e' quello del Preventivatore, insieme ai secondi di lavoro a pezzo -->
		<div class="cp__orario"><span>Costo di un'ora di lavoro</span><b>{a.orario == null ? '—' : `${a.orario.toLocaleString('it-IT')} €/h`}</b><a href="/dashboard/preventivatori" target="_blank" rel="noopener">dal Preventivatore ↗</a></div>
		<label><span>Margine a cui vuoi uscire: <b>{obiettivo}%</b></span><input type="range" min="10" max="80" step="5" value={obiettivo} oninput={(e) => impostazioni({ margine: Number((e.currentTarget as HTMLInputElement).value) })} /></label>
	</div>
	{#each a.avvisi as m (m)}<p class="cp__avviso">⚠ {m}</p>{/each}

	{#if a.righe.length}
		<!-- il lavoro intero -->
		<section class="cp__totale cp__totale--{tono(a.marginePct)}">
			<div class="cp__kpi">
				<div><small>Ci costa</small><b>{money(a.costo)}</b></div>
				<div><small>Prezzo scritto</small><b>{money(a.ricavo)}</b></div>
				<div class="cp__kpi-gua"><small>Guadagno</small><b>{money(a.margine)}</b></div>
			</div>
			<div class="cp__margine"><b>{perc(a.marginePct)}</b><span>di margine · {giudizio}</span></div>
			{#if barra.length}
				<div class="cp__barra" role="img" aria-label="Come si divide il prezzo fra costi e guadagno">{#each barra as p (p.nome)}<i class="cp__seg cp__seg--{p.classe}" style="width:{p.pct}%" title="{p.nome}: {money(p.valore)}"></i>{/each}</div>
				<ul class="cp__legenda">{#each barra as p (p.nome)}<li><i class="cp__pallino cp__seg--{p.classe}"></i>{p.nome} <b>{money(p.valore)}</b></li>{/each}</ul>
			{/if}
			{#if a.manodopera == null}<p class="cp__nota">Manodopera non contata: il Preventivatore non si legge.</p>{/if}
		</section>

		<!-- tempi -->
		<section class="cp__tempi">
			<div><span>⏱</span><div><b>{tempo(a.minuti)}</b><small>di lavoro</small></div></div>
			<div><span>📅</span><div><b>{a.giorniLavoro.toLocaleString('it-IT')} {a.giorniLavoro === 1 ? 'giornata' : 'giornate'}</b><small>da {tempo(a.minutiGiorno)} l'una</small></div></div>
			<div><span>🚀</span><div><b>pronto in {a.giorniConsegna} {a.giorniConsegna === 1 ? 'giorno' : 'giorni'}</b><small>lavorativi{#if a.attesa}, con {tempo(a.attesa)} di attesa{/if}</small></div></div>
		</section>
		<p class="cp__nota" style="margin-top:-4px">I giorni non contano gli altri lavori già in coda.</p>

		<!-- a che prezzo uscire -->
		{#if a.consigli.length}
			<section class="cp__consigli">
				<h4>A che prezzo uscire <small>IVA esclusa, tutto il lavoro</small></h4>
				<div class="cp__livelli">
					{#each a.consigli as c (c.nome)}
						<div class="cp__livello" class:is-consigliato={c.nome === 'Consigliato'} class:is-superato={a.ricavo >= c.prezzo && a.ricavo > 0}>
							<small>{c.nome} · {c.margine.toLocaleString('it-IT', { maximumFractionDigits: 0 })}%</small>
							<b>{money(c.prezzo)}</b>
							<span>{c.guadagno > 0 ? `+ ${money(c.guadagno)}` : 'nessun guadagno'}</span>
						</div>
					{/each}
				</div>
				{#if a.ricavo > 0 && a.costo > 0}
					<p class="cp__dove">
						{#if a.margine < 0}Al prezzo scritto perdi <b>{money(-a.margine)}</b>: il pareggio è a <b>{money(a.costo)}</b>.
						{:else if spazio > 0}Al prezzo scritto guadagni <b>{money(a.margine)}</b>. Puoi scendere ancora di <b>{money(spazio)}</b> prima di andare sotto il 30%.
						{:else}Al prezzo scritto guadagni <b>{money(a.margine)}</b>: sei già sotto il 30% di margine.{/if}
					</p>
				{/if}
				<button type="button" class="cp__applica" onclick={() => applicaTutte(obiettivo)} disabled={!a.righe.some((r) => r.tipo !== 'servizio' && r.completo && r.costo > 0)}>Porta tutte le righe al {obiettivo}% di margine</button>
			</section>
		{/if}

		<!-- riga per riga -->
		<section class="cp__righe">
			<h4>Riga per riga</h4>
			{#each a.righe as r (r.i)}
				{@const st = statoRiga(r)}
				{@const v = (bozza.items[r.i]?.costo ?? {}) as VoceCosto}
				<article class="cp__riga" class:is-aperta={aperta === r.i}>
					<button type="button" class="cp__riga-testa" onclick={() => (aperta = aperta === r.i ? null : r.i)} aria-expanded={aperta === r.i}>
						<span class="cp__riga-nome"><b>{r.titolo}</b><small>{r.qty.toLocaleString('it-IT')} pz · <i class="cp__chip cp__chip--{st.c}">{st.t}</i></small></span>
						<span class="cp__riga-num">
							{#if r.tipo === 'servizio'}<b>{money(r.ricavo)}</b><small>tutto guadagno</small>
							{:else if r.stato === 'manca'}<b>—</b><small>manca il costo</small>
							{:else}<b class="cp__t--{tono(r.marginePct)}">{perc(r.marginePct)}</b><small>{moneyUnit(r.costoPezzo)} → {moneyUnit(r.prezzoPezzo)}</small>{/if}
						</span>
						<i class="cp__freccia">{aperta === r.i ? '▾' : '▸'}</i>
					</button>
					{#if aperta === r.i}
						<div class="cp__riga-corpo">
							{#if r.tipo !== 'servizio'}
								<div class="cp__modo" role="tablist">
									<button type="button" class:is-on={v.modo !== 'manuale'} onclick={() => voce(r.i, { modo: 'auto' })}>A catalogo</button>
									<button type="button" class:is-on={v.modo === 'manuale'} onclick={() => voce(r.i, { modo: 'manuale' })}>Fuori catalogo</button>
								</div>
							{/if}
							{#each r.note as m (m)}<p class="cp__avviso">{m}</p>{/each}

							{#if r.tipo === 'servizio'}
								<p class="cp__nota">Riga di servizio (spedizione, grafica, impianto): non consuma materiale. Se ha un costo, scrivilo qui sotto.</p>
							{:else if v.modo === 'manuale'}
								<div class="cp__griglia">
									<label class="cp__f cp__f--2"><span>Che materiale è</span><input value={v.materialeNome ?? ''} oninput={(e) => voce(r.i, { materialeNome: (e.currentTarget as HTMLInputElement).value })} placeholder="es. Forex 3 mm, magnetico, tessuto…" /></label>
									<label class="cp__f"><span>Costo al m²</span><div class="cp__campo"><input type="number" min="0" step="0.1" inputmode="decimal" value={v.costoM2 ?? ''} oninput={(e) => voce(r.i, { costoM2: n(e) })} /><i>€</i></div></label>
									<label class="cp__f"><span>oppure a pezzo</span><div class="cp__campo"><input type="number" min="0" step="0.01" inputmode="decimal" value={v.costoPezzo ?? ''} oninput={(e) => voce(r.i, { costoPezzo: n(e) })} /><i>€</i></div></label>
									<label class="cp__f"><span>Larghezza pezzo</span><div class="cp__campo"><input type="number" min="0" step="1" inputmode="decimal" value={v.w ?? ''} oninput={(e) => voce(r.i, { w: n(e) })} /><i>mm</i></div></label>
									<label class="cp__f"><span>Altezza pezzo</span><div class="cp__campo"><input type="number" min="0" step="1" inputmode="decimal" value={v.h ?? ''} oninput={(e) => voce(r.i, { h: n(e) })} /><i>mm</i></div></label>
									<label class="cp__f"><span>Sfrido</span><div class="cp__campo"><input type="number" min="0" max="200" step="5" inputmode="decimal" value={v.sfrido ?? SFRIDO_DEFAULT} oninput={(e) => voce(r.i, { sfrido: n(e) })} /><i>%</i></div></label>
									<label class="cp__f"><span>Minuti di lavoro</span><div class="cp__campo"><input type="number" min="0" step="5" inputmode="numeric" value={v.minuti ?? ''} oninput={(e) => voce(r.i, { minuti: n(e) })} /><i>min</i></div></label>
									<label class="cp__spunta cp__f--2"><input type="checkbox" checked={!!v.stampa} onchange={(e) => voce(r.i, { stampa: (e.currentTarget as HTMLInputElement).checked })} /> La stampiamo noi (aggiunge l'inchiostro)</label>
								</div>
							{:else}
								{#if r.letto}
									<p class="cp__letto">Letto dalla riga: <b>{r.letto.w}×{r.letto.h} mm</b> · <b>{r.letto.materialeLabel}</b>{#if r.letto.lamina !== 'nessuna'} · lamina {r.letto.lamina}{/if}. Si stampano <b>{r.letto.pezziDaFare.toLocaleString('it-IT')}</b> pezzi (con gli scarti) su <b>{r.letto.bobinaM.toLocaleString('it-IT')} m</b> di bobina, resa {r.letto.resaPct.toLocaleString('it-IT')}%.</p>
								{/if}
								<div class="cp__griglia">
									<label class="cp__f"><span>Larghezza</span><div class="cp__campo"><input type="number" min="0" step="1" inputmode="decimal" value={v.w ?? ''} oninput={(e) => voce(r.i, { w: n(e) })} placeholder={r.letto ? String(r.letto.w) : ''} /><i>mm</i></div></label>
									<label class="cp__f"><span>Altezza</span><div class="cp__campo"><input type="number" min="0" step="1" inputmode="decimal" value={v.h ?? ''} oninput={(e) => voce(r.i, { h: n(e) })} placeholder={r.letto ? String(r.letto.h) : ''} /><i>mm</i></div></label>
									{#if r.materialiCatalogo.length}
										<label class="cp__f cp__f--2"><span>Materiale</span><select value={v.materiale ?? ''} onchange={(e) => voce(r.i, { materiale: (e.currentTarget as HTMLSelectElement).value || null })}><option value="">{r.letto ? `Come scritto nella riga (${r.letto.materialeLabel})` : 'Come scritto nella riga'}</option>{#each r.materialiCatalogo as m (m.id)}<option value={m.id}>{m.label}</option>{/each}</select></label>
									{/if}
									<label class="cp__f cp__f--2"><span>Tempo di lavoro, se lo sai già</span><div class="cp__campo"><input type="number" min="0" step="5" inputmode="numeric" value={v.minuti ?? ''} oninput={(e) => voce(r.i, { minuti: n(e) })} placeholder={r.minuti ? `calcolato: ${r.minuti}` : ''} /><i>min</i></div></label>
								</div>
							{/if}
							<div class="cp__griglia">
								<label class="cp__f"><span>Altri costi del lavoro</span><div class="cp__campo"><input type="number" min="0" step="1" inputmode="decimal" value={v.altri ?? ''} oninput={(e) => voce(r.i, { altri: n(e) })} /><i>€</i></div></label>
								<label class="cp__f"><span>Cosa sono</span><input value={v.altriNota ?? ''} oninput={(e) => voce(r.i, { altriNota: (e.currentTarget as HTMLInputElement).value })} placeholder="es. fustella, lavorazione esterna" /></label>
							</div>

							{#if r.tipo !== 'servizio' && r.stato !== 'manca'}
								<table class="cp__conto">
									<tbody>
										{#each r.materiali as m (m.nome)}<tr><td>{m.nome}</td><td>{money(m.valore)}</td></tr>{/each}
										{#each r.fasi as f (f.label)}<tr class="cp__conto-t"><td>{f.label}{#if f.stimata && !f.passiva} <i>(riserva)</i>{/if}</td><td>{f.passiva ? `attesa ${tempo(f.attesa)}` : tempo(f.minuti)}</td></tr>{/each}
										<tr><td>Manodopera ({tempo(r.minuti)}{r.orario ? ` a ${r.orario.toLocaleString('it-IT')} €/h` : ''})</td><td>{r.manodopera == null ? 'non contata' : money(r.manodopera)}</td></tr>
										{#if r.altri}<tr><td>Altri costi{v.altriNota ? `: ${v.altriNota}` : ''}</td><td>{money(r.altri)}</td></tr>{/if}
									</tbody>
									<tfoot>
										<tr><td>Costo del lavoro</td><td>{money(r.costo)}</td></tr>
										<tr><td>Costo a pezzo</td><td>{moneyUnit(r.costoPezzo)}</td></tr>
										<tr><td>Prezzo a pezzo scritto</td><td>{moneyUnit(r.prezzoPezzo)}</td></tr>
										{#if r.listino != null && r.qty > 0}<tr class="cp__conto-t"><td>Listino del sito per questa riga</td><td>{money(r.listino)} · {moneyUnit(r.listino / r.qty)}</td></tr>{/if}
										<tr class="cp__t--{tono(r.marginePct)}"><td>Guadagno su questa riga</td><td>{money(r.margine)} · {perc(r.marginePct)}</td></tr>
									</tfoot>
								</table>
								{#if r.costo > 0}
									<div class="cp__prezzi">
										{#each [30, obiettivo].filter((m, k, tutti) => tutti.indexOf(m) === k) as m (m)}
											<button type="button" onclick={() => applicaRiga(r, m)} title="Scrive questo prezzo a pezzo nella riga del preventivo"><small>al {m}%</small><b>{moneyUnit(prezzoPezzoPerMargine(r, m))}</b><span>usa</span></button>
										{/each}
										{#if r.listino != null && r.qty > 0}
											<button type="button" onclick={() => applicaListino(r)} title="Scrive nella riga il prezzo a pezzo del listino del sito"><small>listino</small><b>{moneyUnit(r.listino / r.qty)}</b><span>usa</span></button>
										{:else}
											{@const pieno = Math.min(95, Math.max(obiettivo + 15, 70))}
											<button type="button" onclick={() => applicaRiga(r, pieno)} title="Scrive questo prezzo a pezzo nella riga del preventivo"><small>al {pieno}%</small><b>{moneyUnit(prezzoPezzoPerMargine(r, pieno))}</b><span>usa</span></button>
										{/if}
									</div>
								{/if}
							{/if}
						</div>
					{/if}
				</article>
			{/each}
		</section>
	{:else}
		<p class="cp__vuoto">Aggiungi le righe del preventivo: qui vedi subito quanto ti costano, quanto ci guadagni e in quanti giorni si fa.</p>
	{/if}
	<p class="cp__piede">Costi di materiali, secondi di lavoro e costo orario sono quelli del Preventivatore; il materiale conta la bobina che si consuma davvero, scarti compresi. Margine = guadagno sul prezzo. Il margine scelto e le correzioni delle righe si salvano col preventivo ({MARGINE_DEFAULT}% se non scegli).</p>
</div>

<style>
	.cp { display: grid; gap: 14px; background: #fff; border: 1px solid var(--line); border-radius: 18px; padding: 18px; font-size: 13.5px; color: var(--ink); }
	.cp__testa { display: flex; justify-content: space-between; gap: 10px; align-items: flex-start; }
	.cp__testa h3 { margin: 0; font-size: 17px; }
	.cp__testa p { margin: 3px 0 0; color: var(--muted); font-size: 12.5px; }
	.cp h4 { margin: 0 0 8px; font-size: 13px; text-transform: uppercase; letter-spacing: .06em; color: var(--ink-soft); display: flex; justify-content: space-between; align-items: baseline; gap: 8px; }
	.cp h4 small { text-transform: none; letter-spacing: 0; font-weight: 400; color: var(--muted); font-size: 11.5px; }
	.cp__chip { display: inline-block; font-style: normal; font-size: 10.5px; font-weight: 800; text-transform: uppercase; letter-spacing: .04em; padding: 3px 8px; border-radius: 999px; white-space: nowrap; }
	.cp__chip--verde { background: #dcfce7; color: #15803d; } .cp__chip--arancio { background: #fef3c7; color: #b45309; } .cp__chip--rosso { background: #fee2e2; color: #b91c1c; } .cp__chip--grigio { background: #eceef3; color: #6b7280; }

	.cp__imposta { display: grid; grid-template-columns: 1fr 1.2fr; gap: 12px; background: #f6f7fb; border-radius: 14px; padding: 12px; }
	.cp__imposta label { display: grid; gap: 6px; font-size: 12px; font-weight: 700; min-width: 0; }
	.cp__imposta input[type=range] { width: 100%; accent-color: var(--blue); }
	.cp__orario { display: grid; gap: 2px; font-size: 12px; font-weight: 700; min-width: 0; }
	.cp__orario b { font-size: 20px; line-height: 1.1; }
	.cp__orario a { font-size: 11.5px; font-weight: 600; color: var(--blue); text-decoration: none; }
	.cp__campo { display: flex; align-items: center; border: 1.5px solid var(--line); border-radius: 10px; background: #fff; overflow: hidden; }
	.cp__campo input { flex: 1; min-width: 0; border: 0; padding: 8px 10px; font: inherit; font-size: 14px; background: transparent; outline: none; }
	.cp__campo i { font-style: normal; font-size: 12px; color: var(--muted); padding: 0 10px 0 2px; }
	.cp__campo:focus-within { border-color: var(--blue); }
	.cp__avviso { margin: 0; padding: 8px 10px; background: #fef6db; color: #8a5a00; border-radius: 10px; font-size: 12.5px; line-height: 1.4; }
	.cp__nota { margin: 0; color: var(--muted); font-size: 12px; }

	.cp__totale { border-radius: 16px; padding: 16px; display: grid; gap: 12px; color: #fff; background: linear-gradient(140deg, #0b0b3b, #1b2b6b); }
	.cp__totale--verde { background: linear-gradient(140deg, #064e3b, #15803d); }
	.cp__totale--arancio { background: linear-gradient(140deg, #7c2d12, #c2620a); }
	.cp__totale--rosso { background: linear-gradient(140deg, #7f1d1d, #c0262d); }
	.cp__kpi { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
	.cp__kpi small { display: block; font-size: 11px; opacity: .8; text-transform: uppercase; letter-spacing: .05em; }
	.cp__kpi b { font-size: 17px; white-space: nowrap; }
	.cp__kpi-gua b { font-size: 19px; }
	.cp__margine { display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap; }
	.cp__margine b { font-size: 38px; line-height: 1; letter-spacing: -0.02em; }
	.cp__margine span { font-size: 13px; opacity: .92; }
	.cp__barra { display: flex; height: 14px; border-radius: 999px; overflow: hidden; background: rgba(255, 255, 255, .18); }
	.cp__seg { display: block; height: 100%; }
	.cp__seg--mat { background: #60a5fa; } .cp__seg--man { background: #fbbf24; } .cp__seg--alt { background: #c4b5fd; } .cp__seg--cor { background: #f9a8d4; } .cp__seg--gua { background: #bef264; }
	.cp__legenda { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: 4px 12px; font-size: 12px; }
	.cp__legenda li { display: flex; align-items: center; gap: 5px; white-space: nowrap; }
	.cp__pallino { width: 9px; height: 9px; border-radius: 50%; display: inline-block; }
	.cp__totale .cp__nota { color: rgba(255, 255, 255, .85); }

	.cp__tempi { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
	.cp__tempi > div { display: flex; gap: 8px; align-items: center; background: #f6f7fb; border-radius: 12px; padding: 10px; min-width: 0; }
	.cp__tempi span { font-size: 18px; }
	.cp__tempi b { display: block; font-size: 13px; line-height: 1.2; }
	.cp__tempi small { color: var(--muted); font-size: 11px; line-height: 1.2; display: block; }

	.cp__livelli { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
	.cp__livello { border: 1.5px solid var(--line); border-radius: 12px; padding: 9px 12px; display: grid; grid-template-columns: 1fr auto; gap: 2px 8px; align-items: baseline; min-width: 0; }
	.cp__livello small { grid-column: 1 / -1; }
	.cp__livello small { font-size: 10.5px; color: var(--muted); text-transform: uppercase; letter-spacing: .03em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
	.cp__livello b { font-size: 16px; white-space: nowrap; }
	.cp__livello span { font-size: 11px; color: #15803d; white-space: nowrap; }
	.cp__livello.is-consigliato { border-color: var(--blue); background: #f4f9ff; }
	.cp__livello.is-superato { box-shadow: inset 0 -3px 0 #8be33a; }
	.cp__dove { margin: 10px 0 0; font-size: 13px; line-height: 1.45; }
	.cp__applica { margin-top: 10px; width: 100%; border: 0; border-radius: 12px; padding: 11px; font: inherit; font-weight: 800; font-size: 13px; background: var(--blue); color: #fff; cursor: pointer; }
	.cp__applica:disabled { opacity: .45; cursor: not-allowed; }

	.cp__riga { border: 1px solid var(--line); border-radius: 12px; overflow: hidden; }
	.cp__riga + .cp__riga { margin-top: 6px; }
	.cp__riga.is-aperta { border-color: var(--blue); }
	.cp__riga-testa { width: 100%; display: grid; grid-template-columns: minmax(0, 1fr) auto 14px; gap: 10px; align-items: center; background: #fff; border: 0; padding: 10px 12px; font: inherit; text-align: left; cursor: pointer; color: inherit; }
	.cp__riga-nome { min-width: 0; display: grid; gap: 3px; }
	.cp__riga-nome b { font-size: 13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
	.cp__riga-nome small, .cp__riga-num small { color: var(--muted); font-size: 11.5px; }
	.cp__riga-num { text-align: right; display: grid; gap: 2px; }
	.cp__riga-num b { font-size: 15px; }
	.cp__freccia { font-style: normal; color: var(--muted); }
	.cp__t--verde, .cp__t--verde td { color: #15803d; } .cp__t--arancio, .cp__t--arancio td { color: #b45309; } .cp__t--rosso, .cp__t--rosso td { color: #b91c1c; } .cp__t--grigio { color: var(--muted); }
	.cp__riga-corpo { display: grid; gap: 10px; padding: 12px; border-top: 1px solid var(--line); background: #fbfbfe; }
	.cp__modo { display: grid; grid-template-columns: 1fr 1fr; background: #eceef3; border-radius: 10px; padding: 3px; }
	.cp__modo button { border: 0; background: transparent; border-radius: 8px; padding: 7px; font: inherit; font-size: 12.5px; font-weight: 700; cursor: pointer; color: var(--ink-soft); }
	.cp__modo button.is-on { background: #fff; color: var(--ink); box-shadow: 0 1px 3px rgba(0, 0, 0, .12); }
	.cp__letto { margin: 0; font-size: 12.5px; line-height: 1.5; color: var(--ink-soft); }
	.cp__griglia { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
	.cp__f { display: grid; gap: 4px; font-size: 11.5px; font-weight: 700; min-width: 0; }
	.cp__f--2 { grid-column: 1 / -1; }
	.cp__f > input, .cp__f > select { width: 100%; border: 1.5px solid var(--line); border-radius: 10px; padding: 8px 10px; font: inherit; font-size: 13.5px; background: #fff; min-width: 0; }
	.cp__spunta { display: flex; gap: 8px; align-items: center; font-size: 12.5px; font-weight: 600; }
	.cp__conto { width: 100%; border-collapse: collapse; font-size: 12.5px; }
	.cp__conto td { padding: 4px 0; border-bottom: 1px dashed var(--line); }
	.cp__conto td:last-child { text-align: right; white-space: nowrap; font-weight: 700; }
	.cp__conto-t td { color: var(--muted); } .cp__conto-t td:last-child { font-weight: 400; } .cp__conto-t i { font-size: 11px; }
	.cp__conto tfoot td { border-bottom: 0; padding-top: 5px; font-weight: 700; }
	.cp__conto tfoot tr:first-child td { border-top: 2px solid var(--ink); }
	.cp__prezzi { display: grid; grid-template-columns: repeat(auto-fit, minmax(0, 1fr)); gap: 6px; }
	.cp__prezzi button { border: 1.5px solid var(--line); background: #fff; border-radius: 10px; padding: 7px 6px; font: inherit; cursor: pointer; display: grid; gap: 1px; text-align: center; color: inherit; }
	.cp__prezzi button:hover { border-color: var(--blue); }
	.cp__prezzi small { font-size: 10.5px; color: var(--muted); } .cp__prezzi b { font-size: 13.5px; } .cp__prezzi span { font-size: 10.5px; font-weight: 800; color: var(--blue); text-transform: uppercase; }
	.cp__vuoto { margin: 0; padding: 22px 14px; text-align: center; color: var(--muted); background: #f6f7fb; border-radius: 14px; line-height: 1.5; }
	.cp__piede { margin: 0; font-size: 11px; color: var(--muted); line-height: 1.45; }
	@media (max-width: 520px) { .cp__imposta, .cp__tempi { grid-template-columns: 1fr; } .cp__kpi b { font-size: 15px; } }
</style>
