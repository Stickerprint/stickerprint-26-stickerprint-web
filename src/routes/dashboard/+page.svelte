<script lang="ts">
	let { data } = $props();
	const areas = [
		{ title: 'Produzione', desc: 'Ordini in lavorazione, prove di stampa, schede di lavorazione.', href: '/dashboard#produzione', soon: true },
		{ title: 'Fatturazione', desc: 'Fatture elettroniche, progressivo, export per il commercialista.', href: '/dashboard#fatturazione', soon: true },
		{ title: 'Marketing', desc: 'Promozioni, codici sconto, newsletter, recensioni.', href: '/dashboard#marketing', soon: true },
		{ title: 'Preventivatore', desc: 'Motore di calcolo dei prezzi: listini, moltiplicatori, fasce di quantità.', href: '/dashboard#preventivatore', soon: true }
	];
</script>

<svelte:head><title>Dashboard | Stickerprint</title><meta name="robots" content="noindex" /></svelte:head>

<section class="container account">
	<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:16px;flex-wrap:wrap">
		<div>
			<span class="tag tag--yellow">Area amministratore</span>
			<h1 style="margin-top:12px;font-size:clamp(32px,4vw,52px)">Ciao {data.fullName?.split(' ')[0] ?? 'amministratore'}.</h1>
			<p class="lead" style="margin-top:10px">Produzione, fatturazione, marketing: tutto in un unico posto. Le sezioni si riempiono nei prossimi step.</p>
		</div>
		<form method="POST" action="/logout"><button class="btn btn--ghost btn--sm" type="submit">Esci</button></form>
	</div>

	<div class="account__cards" style="grid-template-columns:repeat(2,1fr)">
		{#each areas as a (a.title)}
			<a class="account__card" href={a.href} style="text-decoration:none;color:inherit">
				<b style="font-size:24px">{a.title}</b>
				<p style="margin-top:6px;color:var(--ink-soft);font-size:14.5px">{a.desc}</p>
				{#if a.soon}<span class="tag tag--blue" style="margin-top:12px">In arrivo</span>{/if}
			</a>
		{/each}
	</div>
</section>
