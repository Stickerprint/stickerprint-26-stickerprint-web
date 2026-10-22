<script lang="ts">
	import type { User } from '@supabase/supabase-js';
	import { page } from '$app/state';
	import { logoSrc } from '$lib/logo';
	import { usaLingua } from '$lib/traduzioni';
	const { t, path: L } = usaLingua();

	let { user, avatar = null }: { user: User | null; avatar?: string | null } = $props();
	/* foto profilo illeggibile o rimossa: si mostrano le iniziali invece dell'icona rotta */
	let avatarKo = $state(false);
	$effect(() => { avatar; avatarKo = false; });
	/* logo stagionale (Halloween fino al 31/10): si ricontrolla ogni minuto, così a mezzanotte cambia anche senza ricaricare */
	let logo = $state(logoSrc());
	$effect(() => { const t = setInterval(() => (logo = logoSrc()), 60_000); return () => clearInterval(t); });
	let open = $state(false);
	let cart = $state(0);
	$effect(() => {
		try {
			cart = JSON.parse(localStorage.getItem('sp-cart') ?? '[]').length;
		} catch {
			cart = 0;
		}
		const on = (e: Event) => (cart = (e as CustomEvent<number>).detail ?? 0);
		window.addEventListener('sp-cart', on);
		return () => window.removeEventListener('sp-cart', on);
	});

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
			label: t('header.adesivi'),
			items: [
				{ href: '/adesivi-resinati', label: t('header.resinati'), img: `${I}/res/round_res.webp` },
				{ href: '/adesivi-personalizzati', label: t('header.personalizzati'), img: `${I}/square_stickers.webp` },
				{ href: '/adesivi-rilievo', label: t('header.rilievo'), img: `${I}/oval_stickers.webp` },
				{ href: '/kit-adesivi', label: t('header.kit'), img: `${I}/custom_stickers.webp` },
				{ href: '/vetrofanie', label: t('header.vetrofanie'), img: `${I}/vetr/vetr_round.webp` },
				{ href: '/fogli', label: t('header.fogli'), img: `${I}/sheet/Sticker_sheet_1.webp` }
			]
		},
		{ href: '/etichette', label: t('header.etichette'), items: [{ href: '/etichette', label: t('header.etichetteFogli'), img: `${I}/label/round_label.webp` }] },
		{ href: '/offerte', label: t('header.promo') },
		{ href: '/aziende', label: t('header.aziende') }
	];

	// voce evidenziata (gialla) quando si è in una pagina della sezione
	const sectionActive = (l: (typeof links)[number]) => {
		const path = page.url.pathname.replace(/^\/(es|fr|de|nl|en|us)(?=\/|$)/, '');
		return l.items ? l.items.some((it) => path.startsWith(it.href)) : path.startsWith(l.href);
	};

	$effect(() => {
		// chiude il menu mobile a ogni navigazione
		page.url.pathname;
		open = false;
	});
	$effect(() => {
		// col menu aperto scorre solo il menu, non la pagina sotto
		document.body.style.overflow = open ? 'hidden' : '';
		return () => { document.body.style.overflow = ''; };
	});
</script>

