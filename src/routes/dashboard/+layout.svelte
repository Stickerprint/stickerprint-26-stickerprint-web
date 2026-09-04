<script lang="ts">
	import '$lib/styles/dashboard.css';
	import { page } from '$app/state';
	import { invalidateAll } from '$app/navigation';
	import { PRODUCT_ENGINES } from '$lib/pricing/engine';
	import LiveClock from '$lib/components/LiveClock.svelte';

	let { data, children } = $props();
	const isLogin = $derived(page.url.pathname === '/dashboard/login');
	const path = $derived(page.url.pathname);

	// Menù dal documento del gestionale: PRODUZIONE e DOCUMENTI (qui "Fatturazione"), più le altre sezioni
	const menu = $derived([
		{ id: 'produzione', title: 'Produzione', items: [
			{ label: 'Piano di lavoro', href: '/dashboard/produzione/piano' },
			{ label: 'In stampa', href: '/dashboard/produzione/stampa', count: data.counts?.stampa },
			{ label: 'In plastifica', href: '/dashboard/produzione/plastifica', count: data.counts?.plastifica },
			{ label: 'In taglio', href: '/dashboard/produzione/taglio', count: data.counts?.taglio },
			{ label: 'In resinatura', href: '/dashboard/produzione/resinatura', count: data.counts?.resinatura },
			{ label: 'In confezionamento', href: '/dashboard/produzione/confezionamento', count: data.counts?.confezionamento },
			{ label: 'In spedizione', href: '/dashboard/produzione/spedizioni', count: data.counts?.spedizione }
		] },
		{ id: 'fatturazione', title: 'Fatturazione', items: [
			{ label: 'Ordini', href: '/dashboard/fatturazione/ordini', count: data.counts?.prove },
			{ label: 'DDT', href: '/dashboard/fatturazione/ddt' },
			{ label: 'Fatture', href: '/dashboard/fatturazione/fatture' },
			{ label: 'Preventivi', href: '/dashboard/fatturazione/preventivi' }
		] },
		{ id: 'anagrafica', title: 'Anagrafica', items: [
			{ label: 'Clienti', href: '/dashboard/anagrafica/clienti' }
		] },
		{ id: 'marketing', title: 'Marketing', items: [
			// Dati dalla dashboard PERIZ Marketing (src/lib/server/periz.ts)
			{ label: 'Panoramica', href: '/dashboard/marketing', exact: true },
			{ label: 'Programmazione', href: '/dashboard/marketing/programmazione' },
			{ label: 'Budget & ADV', href: '/dashboard/marketing/budget' },
			{ label: 'Contenuti', href: '/dashboard/marketing/contenuti' },
			{ label: 'Risultati', href: '/dashboard/marketing/risultati' },
			{ label: 'Approvazioni', href: '/dashboard/marketing/approvazioni', count: data.counts?.approvazioni },
			{ label: 'Appuntamenti', href: '/dashboard/marketing/appuntamenti' },
			{ label: 'Notifiche', href: '/dashboard/marketing/notifiche', count: data.counts?.notifiche }
		] },
		{ id: 'blog', title: 'Blog', items: [{ label: 'Articoli', href: '/dashboard/blog' }] },
		{ id: 'preventivatori', title: 'Preventivatori', items: PRODUCT_ENGINES.map((p) => ({ label: p.name, href: `/dashboard/preventivatori/${p.slug}` })) },
		{ id: 'setup', title: 'Setup', items: [
			{ label: 'Metodi di pagamento', href: '/dashboard/setup/metodi-pagamento' },
			{ label: 'Codici sconto', href: '/dashboard/setup/codici-sconto' },
			{ label: 'Codici prodotto', href: '/dashboard/setup/codici-prodotto' },
			{ label: 'Corrieri', href: '/dashboard/setup/corrieri' }
		] }
	]);
	const active = (href: string, exact = false) => path === href || (!exact && path.startsWith(href + '/'));

	// gruppi aperti/chiusi, ricordati nel browser
	let closed = $state<Set<string>>(new Set());
	$effect(() => {
		try { closed = new Set(JSON.parse(localStorage.getItem('sp-dash-closed') ?? '[]')); } catch { /* vuoto */ }
	});
	function toggle(id: string) {
		const s = new Set(closed);
		s.has(id) ? s.delete(id) : s.add(id);
		closed = s;
		try { localStorage.setItem('sp-dash-closed', JSON.stringify([...s])); } catch { /* niente */ }
	}

	// nuovi ordini in tempo reale: avviso nella dashboard + notifica del browser
	let toasts = $state<{ id: string; text: string; href: string }[]>([]);
	let pushOn = $state(false);
	let pushMsg = $state('');
	$effect(() => {
		if (isLogin) return;
		const ch = data.supabase.channel('orders-live').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, (p) => {
			const o = p.new as { number: string; product_name: string; qty: number; total_gross: number; checkout_group: string; channel: string };
			if (o.channel === 'manuale') return;
			const text = `Nuovo ordine ${o.number}: ${o.qty} × ${o.product_name} · ${Number(o.total_gross).toFixed(2)} €`;
			toasts = [...toasts, { id: o.number, text, href: `/dashboard/fatturazione/ordini/${o.checkout_group}` }];
			setTimeout(() => (toasts = toasts.filter((t) => t.id !== o.number)), 15000);
			if (typeof Notification !== 'undefined' && Notification.permission === 'granted') new Notification('Nuovo ordine Stickerprint', { body: text, icon: '/icons/icon-192.png' });
			invalidateAll();
		}).subscribe();
		return () => { data.supabase.removeChannel(ch); };
	});
	$effect(() => {
		if (isLogin || typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
		navigator.serviceWorker.register('/sw.js').then(async (reg) => { pushOn = !!(await reg.pushManager.getSubscription()); }).catch(() => {});
	});
	async function enablePush() {
		pushMsg = '';
		try {
			if (!('serviceWorker' in navigator) || !('PushManager' in window)) { pushMsg = 'Questo browser non supporta le notifiche. Su iPhone aggiungi la dashboard alla schermata Home.'; return; }
			const perm = await Notification.requestPermission();
			if (perm !== 'granted') { pushMsg = 'Permesso negato dal browser.'; return; }
			const reg = await navigator.serviceWorker.ready;
			const key = Uint8Array.from(atob(data.vapid.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(data.vapid.length / 4) * 4, '=')), (c) => c.charCodeAt(0));
			const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
			const r = await fetch('/api/push', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ subscription: sub.toJSON(), device: navigator.userAgent.slice(0, 120) }) }).then((r) => r.json());
			pushOn = !!r.ok;
			pushMsg = r.ok ? 'Notifiche attive su questo dispositivo.' : `Errore: ${r.error}`;
		} catch (e) {
			pushMsg = e instanceof Error ? e.message : 'Errore';
		}
	}
