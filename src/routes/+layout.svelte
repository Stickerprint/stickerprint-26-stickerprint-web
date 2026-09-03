<script lang="ts">
	import '../app.css';
	import { invalidate } from '$app/navigation';
	import { page } from '$app/state';
	import { onMount } from 'svelte';
	import Header from '$lib/components/Header.svelte';
	import Footer from '$lib/components/Footer.svelte';

	let { data, children } = $props();
	let { session, supabase, user } = $derived(data);

	// l'area amministratore ha la sua interfaccia: niente header e footer del sito
	const isDashboard = $derived(page.url.pathname.startsWith('/dashboard') && page.url.pathname !== '/dashboard/login');

	onMount(() => {
		// Quando Supabase cambia sessione nel browser (login, logout, refresh token)
		// ricarichiamo i dati di layout così header e pagine si aggiornano.
		const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
			if (newSession?.expires_at !== session?.expires_at) {
				invalidate('supabase:auth');
			}
		});
		return () => sub.subscription.unsubscribe();
	});
</script>

<div class="app">
	{#if !isDashboard}<Header {user} />{/if}
	<main>
		{@render children()}
	</main>
	{#if !isDashboard}<Footer />{/if}
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
