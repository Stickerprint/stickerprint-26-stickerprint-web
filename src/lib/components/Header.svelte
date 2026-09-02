<script lang="ts">
	import type { User } from '@supabase/supabase-js';
	import { page } from '$app/state';

	let { user }: { user: User | null } = $props();
	let open = $state(false);

	const initials = $derived.by(() => {
		const name: string | undefined = user?.user_metadata?.full_name || user?.email;
		if (!name) return 'SP';
		return name
			.split(/[\s@._-]+/)
			.filter(Boolean)
			.slice(0, 2)
			.map((s: string) => s[0]?.toUpperCase())
			.join('');
	});

	const links = [
		{ href: '/adesivi-personalizzati', label: 'Adesivi', menu: true },
		{ href: '/etichette', label: 'Etichette', menu: true },
		{ href: '/offerte', label: 'Promo' },
		{ href: '/aziende', label: 'Aziende' }
	];

	$effect(() => {
		// chiude il menu mobile a ogni navigazione
		page.url.pathname;
		open = false;
	});
</script>

<header class="header">
	<div class="container header__inner">
		<nav aria-label="Principale">
			<ul class="nav nav--desktop">
				{#each links as l}
					<li>
						<a href={l.href}>
							{l.label}
							{#if l.menu}
								<svg class="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
							{/if}
						</a>
					</li>
				{/each}
			</ul>
		</nav>

		<a class="header__logo" href="/" aria-label="Stickerprint, home">
			<img src="/images/splogo-400.png" alt="Stickerprint" width="400" height="320" />
		</a>

		<div class="header__right">
			{#if user}
				<a class="nav" href="/account" style="text-decoration:none" title="Il tuo account">
					<span class="avatar">{initials}</span>
				</a>
			{:else}
				<a class="nav" href="/login" style="text-decoration:none" title="Accedi">
					<span class="avatar" aria-hidden="true">
						<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 3.6-7 8-7s8 3 8 7" /></svg>
					</span>
					<span class="sr-only">Accedi</span>
				</a>
			{/if}
			<a class="icon-btn" href="/checkout" aria-label="Carrello">
				<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" /><path d="M1 1h4l2.7 13.4a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 2-1.6L23 6H6" /></svg>
			</a>
			<button class="icon-btn burger" aria-label="Menu" aria-expanded={open} onclick={() => (open = !open)}>
				<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
			</button>
		</div>
	</div>
</header>

{#if open}
	<div class="mobile-menu">
		<div class="container">
			{#each links as l}<a href={l.href}>{l.label}</a>{/each}
			<a href="/campioni">Kit campioni</a>
			<a href="/support">Supporto</a>
			{#if user}<a href="/account">Il tuo account</a>{:else}<a href="/login">Accedi</a>{/if}
		</div>
	</div>
{/if}
