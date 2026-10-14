<script lang="ts">
	/**
	 * Aggiunte al carrello del sito: oggi, ieri, 7 e 30 giorni, con i prodotti piu' aggiunti e le ultime aggiunte.
	 * I dati vengono dalla tabella carrello_eventi, scritta dal sito a ogni "Aggiungi al carrello" (non da Google Analytics).
	 */
	import Stat from './Stat.svelte';
	import { num, euro, segno } from '$lib/marketing/formato';
	import { PERIODI_CARRELLO, type PeriodoCarrello, type StatoCarrello } from '$lib/server/carrello';
	let { dati }: { dati: StatoCarrello } = $props();
	let periodo = $state<PeriodoCarrello>('oggi');
	const r = $derived(dati.stato === 'dati' ? dati.riassunti[periodo] : null);
	const delta = (a: number, b: number) => (b > 0 ? segno(((a - b) / b) * 100) : '');
	const PROD: Record<string, string> = { adesivi_personalizzati: 'Adesivi personalizzati', adesivi_resinati: 'Adesivi resinati', adesivi_rilievo: 'Adesivi in rilievo', etichette: 'Etichette', fogli_adesivi: 'Fogli di adesivi', vetrofanie: 'Vetrofanie', kit: 'Kit di adesivi', campioni: 'Campioni' };
	const DISP: Record<string, string> = { mobile: '📱 Telefono', desktop: '💻 Computer', tablet: '📱 Tablet', sconosciuto: 'Non noto' };
	const maxProd = $derived(Math.max(1, ...(r?.prodotti.map((p) => p.aggiunte) ?? [1])));
	const maxGiorno = $derived(Math.max(1, ...(r?.giorni.map((g) => g.aggiunte) ?? [1])));
	const quando = (iso: string) => { const d = new Date(iso); const g = d.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', timeZone: 'Europe/Rome' }); return `${g} ${d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Rome' })}`; };
	const misura = (e: { larghezza_mm: number | null; altezza_mm: number | null }) => (e.larghezza_mm && e.altezza_mm ? `${e.larghezza_mm}×${e.altezza_mm} mm` : '');
	const etichettaPeriodo = $derived(PERIODI_CARRELLO.find((p) => p.id === periodo)?.label.toLowerCase() ?? '');
</script>

<div class="dcard mk-carrello">
	<div class="mk-carrello__testa">
		<div><h3>🛒 Aggiunte al carrello</h3><p class="mk-nota">Ogni "Aggiungi al carrello" sul sito, contato dal sito stesso (non da Google Analytics): niente perdite da cookie o ad-blocker.</p></div>
		<div class="mk-periodo">{#each PERIODI_CARRELLO as p (p.id)}<button type="button" class:is-active={periodo === p.id} onclick={() => (periodo = p.id)} disabled={dati.stato !== 'dati'}>{p.label}</button>{/each}</div>
	</div>
	{#if dati.stato === 'errore'}
		<div class="mk-err">Le aggiunte al carrello non si leggono: {dati.errore}{#if /carrello_eventi/.test(dati.errore)} · manca la tabella: va applicata la migrazione supabase/migrations/0056_carrello_eventi.sql{/if}</div>
	{:else if dati.stato === 'vuoto'}
		<div class="mk-manca"><b>Ancora nessuna aggiunta registrata</b><p>Il sito le salva da quando questa versione è online: la prima volta che un cliente aggiunge qualcosa al carrello compare qui.</p></div>
	{:else if r}
		<div class="mk-stats mk-stats--4">
			<Stat icona="➕" tono="blue" etichetta="Aggiunte" valore={num(r.aggiunte)} delta={delta(r.aggiunte, r.prima.aggiunte)} nota={r.prima.aggiunte === 0 && periodo !== 'oggi' ? 'niente nel periodo prima' : ''} />
			<Stat icona="👤" tono="purple" etichetta="Visitatori diversi" valore={num(r.visitatori)} delta={delta(r.visitatori, r.prima.visitatori)} nota={r.aggiunte ? `${(r.aggiunte / Math.max(1, r.visitatori)).toFixed(1)} aggiunte a testa` : ''} />
			<Stat icona="💶" tono="green" etichetta="Valore messo nel carrello" valore={euro(r.valore, 2)} delta={delta(r.valore, r.prima.valore)} nota="IVA inclusa" />
			<Stat icona="📦" tono="orange" etichetta="Pezzi" valore={num(r.pezzi)} nota={r.aggiunte ? `${Math.round(r.pezzi / r.aggiunte)} a riga` : ''} />
		</div>
		{#if r.giorni.length > 1}
			<div class="mk-carrello__giorni">
				<div class="mk-bars" style="height:90px">
					{#each r.giorni as g, i (g.giorno)}
						<div class="mk-bar" title="{g.giorno.split('-').reverse().join('/')}: {g.aggiunte} aggiunte · {euro(g.valore, 2)}">
							{#if g.aggiunte}<b>{g.aggiunte}</b>{/if}
							<i style="height:{Math.round((g.aggiunte / maxGiorno) * 100)}%"></i>
							<span>{r.giorni.length > 10 ? (i % 5 === 0 ? g.giorno.slice(8) : '') : g.giorno.slice(8)}</span>
						</div>
					{/each}
				</div>
			</div>
		{/if}
		<div class="mk-grid2">
			<div>
				<h4 class="mk-h4">Prodotti più aggiunti · {etichettaPeriodo}</h4>
				{#if !r.prodotti.length}<p class="mk-nota">Nessuna aggiunta {etichettaPeriodo}.</p>{/if}
				<div class="mk-lista">
					{#each r.prodotti as p (p.prodotto)}
						<div class="mk-riga mk-riga--barra">
							<span><b>{PROD[p.prodotto] ?? p.nome}</b><small>{euro(p.valore, 2)} nel carrello</small><i class="mk-prog"><i style="width:{Math.round((p.aggiunte / maxProd) * 100)}%"></i></i></span>
							<b>{p.aggiunte}</b>
						</div>
					{/each}
				</div>
				{#if r.dispositivi.length}<p class="mk-nota" style="margin-top:8px">{r.dispositivi.map((d) => `${DISP[d.nome] ?? d.nome} ${Math.round((d.aggiunte / Math.max(1, r.aggiunte)) * 100)}%`).join(' · ')}</p>{/if}
			</div>
			<div>
				<h4 class="mk-h4">Ultime aggiunte</h4>
				<div class="mk-lista">
					{#each dati.ultime as e (e.id)}
						<div class="mk-riga">
							<span><b>{PROD[e.prodotto] ?? e.nome}</b><small>{[misura(e), e.materiale, e.qta ? `${num(e.qta)} pz` : '', e.sorgente !== 'configuratore' ? e.sorgente : '', DISP[e.dispositivo ?? ''] ?? ''].filter(Boolean).join(' · ')}</small></span>
							<span style="text-align:right"><b>{euro(e.lordo, 2)}</b><small>{quando(e.creato_il)}</small></span>
						</div>
					{/each}
				</div>
			</div>
		</div>
		<p class="mk-nota">Dal {r.da.split('-').reverse().join('/')}{#if r.a !== r.da} al {r.a.split('-').reverse().join('/')}{/if} · {num(dati.totaleStorico)} aggiunte registrate in tutto. Il confronto è con il periodo di pari lunghezza subito prima.</p>
	{/if}
</div>
