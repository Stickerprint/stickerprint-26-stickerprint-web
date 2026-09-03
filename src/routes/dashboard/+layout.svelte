<script lang="ts">
	import '$lib/styles/dashboard.css';
	import { page } from '$app/state';
	import { PRODUCT_ENGINES } from '$lib/pricing/engine';

	let { data, children } = $props();

	const isLogin = $derived(page.url.pathname === '/dashboard/login');
	const path = $derived(page.url.pathname);

	const menu = [
		{ title: 'Produzione', items: [
			{ label: 'Ordini', href: '/dashboard/produzione/ordini' },
			{ label: 'Reparti', href: '/dashboard/produzione/reparti' },
			{ label: 'Spedizioni', href: '/dashboard/produzione/spedizioni' }
		] },
		{ title: 'Fatturazione', items: [
			{ label: 'Preventivi', href: '/dashboard/fatturazione/preventivi' },
			{ label: 'Ordini cliente', href: '/dashboard/fatturazione/ordini-cliente' },
			{ label: 'DDT', href: '/dashboard/fatturazione/ddt' },
			{ label: 'Fatture', href: '/dashboard/fatturazione/fatture' }
		] },
		{ title: 'Marketing', items: [{ label: 'Panoramica', href: '/dashboard/marketing' }] },
		{ title: 'Blog', items: [{ label: 'Articoli', href: '/dashboard/blog' }] },
		{ title: 'Codici sconto', items: [{ label: 'Gestione codici', href: '/dashboard/codici-sconto' }] },
		{ title: 'Preventivatori', items: PRODUCT_ENGINES.map((p) => ({ label: p.name, href: `/dashboard/preventivatori/${p.slug}` })) }
	];
	const active = (href: string) => path === href || path.startsWith(href + '/');
</script>

{#if isLogin}
	{@render children()}
{:else}
	<div class="dash">
		<aside class="dash__side">
			<a class="dash__brand" href="/dashboard">
				<img src="/images/splogo-400.png" alt="Stickerprint" width="120" height="96" />
				<span>Area amministratore</span>
			</a>
			<nav class="dash__nav">
				{#each menu as group (group.title)}
					<div class="dash__group">
						<h4>{group.title}</h4>
						{#each group.items as it (it.href)}
							<a href={it.href} class:is-active={active(it.href)}>{it.label}</a>
						{/each}
					</div>
				{/each}
			</nav>
			<div class="dash__user">
				<span class="avatar">{(data.fullName ?? 'A').split(/\s+/).map((s: string) => s[0]).join('').slice(0, 2).toUpperCase()}</span>
				<span class="dash__user-name">{data.fullName ?? 'Amministratore'}<small>{data.role}</small></span>
				<form method="POST" action="/logout"><button class="link-btn" type="submit">Esci</button></form>
			</div>
		</aside>
		<div class="dash__main">
			<div class="dash__top">
				<a class="link" href="/" target="_blank" rel="noopener">Vai al sito ↗</a>
			</div>
			<div class="dash__content">
				{@render children()}
			</div>
		</div>
	</div>
{/if}
