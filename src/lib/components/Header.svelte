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

	// menù a discesa: icona (sagoma del prodotto) + nome, come sul sito attuale
	const I = '/images/estimator';
	const links: { href: string; label: string; items?: { href: string; label: string; img: string }[] }[] = [
		{
			href: '/adesivi-personalizzati',
			label: 'Adesivi',
			items: [
				{ href: '/adesivi-resinati', label: 'Adesivi Resinati', img: `${I}/res/round_res.webp` },
				{ href: '/adesivi-personalizzati', label: 'Adesivi Personalizzati', img: `${I}/square_stickers.webp` },
				{ href: '/adesivi-rilievo', label: 'Adesivi in Rilievo', img: `${I}/oval_stickers.webp` },
				{ href: '/vetrofanie', label: 'Vetrofanie', img: `${I}/vetr/vetr_round.webp` },
				{ href: '/fogli', label: 'Fogli di Adesivi', img: `${I}/sheet/Sticker_sheet_1.webp` }
			]
		},
		{ href: '/etichette', label: 'Etichette', items: [{ href: '/etichette', label: 'Etichette in Fogli', img: `${I}/label/round_label.webp` }] },
		{ href: '/offerte', label: 'Promo' },
		{ href: '/aziende', label: 'Aziende' }
	];

	// voce evidenziata (gialla) quando si è in una pagina della sezione
	const sectionActive = (l: (typeof links)[number]) => {
		const path = page.url.pathname;
		return l.items ? l.items.some((it) => path.startsWith(it.href)) : path.startsWith(l.href);
	};

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
				{#each links as l (l.label)}
					<li class="nav__item" class:has-menu={l.items}>
						<a href={l.href} class:is-active={sectionActive(l)} aria-haspopup={l.items ? 'true' : undefined}>
							{l.label}
							{#if l.items}
								<svg class="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
							{/if}
						</a>
						{#if l.items}
							<div class="dropdown">
								{#each l.items as it (it.href)}
									<a class="dropdown__item" href={it.href}>
										<img src={it.img} alt="" width="52" height="52" />
										<span>{it.label}</span>
									</a>
								{/each}
							</div>
						{/if}
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
			{#each links as l (l.label)}
				{#if l.items}
					<p class="mobile-menu__group">{l.label}</p>
					{#each l.items as it (it.href)}<a class="mobile-menu__sub" href={it.href}><img src={it.img} alt="" width="36" height="36" />{it.label}</a>{/each}
				{:else}
					<a href={l.href}>{l.label}</a>
				{/if}
			{/each}
			<a href="/campioni">Kit campioni</a>
			<a href="/support">Supporto</a>
			{#if user}<a href="/account">Il tuo account</a>{:else}<a href="/login">Accedi</a>{/if}
		</div>
	</div>
{/if}

<style>
	.nav__item { position: relative; }
	.dropdown {
		position: absolute; top: 100%; left: -14px; margin-top: 14px; min-width: 290px;
		background: #fff; color: var(--ink); border-radius: 18px; padding: 14px 16px;
		box-shadow: 0 18px 40px rgba(10, 14, 60, 0.22); display: grid; gap: 4px; z-index: 40;
		opacity: 0; visibility: hidden; transform: translateY(6px); transition: opacity .18s ease, transform .18s ease, visibility .18s;
	}
	/* zona invisibile tra voce e pannello, così il mouse non "cade" fuori */
	.dropdown::before { content: ''; position: absolute; left: 0; right: 0; top: -16px; height: 16px; }
	.has-menu:hover .dropdown, .has-menu:focus-within .dropdown { opacity: 1; visibility: visible; transform: translateY(0); }
	.dropdown__item {
		display: flex; align-items: center; gap: 16px; padding: 12px 14px; border-radius: 12px;
		font-family: var(--font-display); font-weight: 800; font-size: 15px; color: #4b5563; text-decoration: none; white-space: nowrap;
	}
	.dropdown__item:hover { background: #f3f4f6; color: var(--ink); }
	.dropdown__item img { width: 52px; height: 52px; object-fit: contain; flex: 0 0 auto; }
	.mobile-menu__group { font-family: var(--font-display); font-weight: 800; font-size: 13px; letter-spacing: .08em; text-transform: uppercase; color: var(--blue); margin: 14px 0 6px; }
	.mobile-menu__sub { display: flex; align-items: center; gap: 12px; }
	.mobile-menu__sub img { width: 36px; height: 36px; object-fit: contain; }
</style>
