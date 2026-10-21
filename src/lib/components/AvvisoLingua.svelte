<script lang="ts">
	/**
	 * Striscia discreta "Questo sito è disponibile in tedesco": compare quando paese o browser suggeriscono una lingua
	 * diversa da quella della pagina (e quella lingua e' online). Dal 21/10 sera la prima visita dall'estero viene gia' rimandata alla lingua del paese (hooks.server.ts): la striscia resta per chi ha scelto esplicitamente o per i casi dubbi. "Resta qui" scrive il cookie della lingua attuale.
	 */
	import { onMount } from 'svelte';
	import { localizePath, type LocaleCode } from '$lib/i18n';
	import { NOME_LINGUA, t } from '$lib/traduzioni';
	import { page } from '$app/state';
	let { attuale, suggerita }: { attuale: LocaleCode; suggerita: LocaleCode } = $props();
	let visibile = $state(false);
	const CHIAVE = 'sp-avviso-lingua';
	onMount(() => { try { visibile = suggerita !== attuale && localStorage.getItem(CHIAVE) !== '1'; } catch { visibile = suggerita !== attuale; } });
	const chiudi = () => { visibile = false; try { localStorage.setItem(CHIAVE, '1'); } catch { /* niente */ } };
	/* testi nella lingua SUGGERITA: chi legge non capisce quella della pagina */
	const nome = $derived(NOME_LINGUA[suggerita]);
	const href = $derived(`/set-locale/${suggerita}?torna=${encodeURIComponent(localizePath(page.url.pathname, suggerita))}`);
</script>

{#if visibile}
	<div class="avviso-lingua" role="status">
		<span>{t(suggerita, 'avvisoLingua.testo', { lingua: nome })}</span>
		<a class="btn btn--yellow btn--xs" href={href} data-sveltekit-reload onclick={chiudi}>{t(suggerita, 'avvisoLingua.vai', { lingua: nome })}</a>
		<!-- "Resta qui" e' una scelta esplicita: cookie della lingua attuale via /set-locale, altrimenti dal paese estero si verrebbe rimandati di nuovo -->
		<a class="avviso-lingua__chiudi" href={`/set-locale/${attuale}?torna=${encodeURIComponent(page.url.pathname)}`} data-sveltekit-reload onclick={chiudi}>{t(suggerita, 'avvisoLingua.resta')} ✕</a>
	</div>
	<!-- la scelta esplicita passa da /set-locale, cosi' resta anche sui link senza prefisso -->
{/if}

<style>
	.avviso-lingua { display: flex; gap: 12px; align-items: center; justify-content: center; flex-wrap: wrap; padding: 10px 16px; background: var(--navy); color: #fff; font-size: 14px; font-weight: 600; }
	.avviso-lingua__chiudi { background: none; border: 0; color: #d9dcf2; font: inherit; font-size: 13px; cursor: pointer; text-decoration: underline; }
	@media (max-width: 700px) { .avviso-lingua { font-size: 13px; gap: 8px; padding: 8px 12px; } }
</style>