<header class="header">
	<div class="container header__inner">
		<div class="header__left">
		<button class="icon-btn burger" aria-label={open ? t('comune.chiudiMenu') : t('comune.menu')} aria-expanded={open} onclick={() => (open = !open)}>
			{#if open}<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M6 6l12 12M18 6L6 18" /></svg>{:else}<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M4 7h16M4 12h16M4 17h16" /></svg>{/if}
		</button>
		<nav aria-label={t('header.principale')}>
			<ul class="nav nav--desktop">
				{#each links as l (l.label)}
					<li class="nav__item" class:has-menu={l.items}>
						<a href={L(l.href)} class:is-active={sectionActive(l)} aria-haspopup={l.items ? 'true' : undefined}>
							{l.label}
							{#if l.items}
								<svg class="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
							{/if}
						</a>
						{#if l.items}
							<div class="dropdown">
								{#each l.items as it (it.href)}
									<a class="dropdown__item" href={L(it.href)}>
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
		</div>

		<a class="header__logo" href={L('/')} aria-label={t('comune.home')}>
			<img src={logo} alt="Stickerprint" width="400" height="320" />
		</a>

		<div class="header__right">
			{#if user}
				<!-- passando col mouse sull'iniziale (o sulla foto) si apre il menu dell'area personale -->
				<div class="nav__item has-menu header__user">
					<a class="nav" href={L('/account')} style="text-decoration:none" title={t('comune.tuoAccount')} aria-haspopup="true">
						{#if avatar && !avatarKo}<img class="avatar avatar--img" src={avatar} alt="" width="34" height="34" onerror={() => (avatarKo = true)} />{:else}<span class="avatar">{initials}</span>{/if}
					</a>
					<div class="dropdown dropdown--right dropdown--user">
						<a class="dropdown__link" href={L('/account')}>{t('header.panoramica')}</a>
						<a class="dropdown__link" href={L('/account/ordini')}>{t('header.mieiOrdini')}</a>
						<a class="dropdown__link" href={L('/account/credito')}>{t('header.credito')}</a>
						<a class="dropdown__link" href={L('/account/dati')}>{t('header.dati')}</a>
						<a class="dropdown__link" href={L('/account/pagamenti')}>{t('header.pagamenti')}</a>
						<a class="dropdown__link" href={L('/account/recensioni')}>{t('header.recensioni')}</a>
						<form method="POST" action="/logout"><button class="dropdown__link dropdown__link--out" type="submit">{t('comune.esci')}</button></form>
					</div>
				</div>
			{:else}
				<div class="header__auth">
					<a class="btn btn--blue btn--sm" href={L('/login')}>{t('comune.accedi')}</a>
					<a class="btn btn--yellow btn--sm" href={L('/signup')}>{t('comune.registrati')}</a>
				</div>
				<a class="nav header__auth-icon" href={L('/login')} style="text-decoration:none" title={t('comune.accedi')}>
					<span class="avatar" aria-hidden="true">
						<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 3.6-7 8-7s8 3 8 7" /></svg>
					</span>
					<span class="sr-only">{t('comune.accedi')}</span>
				</a>
			{/if}
			<a class="icon-btn" href={L('/checkout')} aria-label="{t('comune.carrello')}{cart ? `, ${cart} ${t('comune.articoli')}` : ''}">
				<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" /><path d="M1 1h4l2.7 13.4a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 2-1.6L23 6H6" /></svg>
				{#if cart}<span class="badge">{cart}</span>{/if}
			</a>
		</div>
	</div>
</header>

{#if open}
	<div class="mobile-menu" role="dialog" aria-label={t('comune.menu')}>
		<!-- barra propria: logo e X, cosi' il menu copre tutto lo schermo e si chiude da qui -->
		<div class="mobile-menu__bar container">
			<a href={L('/')} aria-label={t('comune.home')}><img src={logo} alt="Stickerprint" width="400" height="320" /></a>
			<button type="button" class="mobile-menu__close" aria-label={t('comune.chiudiMenu')} onclick={() => (open = false)}>
				<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M6 6l12 12M18 6L6 18" /></svg>
			</button>
		</div>
		<div class="container">
			{#each links as l (l.label)}
				{#if l.items}
					<p class="mobile-menu__group">{l.label}</p>
					{#each l.items as it (it.href)}<a class="mobile-menu__sub" href={L(it.href)}><img src={it.img} alt="" width="36" height="36" />{it.label}</a>{/each}
				{:else}
					<a href={L(l.href)}>{l.label}</a>
				{/if}
			{/each}
			<a href={L('/campioni')}>{t('header.kitCampioni')}</a>
			<a href={L('/support')}>{t('header.supporto')}</a>
			{#if user}<a href={L('/account')}>{t('comune.tuoAccount')}</a>{:else}<a href={L('/login')}>{t('comune.accedi')}</a>{/if}
		</div>
	</div>
{/if}

<style>
	.nav__item { position: relative; }
	.dropdown {
		position: absolute; top: 100%; left: -14px; margin-top: 14px; min-width: 290px;
		background: var(--navy); color: #fff; border-radius: 18px; padding: 14px 16px;
		box-shadow: 0 18px 40px rgba(10, 14, 60, 0.35); display: grid; gap: 4px; z-index: 40;
		opacity: 0; visibility: hidden; transform: translateY(6px); transition: opacity .18s ease, transform .18s ease, visibility .18s;
	}
	/* zona invisibile tra voce e pannello, così il mouse non "cade" fuori */
	.dropdown::before { content: ''; position: absolute; left: 0; right: 0; top: -16px; height: 16px; }
	.has-menu:hover .dropdown, .has-menu:focus-within .dropdown { opacity: 1; visibility: visible; transform: translateY(0); }
	.dropdown__item {
		display: flex; align-items: center; gap: 16px; padding: 12px 14px; border-radius: 12px;
		font-family: var(--font-display); font-weight: 800; font-size: 15px; color: #4b5563; text-decoration: none; white-space: nowrap;
	}
	.dropdown__item { color: #fff; }
	.dropdown__item:hover { background: rgba(255,255,255,.08); color: #fff; }
	.dropdown__item:hover span { text-decoration: underline; text-decoration-color: var(--yellow); text-decoration-thickness: 3px; text-underline-offset: 5px; }
	.dropdown--right { left: auto; right: 0; }
	.dropdown--user { min-width: 240px; padding: 8px; }
	.dropdown__link { display: block; width: 100%; text-align: left; padding: 10px 12px; border-radius: 8px; color: #fff; text-decoration: none; font-family: var(--font-display); font-weight: 800; font-size: 15px; background: none; border: 0; cursor: pointer; }
	.dropdown__link:hover { background: rgba(255,255,255,.08); text-decoration: underline; text-decoration-color: var(--yellow); text-decoration-thickness: 3px; text-underline-offset: 5px; }
	.dropdown__link--out { color: #ffb3ad; border-top: 1px solid rgba(255,255,255,.15); border-radius: 0; margin-top: 4px; padding-top: 12px; }
	.header__auth { display: flex; gap: 8px; align-items: center; }
	.header__auth .btn--sm { padding: 9px 14px; font-size: 13.5px; }
	.header__auth-icon { display: none; }
	@media (max-width: 900px) { .header__auth { display: none; } .header__auth-icon { display: inline-flex; } .header__user .dropdown { display: none; } }
	.dropdown__item img { width: 52px; height: 52px; object-fit: contain; flex: 0 0 auto; }
	.mobile-menu__group { font-family: var(--font-display); font-weight: 800; font-size: 13px; letter-spacing: .08em; text-transform: uppercase; color: var(--blue); margin: 14px 0 6px; }
	.mobile-menu__sub { display: flex; align-items: center; gap: 12px; }
	.mobile-menu__sub img { width: 36px; height: 36px; object-fit: contain; }
</style>
