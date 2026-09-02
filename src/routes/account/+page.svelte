<script lang="ts">
	let { data } = $props();
	const name = $derived(data.user?.user_metadata?.full_name ?? data.user?.email ?? '');
</script>

<svelte:head><title>Il tuo account | Stickerprint</title></svelte:head>

<section class="container account">
	<div>
		<span class="tag tag--green">Area clienti</span>
		<h1 style="margin-top:12px;font-size:clamp(32px,4vw,52px)">Ciao {name.split(' ')[0]}.</h1>
		<p class="lead" style="margin-top:10px">Questa è la bozza della tua dashboard: qui arriveranno ordini, prove di stampa, fatture e Credito Stickerprint.</p>
	</div>

	<div class="account__cards">
		<div class="account__card"><span class="note">Ordini</span><b>{data.ordersCount}</b><span class="note">nel tuo storico</span></div>
		<div class="account__card"><span class="note">Credito Stickerprint</span><b>0,00 €</b><span class="note">5% su ogni ordine pagato</span></div>
		<div class="account__card"><span class="note">Prove di stampa</span><b>0</b><span class="note">in attesa di approvazione</span></div>
	</div>

	<div style="display:flex;gap:12px;flex-wrap:wrap">
		<a class="btn btn--blue" href="/adesivi-personalizzati">Nuovo ordine</a>
		<a class="btn btn--ghost" href="/account/password">Cambia password</a>
		<form method="POST" action="/logout"><button class="btn btn--ghost" type="submit">Esci</button></form>
	</div>
</section>
