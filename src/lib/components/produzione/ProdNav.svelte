<script lang="ts">
	import { page } from '$app/state';
	const path = $derived(page.url.pathname);
	const tabs = [
		{ href: '/dashboard/produzione', label: '📊 Riepilogo', exact: true },
		{ href: '/dashboard/produzione/coda', label: '📋 Coda ordini' },
		{ href: '/dashboard/produzione/reparto/stampa', label: '🏭 Reparti', prefix: '/dashboard/produzione/reparto' },
		{ href: '/dashboard/produzione/macchinari', label: '🛠 Macchinari' },
		{ href: '/dashboard/produzione/tv', label: '📺 Modalità TV' }
	];
	const on = (t: { href: string; exact?: boolean; prefix?: string }) => (t.exact ? path === t.href : path.startsWith(t.prefix ?? t.href));
</script>
<nav class="pv-tabs" aria-label="Produzione">{#each tabs as t (t.href)}<a href={t.href} class:is-active={on(t)} target={t.href.endsWith('/tv') ? '_blank' : undefined}>{t.label}</a>{/each}</nav>
