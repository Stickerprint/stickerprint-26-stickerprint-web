<script lang="ts">
	import '$lib/styles/account.css';
	import { page } from '$app/state';
	import { invalidateAll } from '$app/navigation';

	// gli stati dei tuoi ordini si aggiornano da soli quando la produzione li fa avanzare
	$effect(() => {
		const uid = data.user?.id;
		if (!uid) return;
		const ch = data.supabase.channel('my-orders').on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders', filter: `user_id=eq.${uid}` }, () => invalidateAll()).subscribe();
		return () => { data.supabase.removeChannel(ch); };
	});
	let { data, children } = $props();
	const path = $derived(page.url.pathname);
	const initials = $derived((data.profile.name || 'SP').split(/[\s@._-]+/).filter(Boolean).slice(0, 2).map((s: string) => s[0]?.toUpperCase()).join(''));
	const items = $derived([
		{ href: '/account', label: 'Panoramica', icon: 'M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z', exact: true },
		{ href: '/account/ordini', label: 'I miei ordini', short: 'Ordini', icon: 'M21 8l-9-5-9 5v8l9 5 9-5zM3 8l9 5 9-5M12 13v8', count: data.counts.open },
		{ href: '/account/credito', label: 'Credito Stickerprint', short: 'Credito', icon: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 5v10m-3-3h4.5a1.5 1.5 0 0 0 0-3h-3a1.5 1.5 0 0 1 0-3H15' },
		{ href: '/account/dati', label: 'Dati e indirizzi', short: 'Dati', icon: 'M12 21s7-6 7-11a7 7 0 1 0-14 0c0 5 7 11 7 11zm0-9a2 2 0 1 0 0-4 2 2 0 0 0 0 4z' },
		{ href: '/account/pagamenti', label: 'Pagamenti', icon: 'M3 6h18v12H3zM3 10h18M7 15h3' },
		{ href: '/account/recensioni', label: 'Recensioni', icon: 'M12 3l2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3 6.4 20.2l1.1-6.2L3 9.6l6.2-.9z', count: data.counts.toReview }
	]);
	const active = (it: { href: string; exact?: boolean }) => (it.exact ? path === it.href : path.startsWith(it.href));
	/* telefono: la navigazione e' una fila di schede che scorre in orizzontale; la scheda attiva viene portata in vista */
	let nav = $state<HTMLElement | undefined>();
	$effect(() => { path; const el = nav?.querySelector<HTMLElement>('a.is-active'); if (el && nav) nav.scrollTo({ left: el.offsetLeft - 16, behavior: 'smooth' }); });
	/* foto profilo che non si carica (formato non leggibile dal browser, file rimosso): si torna alle iniziali */
	let avatarKo = $state(false);
	$effect(() => { data.profile.avatar; avatarKo = false; });
	/* la foto viene ridotta e salvata in JPEG prima del caricamento: le foto dell'iPhone (HEIC, 5-10 MB) altrimenti
	   non si vedono negli altri browser e pesano troppo */
	async function toJpeg(file: File): Promise<Blob> {
		try {
			const bmp = await createImageBitmap(file);
			const side = Math.min(bmp.width, bmp.height), out = Math.min(512, side);
			const c = document.createElement('canvas'); c.width = out; c.height = out;
			c.getContext('2d')!.drawImage(bmp, (bmp.width - side) / 2, (bmp.height - side) / 2, side, side, 0, 0, out, out);
			return await new Promise<Blob>((ok, ko) => c.toBlob((b) => (b ? ok(b) : ko(new Error('toBlob'))), 'image/jpeg', 0.88));
		} catch { return file; }
	}

	// foto profilo: caricata nel bucket "avatars" nella cartella dell'utente
	let avatarInput = $state<HTMLInputElement | undefined>();
	let avatarMsg = $state('');
	async function onAvatar(e: Event) {
		const input = e.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		if (!file || !data.user) return;
		if (file.size > 20 * 1024 * 1024) { avatarMsg = 'Foto troppo grande (max 20 MB).'; return; }
		avatarMsg = 'Caricamento…';
		const blob = await toJpeg(file);
		const jpeg = blob !== file;
		const ext = jpeg ? 'jpg' : ((file.name.split('.').pop() ?? 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg');
		const path = `${data.user.id}/avatar-${Date.now()}.${ext}`;
		const { error } = await data.supabase.storage.from('avatars').upload(path, blob, { contentType: jpeg ? 'image/jpeg' : file.type, upsert: true });
		if (error) { avatarMsg = `Foto non caricata: ${error.message}`; return; }
		const url = data.supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl;
		const { error: e2 } = await data.supabase.from('profiles').update({ avatar_url: url }).eq('id', data.user.id);
		avatarMsg = e2 ? `Foto non salvata: ${e2.message}` : '';
		input.value = '';
		await invalidateAll();
	}
</script>

<div class="acc">
	<aside class="acc__side">
		<div class="acc__who">
			<div class="acc__avatar">
				{#if data.profile.avatar && !avatarKo}<img src={data.profile.avatar} alt="" onerror={() => (avatarKo = true)} />{:else}<span class="avatar" style="width:52px;height:52px;font-size:16px">{initials}</span>{/if}
				<input bind:this={avatarInput} type="file" accept="image/*" hidden onchange={onAvatar} />
				<button type="button" class="acc__cam" title="Cambia foto profilo" aria-label="Cambia foto profilo" onclick={() => avatarInput?.click()}>
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M4 8h3l2-3h6l2 3h3v11H4z" /><circle cx="12" cy="13" r="3.5" /></svg>
				</button>
			</div>
			<div>
				<b>{data.profile.name}</b>
				{#if data.loyalty}<span class="acc__level"><img src={data.loyalty.img} alt="" />{data.loyalty.name}</span>{/if}
				<small>Cliente dal {data.profile.since}</small>
			</div>
			<form class="acc__out-m" method="POST" action="/logout"><button type="submit" aria-label="Esci dall’account" title="Esci dall’account"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l5-5-5-5M15 12H4" /></svg></button></form>
			{#if avatarMsg}<small style="grid-column:1/-1;color:#ffb3ad">{avatarMsg}</small>{/if}
		</div>
		<nav class="acc__nav" aria-label="Area personale" bind:this={nav}>
			{#each items as it (it.href)}
				<a href={it.href} class:is-active={active(it)}>
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round" aria-hidden="true"><path d={it.icon} /></svg>
					<span class="acc__lbl">{it.label}</span><span class="acc__lbl-s">{it.short ?? it.label}</span>
					{#if it.count}<span class="cnt">{it.count}</span>{/if}
				</a>
			{/each}
		</nav>
		<form class="acc__out" method="POST" action="/logout"><button class="link-btn" type="submit">Esci dall’account</button></form>
	</aside>
	<main class="acc__main">
		<div class="acc__inner">{@render children()}</div>
	</main>
</div>
