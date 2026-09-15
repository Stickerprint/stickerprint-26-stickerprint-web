<script lang="ts">
	import '$lib/styles/quote.css';
	import { enhance } from '$app/forms';
	import Stars from '$lib/components/Stars.svelte';
	import { money } from '$lib/dashboard/orders';
	let { data, form } = $props();
	const q = $derived(data.q);
	const first = $derived(data.customer.first_name?.trim() || data.customer.name);
	const it = (d: string | null) => (d ? new Date(d + 'T12:00:00').toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' }) : '');
	const daysLeft = $derived(q.valid_until ? Math.ceil((new Date(q.valid_until + 'T23:59:59').getTime() - Date.now()) / 864e5) : null);
	const done = $derived(q.status === 'accettato' || q.status === 'ordinato' || form?.accepted);
	const dead = $derived(!done && (q.status === 'rifiutato' || q.status === 'scaduto' || form?.rejected));
	const open = $derived(!done && !dead && q.status === 'inviato');
	let asking = $state(false);
	let rejecting = $state(false);
	let sending = $state(false);
	const initials = $derived((q.sender_name ?? 'SP').split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase());
	const when = (d: string) => new Date(d).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
	const submit = () => { sending = true; return async ({ update }: { update: (o?: { reset?: boolean }) => Promise<void> }) => { await update({ reset: false }); sending = false; asking = false; rejecting = false; }; };
</script>

<svelte:head><title>Preventivo {q.number} | Stickerprint</title><meta name="robots" content="noindex" /></svelte:head>

<section class="qp">
	{#if data.staffPreview}<p style="max-width:820px;margin:0 auto 12px;padding:10px 14px;border-radius:10px;background:#fef6db;color:#8a5a00;font-size:13px">Anteprima: così la vedrà il cliente dopo "Invia preventivo". Qui bottoni e PDF non sono attivi.</p>{/if}
	<div class="qp__wrap">
		<header class="qp__head">
			<p class="qp__kicker">Preventivo {q.number}{#if q.version > 1} · rev. {q.version}{/if} · {it(q.created_at.slice(0, 10))}</p>
			{#if done}
				<h1>Grazie {first}, è tutto <span class="hl">confermato</span> ✅</h1>
				<p class="qp__lead">La commessa è in lavorazione. Il prossimo passo: ti mandiamo la conferma d'ordine con i dettagli, e si parte. Per qualsiasi cosa scrivici qui sotto o rispondi all'email.</p>
			{:else if dead}
				<h1>{q.status === 'rifiutato' || form?.rejected ? 'Preventivo chiuso' : 'Preventivo scaduto'}</h1>
				<p class="qp__lead">Questa proposta non è più attiva. Se ti serve ancora, chiedici un aggiornamento: te lo rifacciamo con prezzi e tempi di oggi.</p>
			{:else}
				<h1>Ciao {first}, ecco il preventivo per <span class="hl">{data.customer.name}</span></h1>
				<p class="qp__lead">Guarda cosa ricevi, controlla il totale e conferma con un clic: la commessa entra subito in lavorazione. {#if daysLeft !== null}<b class="qp__valid" class:is-soon={daysLeft <= 5}>{daysLeft > 0 ? `Valido ancora ${daysLeft} ${daysLeft === 1 ? 'giorno' : 'giorni'}` : 'Scade oggi'}</b> (fino al {it(q.valid_until)}).{/if}</p>
			{/if}
			{#if form?.error}<p class="error">{form.error}</p>{/if}
			{#if form?.message && !form?.accepted}<p class="ok">{form.message}</p>{/if}
		</header>

		<h2 class="qp__h2">Cosa ricevi</h2>
		<div class="qp__items">
			{#each data.items as i, k (k)}
				<article class="qp__item">
					<div class="qp__img" class:is-mockup={i.isMockup}>{#if i.image}<img src={i.image} alt="" loading="lazy" />{/if}</div>
					<div class="qp__item-body">
						<span class="qp__cat">{i.category}</span>
						<h3>{i.description}</h3>
						<div class="qp__meta">{i.qty.toLocaleString('it-IT')} pezzi{#if i.lamination && i.lamination !== 'nessuna'} · lamina {i.lamination}{/if}{#if i.code} · cod. {i.code}{/if}</div>
						<div class="qp__price"><span>{money(i.price)} <small>cad.{data.lordi ? ' IVA incl.' : ''}</small></span><b>{money(i.total)}</b></div>
					</div>
				</article>
			{/each}
		</div>

		<div class="qp__two">
			<div class="qp__sum">
				<h2 class="qp__h2">Riepilogo</h2>
				<div class="qp__row"><span>Imponibile</span><b>{money(q.total_net)}</b></div>
				<div class="qp__row"><span>IVA 22%</span><b>{money(q.total_gross - q.total_net)}</b></div>
				<div class="qp__row qp__row--tot"><span>Totale</span><b>{money(q.total_gross)}</b></div>
				<ul class="qp__terms">
					{#if data.leadTime}<li>⏱ {data.leadTime}{#if data.shipDate} · spedizione prevista {it(data.shipDate)}{/if}.</li>{:else if data.shipDate}<li>⏱ Spedizione prevista {it(data.shipDate)}.</li>{/if}
					<li>🚚 {data.shipMethod === 'Consegna diretta Stickerprint' ? 'Consegna diretta' : data.shipMethod?.includes('destinatario') ? 'Ritiro con il tuo corriere' : 'Spedizione con corriere espresso, tracking via email'}.</li>
					{#if data.terms.length}<li>💳 Pagamento: {data.terms.join(' + ')}.</li>{/if}
				</ul>
			</div>
			<aside class="qp__why">
				<div class="qp__person"><span class="qp__avatar">{initials}</span><div><b>{q.sender_name ?? 'Il team Stickerprint'}</b><br /><span>ti seguo io: per qualsiasi dubbio scrivimi qui sotto o rispondi all'email.</span></div></div>
				<ul class="qp__perks">
					<li>🇮🇹 Stampato in Italia, nel nostro laboratorio</li>
					<li>🖨️ Materiali premium e taglio di precisione</li>
					<li>📦 Spedizione gratuita da 50 €</li>
				</ul>
				{#if data.stats}<div class="qp__stars"><Stars value={data.stats.average ?? 4.9} count={data.stats.total ?? null} size={18} countLabel="recensioni verificate" /></div>{/if}
			</aside>
		</div>

		<div class="qp__cta" id="conferma">
			{#if open}
				<form method="POST" action="?/accetta" use:enhance={submit} class="qp__accept">
					<input name="nome" placeholder="Nome e cognome di chi conferma" required />
					<button class="btn btn--green btn--lg" type="submit" disabled={sending}>✓ Confermo il preventivo</button>
				</form>
				<div class="qp__more">
					<a class="btn btn--ghost" href="/preventivo/{data.q ? '' : ''}{location_token()}/pdf">📄 Scarica il PDF</a>
					<button class="btn btn--ghost" type="button" onclick={() => { asking = !asking; rejecting = false; }}>💬 Ho una domanda</button>
					<button class="link-btn" type="button" onclick={() => { rejecting = !rejecting; asking = false; }}>Non fa per me</button>
				</div>
				<p class="note">Confermando accetti la proposta alle condizioni indicate. Nessun pagamento adesso: ricevi la conferma d'ordine con i dettagli.</p>
			{:else if done}
				<div class="qp__more"><a class="btn btn--ghost" href="/preventivo/{location_token()}/pdf">📄 Scarica il PDF</a><button class="btn btn--ghost" type="button" onclick={() => (asking = !asking)}>💬 Scrivici</button></div>
			{:else}
				<form method="POST" action="?/aggiorna" use:enhance={submit} class="qp__ask">
					<textarea name="testo" rows="2" placeholder="Se qualcosa è cambiato (quantità, misura, materiale) scrivilo qui."></textarea>
					<button class="btn btn--blue" type="submit" disabled={sending}>Chiedi un preventivo aggiornato</button>
				</form>
			{/if}
			{#if asking}
				<form method="POST" action="?/domanda" use:enhance={submit} class="qp__ask">
					<textarea name="testo" rows="3" required placeholder="Scrivi qui: materiali, tempi, quantità diverse, fatturazione…"></textarea>
					<button class="btn btn--blue" type="submit" disabled={sending}>Invia la domanda</button>
				</form>
			{/if}
			{#if rejecting && open}
				<form method="POST" action="?/rifiuta" use:enhance={submit} class="qp__ask">
					<textarea name="motivo" rows="2" placeholder="Se ci dici cosa non torna (prezzo, tempi, materiale) proviamo a sistemarlo."></textarea>
					<button class="btn btn--ghost" type="submit" disabled={sending}>Chiudi il preventivo</button>
				</form>
			{/if}
		</div>

		{#if data.messages.length}
			<div class="qp__thread">
				<h2 class="qp__h2">Conversazione</h2>
				{#each data.messages as m (m.id)}
					<div class="qp__msg qp__msg--{m.direction}"><div class="qp__msg-head"><b>{m.direction === 'in' ? 'Tu' : (m.author ?? 'Stickerprint')}</b><span>{when(m.created_at)}</span></div><p>{m.body}</p></div>
				{/each}
			</div>
		{/if}
	</div>
</section>

<script lang="ts" module>
	// token dalla URL (la pagina non lo espone nei dati per non mostrarlo altrove)
	function location_token() { return typeof location !== 'undefined' ? location.pathname.split('/')[2] : ''; }
</script>
