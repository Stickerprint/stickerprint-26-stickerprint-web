<script lang="ts">
	import '$lib/styles/pages.css';
	import IubendaPolicy from '$lib/components/IubendaPolicy.svelte';
</script>
<svelte:head><title>Cookie policy | Stickerprint</title><meta name="description" content="Quali cookie usa stickerprint.it e come gestire le preferenze." /></svelte:head>
<section class="section container" style="max-width:860px">
	<h1 style="font-size:clamp(30px,4vw,46px)">Cookie policy</h1>
	<p class="lead" style="margin-top:10px">Quali cookie e strumenti usa il sito, e come cambiare le tue scelte in qualsiasi momento.</p>
	<p style="margin-top:14px"><a class="btn btn--ghost iubenda-cs-preferences-link" href="/cookie-policy">Gestisci le preferenze cookie</a></p>
	<div class="card policy" style="padding:28px;margin-top:22px"><IubendaPolicy href="https://www.iubenda.com/privacy-policy/42500812/cookie-policy" title="Cookie Policy" /></div>
</section>
