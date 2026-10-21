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
	import AvvisoLingua from '$lib/components/AvvisoLingua.svelte';
	import { LOCALES, activeLocales, localizePath, stripLocale } from '$lib/i18n';
	import { impostaLingua } from '$lib/traduzioni';

	let { data, children } = $props();
	/* lingua della pagina per tutti i componenti (t, percorsi con prefisso) */
	impostaLingua(data.locale);
	/* hreflang: la stessa pagina nelle lingue online (in anteprima tutte), x-default = italiano */
	const alternates = $derived.by(() => {
		const base = stripLocale(page.url.pathname);
		const codes = data.anteprimaLingue ? (Object.keys(LOCALES) as (keyof typeof LOCALES)[]) : activeLocales();
		return codes.map((c) => ({ hreflang: LOCALES[c].hreflang, href: canonicalUrl(localizePath(base, c)) }));
	});
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
	{#if noindex}<meta name="robots" content="noindex, nofollow" />{:else}<link rel="canonical" href={canonical} />{#if alternates.length > 1}{#each alternates as a (a.hreflang)}<link rel="alternate" hreflang={a.hreflang} href={a.href} />{/each}<link rel="alternate" hreflang="x-default" href={canonicalUrl(stripLocale(page.url.pathname))} />{/if}<meta name="robots" content="index, follow, max-image-preview:large" />{/if}
	<meta property="og:site_name" content={SITE_NAME} />
	{#if tracking && !isDashboard}{@html GTM_HEAD}{/if}
</svelte:head>

<div class="app">
	{#if tracking && !isDashboard}{@html GTM_BODY}{/if}
	{#if !isDashboard}{#if data.localeSuggerito && data.localeSuggerito !== data.locale && (data.anteprimaLingue || activeLocales().includes(data.localeSuggerito))}<AvvisoLingua attuale={data.locale} suggerita={data.localeSuggerito} />{/if}<Header {user} avatar={data.avatar} />{/if}
	<main>
		{@render children()}
	</main>
	{#if !isDashboard}<Footer locale={data.locale} anteprima={data.anteprimaLingue} />{/if}
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
