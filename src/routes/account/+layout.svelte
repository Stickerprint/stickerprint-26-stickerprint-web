<script lang="ts">
	import '$lib/styles/account.css';
	import { page } from '$app/state';
	let { data, children } = $props();
	const path = $derived(page.url.pathname);
	const initials = $derived((data.profile.name || 'SP').split(/[\s@._-]+/).filter(Boolean).slice(0, 2).map((s: string) => s[0]?.toUpperCase()).join(''));
	const items = $derived([
		{ href: '/account', label: 'Panoramica', icon: 'M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z', exact: true },
		{ href: '/account/ordini', label: 'I miei ordini', icon: 'M21 8l-9-5-9 5v8l9 5 9-5zM3 8l9 5 9-5M12 13v8', count: data.counts.open },
		{ href: '/account/credito', label: 'Credito Stickerprint', icon: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 5v10m-3-3h4.5a1.5 1.5 0 0 0 0-3h-3a1.5 1.5 0 0 1 0-3H15' },
		{ href: '/account/fatture', label: 'Fatture', icon: 'M6 2h9l5 5v15H6zM14 2v6h6M9 13h6M9 17h6' },
		{ href: '/account/dati', label: 'Dati e indirizzi', icon: 'M12 21s7-6 7-11a7 7 0 1 0-14 0c0 5 7 11 7 11zm0-9a2 2 0 1 0 0-4 2 2 0 0 0 0 4z' },
		{ href: '/account/pagamenti', label: 'Pagamenti', icon: 'M3 6h18v12H3zM3 10h18M7 15h3' },
		{ href: '/account/recensioni', label: 'Recensioni', icon: 'M12 3l2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3 6.4 20.2l1.1-6.2L3 9.6l6.2-.9z', count: data.counts.toReview }
	]);
	const active = (it: { href: string; exact?: boolean }) => (it.exact ? path === it.href : path.startsWith(it.href));
</script>

<div class="acc">
	<aside class="acc__side">
		<div class="acc__who">
			<span class="avatar" style="width:44px;height:44px;font-size:15px">{initials}</span>
			<div><b>{data.profile.name}</b><small>Cliente dal {data.profile.since}</small></div>
		</div>
		<nav class="acc__nav" aria-label="Area personale">
			{#each items as it (it.href)}
				<a href={it.href} class:is-active={active(it)}>
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round" aria-hidden="true"><path d={it.icon} /></svg>
					{it.label}
					{#if it.count}<span class="cnt">{it.count}</span>{/if}
				</a>
			{/each}
		</nav>
		<form method="POST" action="/logout"><button class="link-btn" type="submit">Esci dall’account</button></form>
	</aside>
	<main class="acc__main">
		<div class="acc__inner">{@render children()}</div>
	</main>
</div>
