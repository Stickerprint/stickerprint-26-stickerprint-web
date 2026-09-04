<script lang="ts">
	import { PRODUCT_ENGINES } from '$lib/pricing/engine';
	let { data } = $props();
	const areas = [
		{ title: 'Produzione', desc: 'Ordini in lavorazione, reparti, spedizioni.', href: '/dashboard/fatturazione/ordini', soon: true },
		{ title: 'Fatturazione', desc: 'Preventivi, ordini cliente, DDT e fatture.', href: '/dashboard/fatturazione/preventivi', soon: true },
		{ title: 'Marketing', desc: 'Campagne, newsletter, recensioni.', href: '/dashboard/marketing', soon: true },
		{ title: 'Blog', desc: 'Articoli e novità del laboratorio.', href: '/dashboard/blog', soon: true },
		{ title: 'Codici sconto', desc: 'Crea, attiva e spegni i codici promozionali.', href: '/dashboard/codici-sconto' },
		{ title: 'Preventivatori', desc: `Listini e motori di calcolo di ${PRODUCT_ENGINES.length} prodotti, modificabili in qualsiasi momento.`, href: '/dashboard/preventivatori' }
	];
</script>

<svelte:head><title>Dashboard | Stickerprint</title><meta name="robots" content="noindex" /></svelte:head>

<div>
	<h1>Ciao {data.fullName?.split(' ')[0] ?? 'amministratore'}.</h1>
	<p class="lead">Produzione, fatturazione, marketing: tutto in un unico posto.</p>
</div>
<div class="dgrid">
	{#each areas as a (a.title)}
		<a class="dcard" href={a.href}>
			<h3>{a.title}</h3>
			<p style="font-size:14px;color:var(--ink-soft)">{a.desc}</p>
			{#if a.soon}<span class="pill pill--soon" style="margin-top:12px">In arrivo</span>{:else}<span class="pill pill--on" style="margin-top:12px">Attivo</span>{/if}
		</a>
	{/each}
</div>