</script>

<svelte:head>
	{#if !isLogin}<link rel="manifest" href="/manifest.webmanifest" /><meta name="theme-color" content="#0b0b3b" /><link rel="apple-touch-icon" href="/icons/icon-180.png" />{/if}
</svelte:head>

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
				{#each menu as group (group.id)}
					<div class="dash__group" class:is-closed={closed.has(group.id)}>
						<button type="button" class="dash__gtitle" onclick={() => toggle(group.id)} aria-expanded={!closed.has(group.id)}>
							<span>{group.title}</span><i class="dash__chev">{closed.has(group.id) ? '▸' : '▾'}</i>
						</button>
						{#if !closed.has(group.id)}
							{#each group.items as it (it.href)}
								<a href={it.href} class:is-active={active(it.href, 'exact' in it && it.exact)}>{it.label}{#if it.count}<span class="dash__cnt">{it.count}</span>{/if}</a>
							{/each}
						{/if}
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
				<div style="display:flex;gap:14px;align-items:center">
					<button type="button" class="btn btn--xs {pushOn ? 'btn--ghost' : 'btn--yellow'}" onclick={enablePush} title="Ricevi una notifica su questo dispositivo a ogni nuovo ordine">{pushOn ? '🔔 Notifiche attive' : '🔔 Attiva notifiche'}</button>
					{#if pushMsg}<small style="color:var(--muted)">{pushMsg}</small>{/if}
					<a class="link" href="/" target="_blank" rel="noopener">Vai al sito ↗</a>
				</div>
				<LiveClock />
			</div>
			<div class="dash__content">
				{@render children()}
			</div>
		</div>
		{#if toasts.length}
			<div class="toasts">
				{#each toasts as t (t.id)}<a class="toast" href={t.href}>🛒 {t.text}</a>{/each}
			</div>
		{/if}
	</div>
{/if}
