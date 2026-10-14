<script lang="ts">
	import '$lib/styles/home.css';
	import Linee from '$lib/components/dashboard/Linee.svelte';
	import { money, dmy, CHANNEL_ICON } from '$lib/dashboard/orders';
	import { meseBreve, meseLungo } from '$lib/dashboard/tempo';
	import { TICKET_KIND, TICKET_STATUS, SLA_HOURS } from '$lib/dashboard/helpdesk';
	import { grado } from '$lib/margini/rating';
	let { data } = $props();

	const nome = $derived(data.fullName?.split(' ')[0] ?? '');
	const ora = new Date().getHours();
	const saluto = ora < 13 ? 'Buongiorno' : ora < 18 ? 'Buon pomeriggio' : 'Buonasera';
	const oggiLungo = $derived(new Date(`${data.oggi}T12:00:00Z`).toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }));

	/* fatturato: il mese selezionato nel grafico (all'apertura quello in corso) */
	let mese = $state('');
	const meseSel = $derived(mese || data.fatturato.meseCorrente);
	const sel = $derived(data.fatturato.mesi.find((m) => m.mese === meseSel) ?? data.fatturato.mesi[data.fatturato.mesi.length - 1]);
	const punti = $derived(data.fatturato.mesi.map((m) => ({ id: m.mese, label: meseBreve(m.mese) + (m.mese.endsWith('-01') ? ` ${m.mese.slice(2, 4)}` : ''), valori: [m.ecommerce, m.manuale] })));
	const SERIE = [{ nome: 'E-commerce', colore: '#0e8bff' }, { nome: 'Manuali', colore: '#050538' }];
	const corto = (v: number) => (v >= 1000 ? `${(v / 1000).toLocaleString('it-IT', { maximumFractionDigits: v >= 10000 ? 0 : 1 })}k €` : `${Math.round(v)} €`);
	const quota = (parte: number, tot: number) => (tot > 0 ? `${Math.round((parte / tot) * 100)}%` : '—');
	const mesePrecedente = $derived.by(() => { const i = data.fatturato.mesi.findIndex((m) => m.mese === sel.mese); return i > 0 ? data.fatturato.mesi[i - 1] : null; });
	const delta = $derived(mesePrecedente && mesePrecedente.totale > 0 ? Math.round(((sel.totale - mesePrecedente.totale) / mesePrecedente.totale) * 100) : null);

	const oraDi = (iso: string) => new Date(iso).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Rome' });
	const nuoviTotale = $derived(data.nuovi.reduce((s, o) => s + o.gross, 0));
	const inRitardo = $derived(data.daPartire.filter((o) => o.ritardo).length);
	const g = $derived(data.margini ? grado(data.margini.lettera) : null);
	const pct = (v: number | null) => (v == null ? '—' : `${v.toLocaleString('it-IT', { maximumFractionDigits: 1 })}%`);
</script>

<svelte:head><title>Home | Dashboard Stickerprint</title><meta name="robots" content="noindex" /></svelte:head>

