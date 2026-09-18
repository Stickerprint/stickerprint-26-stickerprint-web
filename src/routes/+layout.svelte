<script lang="ts">
	import '@fontsource/montserrat/latin-400.css';
	import '@fontsource/montserrat/latin-500.css';
	import '@fontsource/montserrat/latin-700.css';
	import '@fontsource/rubik/latin-800.css';
	import '../app.css';
	import { SITE_NAME, canonicalUrl, isPrivatePath } from '$lib/seo';
	import { afterNavigate, invalidate } from '$app/navigation';
	import { page } from '$app/state';
	import { onMount } from 'svelte';
	import { GTM_BODY, GTM_HEAD, track, trackingOn } from '$lib/tracking';
	import Header from '$lib/components/Header.svelte';
	import Footer from '$lib/components/Footer.svelte';

	let { data, children } = $props();
	let { session, supabase, user } = $derived(data);

	// l'area amministratore ha la sua interfaccia: niente header e footer del sito
	const isDashboard = $derived((page.url.pathname.startsWith('/dashboard') && page.url.pathname !== '/dashboard/login') || page.url.pathname.startsWith('/studio'));

	/* tracciamento (GTM-PXKJS5J6 + Klaviyo): acceso solo su stickerprint.it con PUBLIC_TRACKING=on */
	const tracking = $derived(trackingOn(page.url.hostname));
	/* SEO comune a tutte le pagine: canonical assoluto sul dominio definitivo; noindex sui domini di test e sulle pagine private */
	const noindex = $derived(!data.indexable || isPrivatePath(page.url.pathname));
	const canonical = $derived(canonicalUrl(page.url.pathname));
	afterNavigate(() => { if (!isDashboard) track.pageView(user?.id); });
	onMount(() => {
		// Quando Supabase cambia sessione nel browser (login, logout, refresh token)
		// ricarichiamo i dati di layout così header e pagine si aggiornano.
		const { data: sub } = supabase.auth.onAuthStateChange((event, newSession) => {
			if (event === 'SIGNED_IN' && newSession?.user && newSession.user.id !== session?.user?.id) track.login(newSession.user.id);
			if (newSession?.expires_at !== session?.expires_at) {
				invalidate('supabase:auth');
			}
		});
		return () => sub.subscription.unsubscribe();
	});
</script>

<svelte:head>
	{#if noindex}<meta name="robots" content="noindex, nofollow" />{:else}<link rel="canonical" href={canonical} /><meta name="robots" content="index, follow, max-image-preview:large" />{/if}
	<meta property="og:site_name" content={SITE_NAME} />
	{#if tracking && !isDashboard}{@html GTM_HEAD}{/if}
</svelte:head>

<div class="app">
	{#if tracking && !isDashboard}{@html GTM_BODY}{/if}
	{#if !isDashboard}<Header {user} avatar={data.avatar} />{/if}
	<main>
		{@render children()}
	</main>
	{#if !isDashboard}<Footer locale={data.locale} />{/if}
</div>

<style>
	.app {
		min-height: 100vh;
		display: flex;
		flex-direction: column;
	}
	main {
		flex: 1;
	}
</style>
