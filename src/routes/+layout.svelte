<script lang="ts">
	import '../app.css';
	import { afterNavigate, invalidate } from '$app/navigation';
	import { page } from '$app/state';
	import { onMount } from 'svelte';
	import { GTM_BODY, GTM_HEAD, track, trackingOn } from '$lib/tracking';
	import Header from '$lib/components/Header.svelte';
	import Footer from '$lib/components/Footer.svelte';

	let { data, children } = $props();
	let { session, supabase, user } = $derived(data);

	// l'area amministratore ha la sua interfaccia: niente header e footer del sito
	const isDashboard = $derived(page.url.pathname.startsWith('/dashboard') && page.url.pathname !== '/dashboard/login');

	/* tracciamento (GTM-PXKJS5J6 + Klaviyo): acceso solo su stickerprint.it con PUBLIC_TRACKING=on */
	const tracking = $derived(trackingOn(page.url.hostname));
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

<svelte:head>{#if tracking && !isDashboard}{@html GTM_HEAD}{/if}</svelte:head>

<div class="app">
	{#if tracking && !isDashboard}{@html GTM_BODY}{/if}
	{#if !isDashboard}<Header {user} />{/if}
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