<div class="hm">
	<header class="hm-testa">
		<div>
			<h1>{saluto}{nome ? `, ${nome}` : ''}.</h1>
			<p class="lead" style="text-transform:capitalize">{oggiLungo}</p>
		</div>
		<div class="hm-kpi">
			<a class="hm-kpi__box" href="#nuovi"><small>Nuovi ordini oggi</small><b>{data.nuovi.length}</b><span>{data.nuovi.length ? money(nuoviTotale) : 'ancora nessuno'}</span></a>
			<a class="hm-kpi__box" class:is-hot={inRitardo > 0} href="#partire"><small>Devono partire oggi</small><b>{data.daPartire.length}</b><span>{inRitardo ? `${inRitardo} in ritardo` : data.daPartire.length ? `${data.daPartire.filter((o) => o.pronto).length} pronti da spedire` : 'niente in scadenza'}</span></a>
			<a class="hm-kpi__box" class:is-warn={data.assistenza.ticket.length > 0} href="#assistenza"><small>Da rispondere</small><b>{data.assistenza.ticket.length}</b><span>{data.assistenza.aperti} richieste aperte</span></a>
			<a class="hm-kpi__box" href="#fatturato"><small>Fatturato {meseBreve(data.fatturato.meseCorrente)}</small><b>{corto(data.fatturato.mesi[data.fatturato.mesi.length - 1].totale)}</b><span>netto, {data.fatturato.mesi[data.fatturato.mesi.length - 1].fatture} fatture</span></a>
		</div>
	</header>

	<!-- Fatturato -->
	<section class="dcard hm-fatt" id="fatturato">
		<div class="hm-card__testa">
			<div><h3>Andamento del fatturato</h3><p class="hm-nota">Netto fatturato (imponibile meno sconti, più express) mese per mese negli ultimi 12 mesi. Clicca un mese per vederne il riepilogo.</p></div>
			<a class="btn btn--sm btn--ghost" href="/dashboard/fatturazione/fatture">Tutte le fatture →</a>
		</div>
		<Linee {punti} serie={SERIE} selezionato={sel.mese} onselect={(id) => (mese = id)} formato={corto} />
		<div class="hm-riep">
			<div class="hm-riep__big">
				<small>Fatturato netto · <span style="text-transform:capitalize">{meseLungo(sel.mese)}</span>{#if sel.mese === data.fatturato.meseCorrente} (in corso){/if}</small>
				<b>{money(sel.totale)}</b>
				<span class="hm-riep__sotto">
					<i class="hm-dot" style="background:#0e8bff"></i>E-commerce <strong>{money(sel.ecommerce)}</strong> <em>{quota(sel.ecommerce, sel.totale)} · {sel.fattureEcommerce} fatture</em>
					<i class="hm-dot" style="background:#050538;margin-left:14px"></i>Manuali <strong>{money(sel.manuale)}</strong> <em>{quota(sel.manuale, sel.totale)} · {sel.fattureManuali} fatture</em>
				</span>
				{#if delta != null}<span class="hm-delta" class:su={delta > 0} class:giu={delta < 0}>{delta > 0 ? '▲' : delta < 0 ? '▼' : '='} {Math.abs(delta)}% rispetto a {meseLungo(mesePrecedente!.mese)}</span>{/if}
			</div>
			<div class="hm-riep__anno">
				<small>Anno {data.oggi.slice(0, 4)}</small>
				<b>{money(data.fatturato.anno.totale)}</b>
				<span class="hm-riep__sotto"><i class="hm-dot" style="background:#0e8bff"></i>E-commerce <strong>{money(data.fatturato.anno.ecommerce)}</strong> <em>{quota(data.fatturato.anno.ecommerce, data.fatturato.anno.totale)}</em><br /><i class="hm-dot" style="background:#050538"></i>Manuali <strong>{money(data.fatturato.anno.manuale)}</strong> <em>{quota(data.fatturato.anno.manuale, data.fatturato.anno.totale)}</em></span>
			</div>
		</div>
	</section>

	<div class="hm-due">
		<!-- Devono partire oggi -->
		<section class="dcard hm-lista" id="partire">
			<div class="hm-card__testa">
				<div><h3>Devono partire oggi</h3><p class="hm-nota">Ordini con la data di spedizione promessa entro oggi e non ancora partiti.</p></div>
				<a class="btn btn--sm btn--ghost" href="/dashboard/produzione/spedizioni">Spedizioni →</a>
			</div>
			{#if !data.daPartire.length}
				<div class="hm-vuoto">✅ Niente in scadenza oggi.</div>
			{:else}
				<ul class="hm-ordini">
					{#each data.daPartire as o (o.key)}
						<li class:is-late={o.ritardo}>
							<a class="hm-ord" href={o.href}>
								<span class="hm-thumb">{#if o.thumb}<img src={o.thumb} alt="" loading="lazy" />{:else}<i>{o.prodotto.slice(0, 2).toUpperCase()}</i>{/if}</span>
								<span class="hm-ord__testo">
									<b>{o.number}<small title={CHANNEL_ICON[o.channel]?.label}> {CHANNEL_ICON[o.channel]?.icon ?? ''}</small> · {o.customer}</b>
									<span>{o.prodotto}{#if o.articoli > 1} + altri {o.articoli - 1}{/if} · {o.qty.toLocaleString('it-IT')} pz{#if o.express} · <em class="hm-chip hm-chip--express">express</em>{/if}</span>
								</span>
								<span class="hm-ord__stato">
									{#if o.pronto}<em class="hm-chip hm-chip--ok">Pronto da spedire</em>{:else}<em class="hm-chip hm-chip--prod">{o.fase ?? o.statoLabel}</em>{/if}
									<small>{o.ritardo ? `⚠️ doveva partire il ${dmy(o.shipBy)}` : 'entro le 17:00'}</small>
								</span>
							</a>
						</li>
					{/each}
				</ul>
			{/if}
		</section>

		<!-- Nuovi ordini di oggi -->
		<section class="dcard hm-lista" id="nuovi">
			<div class="hm-card__testa">
				<div><h3>Nuovi ordini di oggi</h3><p class="hm-nota">{data.nuovi.length ? `${data.nuovi.length} ordini per ${money(nuoviTotale)} IVA inclusa.` : 'Arrivano qui in tempo reale.'}</p></div>
				<a class="btn btn--sm btn--ghost" href="/dashboard/fatturazione/ordini">Tutti gli ordini →</a>
			</div>
			{#if !data.nuovi.length}
				<div class="hm-vuoto">🕐 Ancora nessun ordine oggi.</div>
			{:else}
				<ul class="hm-ordini">
					{#each data.nuovi as o (o.key)}
						<li>
							<a class="hm-ord" href={o.href}>
								<span class="hm-thumb">{#if o.thumb}<img src={o.thumb} alt="" loading="lazy" />{:else}<i>{o.prodotto.slice(0, 2).toUpperCase()}</i>{/if}</span>
								<span class="hm-ord__testo">
									<b>{o.number}<small title={CHANNEL_ICON[o.channel]?.label}> {CHANNEL_ICON[o.channel]?.icon ?? ''}</small> · {o.customer}</b>
									<span>{o.prodotto}{#if o.articoli > 1} + altri {o.articoli - 1}{/if} · {o.qty.toLocaleString('it-IT')} pz · ore {oraDi(o.created_at)}</span>
								</span>
								<span class="hm-ord__stato">
									<b class="hm-prezzo">{money(o.gross)}</b>
									<em class="st" style="background:{o.statoSfondo};color:{o.statoColore}">{o.statoLabel}</em>
								</span>
							</a>
						</li>
					{/each}
				</ul>
			{/if}
		</section>
	</div>

	<div class="hm-due">
		<!-- Assistenza -->
		<section class="dcard hm-lista" id="assistenza">
			<div class="hm-card__testa">
				<div><h3>Assistenza da rispondere</h3><p class="hm-nota">Richieste nuove o con un messaggio del cliente non ancora letto, dalla più vecchia.</p></div>
				<a class="btn btn--sm btn--ghost" href="/dashboard/supporto/ticket">Tutte le richieste →</a>
			</div>
			{#if !data.assistenza.ticket.length}
				<div class="hm-vuoto">💬 Nessuna richiesta in attesa di risposta.</div>
			{:else}
				<ul class="hm-ticket">
					{#each data.assistenza.ticket as t (t.id)}
						<li class:is-late={(t.ore ?? 0) >= SLA_HOURS}>
							<a href={t.href}>
								<span class="hm-ticket__ico">{TICKET_KIND[t.kind as keyof typeof TICKET_KIND]?.icon ?? '💬'}</span>
								<span class="hm-ord__testo">
									<b>{t.number} · {t.name ?? t.email}</b>
									<span>{t.subject ?? TICKET_KIND[t.kind as keyof typeof TICKET_KIND]?.label ?? ''}{#if t.order_number} · ordine {t.order_number}{/if}</span>
								</span>
								<span class="hm-ord__stato">
									<em class="st" style="background:{TICKET_STATUS[t.status as keyof typeof TICKET_STATUS]?.soft};color:{TICKET_STATUS[t.status as keyof typeof TICKET_STATUS]?.color}">{TICKET_STATUS[t.status as keyof typeof TICKET_STATUS]?.label ?? t.status}</em>
									{#if t.ore != null}<small>{t.ore >= SLA_HOURS ? '⚠️ ' : ''}aspetta da {t.ore < 1 ? 'meno di un’ora' : t.ore < 48 ? `${t.ore} ore` : `${Math.round(t.ore / 24)} giorni`}</small>{/if}
								</span>
							</a>
						</li>
					{/each}
				</ul>
			{/if}
			{#if data.assistenza.aziendeNuove}<a class="hm-piede" href="/dashboard/aziende/richieste">🏢 {data.assistenza.aziendeNuove} {data.assistenza.aziendeNuove === 1 ? 'nuova richiesta azienda da leggere' : 'nuove richieste aziende da leggere'} →</a>{/if}
		</section>

		<!-- Margini -->
		<section class="dcard hm-margini">
			<div class="hm-card__testa">
				<div><h3>Margini</h3><p class="hm-nota">Materiale, corriere e pubblicità tolti dal fatturato: il rating del mese dall'Analisi margini.</p></div>
				<a class="btn btn--sm btn--ghost" href="/dashboard/analisi-margini">Analisi margini →</a>
			</div>
			{#if !data.margini || !g}
				<div class="hm-vuoto">Ancora nessun rating salvato: lo calcola il sito ogni lunedì, o subito da "Aggiorna adesso" nell'Analisi margini.</div>
			{:else}
				{@const m = data.margini}
				<div class="hm-mg">
					<div class="hm-mg__lettera" style="background:{g.sfondo};color:{g.colore}">
						<b>{m.lettera}</b>
						<span>{g.giudizio}</span>
						<small>{Math.round(m.punteggio)}/100</small>
					</div>
					<div class="hm-mg__num">
						<div class="hm-mg__mese"><span style="text-transform:capitalize">{meseLungo(m.mese)}</span> · {m.definitivo ? 'definitivo' : `provvisorio, dati fino al ${dmy(m.datiFinoAl)}`}</div>
						<div class="hm-mg__griglia">
							<div><small>Fatturato</small><b>{money(m.fatturato)}</b><span>{m.ordini} ordini</span></div>
							<div><small>Costo produzione</small><b>{money(m.costoProduzione)}</b><span>materiale e corriere</span></div>
							<div><small>Pubblicità</small><b>{m.ads == null ? '—' : money(m.ads)}</b><span>{m.ads == null ? 'non leggibile' : m.roas != null ? `ritorno ${m.roas.toFixed(1)}×` : ''}</span></div>
							<div class="is-main"><small>Margine dopo la pubblicità</small><b>{money(m.margineNetto)}</b><span>{pct(m.margineNettoPct)} del fatturato{#if m.prima?.margineNettoPct != null && m.margineNettoPct != null} · {m.margineNettoPct >= m.prima.margineNettoPct ? '▲' : '▼'} {meseBreve(m.prima.mese)} {pct(m.prima.margineNettoPct)} ({m.prima.lettera}){/if}</span></div>
						</div>
					</div>
				</div>
			{/if}
		</section>
	</div>
</div>
