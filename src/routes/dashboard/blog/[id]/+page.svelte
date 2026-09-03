<script lang="ts">
	import { enhance } from '$app/forms';
	import '$lib/styles/pages.css';
	import { slugify } from '$lib/blog';

	let { data, form } = $props();
	// svelte-ignore state_referenced_locally
	const p = data.post;
	let title = $state(p?.title ?? '');
	let slug = $state(p?.slug ?? '');
	let slugTouched = $state(!!p);
	// svelte-ignore state_referenced_locally
	let category = $state(p?.category ?? data.categories[0] ?? 'News');
	let newCategory = $state('');
	let excerpt = $state(p?.excerpt ?? '');
	let author = $state(p?.author ?? 'Admin');
	let coverUrl = $state(p?.cover_url ?? '');
	let published = $state(p?.published ?? false);
	let publishedAt = $state(p?.published_at ? p.published_at.slice(0, 10) : new Date().toISOString().slice(0, 10));
	let content = $state(p?.content ?? '');
	let preview = $state(false);
	let msg = $state('');
	let editor = $state<HTMLDivElement | undefined>();
	let mediaInput = $state<HTMLInputElement | undefined>();
	let coverInput = $state<HTMLInputElement | undefined>();

	$effect(() => {
		if (!slugTouched) slug = slugify(title);
	});

	function syncContent() {
		if (editor) content = editor.innerHTML;
	}
	function cmd(command: string, value?: string) {
		editor?.focus();
		document.execCommand(command, false, value);
		syncContent();
	}
	function insertHtml(html: string) {
		editor?.focus();
		document.execCommand('insertHTML', false, html);
		syncContent();
	}
	async function upload(file: File, folder: string): Promise<string | null> {
		msg = 'Caricamento…';
		const ext = (file.name.split('.').pop() ?? 'bin').toLowerCase().replace(/[^a-z0-9]/g, '') || 'bin';
		const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${ext}`;
		const { error } = await data.supabase.storage.from('blog-media').upload(path, file, { contentType: file.type });
		if (error) {
			msg = `File non caricato: ${error.message}`;
			return null;
		}
		msg = '';
		return data.supabase.storage.from('blog-media').getPublicUrl(path).data.publicUrl;
	}
	async function onMedia(e: Event) {
		const input = e.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;
		const url = await upload(file, 'media');
		if (!url) return;
		if (file.type.startsWith('video/')) insertHtml(`<p><video controls src="${url}"></video></p><p></p>`);
		else insertHtml(`<p><img src="${url}" alt="" /></p><p></p>`);
		input.value = '';
	}
	async function onCover(e: Event) {
		const input = e.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;
		const url = await upload(file, 'cover');
		if (url) coverUrl = url;
		input.value = '';
	}
	function youtube() {
		const u = prompt('Incolla il link del video YouTube');
		if (!u) return;
		const m = u.match(/(?:v=|youtu\.be\/|shorts\/)([\w-]{6,})/);
		if (!m) {
			msg = 'Link YouTube non riconosciuto.';
			return;
		}
		insertHtml(`<p><iframe src="https://www.youtube.com/embed/${m[1]}" title="Video" allowfullscreen></iframe></p><p></p>`);
	}
	function link() {
		const u = prompt('Indirizzo del link (https://…)');
		if (u) cmd('createLink', u);
	}
</script>

<svelte:head><title>{p ? 'Modifica articolo' : 'Nuovo articolo'} | Dashboard</title></svelte:head>

<div class="toolbar" style="justify-content:space-between">
	<div>
		<h1>{p ? 'Modifica articolo' : 'Nuovo articolo'}</h1>
		<p class="lead"><a class="link" href="/dashboard/blog">← Tutti gli articoli</a>{#if p?.published} · <a class="link" href="/blog/{p.slug}" target="_blank" rel="noopener">Vedi sul sito ↗</a>{/if}</p>
	</div>
</div>

{#if form?.error}<p class="error">{form.error}</p>{/if}
{#if form?.ok}<p class="success">Articolo salvato.</p>{/if}
{#if msg}<p class="error">{msg}</p>{/if}

<form method="POST" action="?/save" use:enhance style="display:grid;gap:18px" onsubmit={syncContent}>
	<input type="hidden" name="content" value={content} />
	<input type="hidden" name="cover_url" value={coverUrl} />

	<div class="dcard">
		<div class="dform">
			<label style="grid-column:1/-1">Titolo<input type="text" name="title" bind:value={title} required /></label>
			<label>Indirizzo (slug)<input type="text" name="slug" bind:value={slug} oninput={() => (slugTouched = true)} /></label>
			<label>Autore<input type="text" name="author" bind:value={author} /></label>
			<label>Categoria
				<select name="category" bind:value={category}>{#each data.categories as c (c)}<option value={c}>{c}</option>{/each}</select>
			</label>
			<label>…oppure nuova categoria<input type="text" name="new_category" bind:value={newCategory} placeholder="es. Tutorial" /></label>
			<label style="grid-column:1/-1">Sottotitolo / anteprima (nell’elenco)<input type="text" name="excerpt" bind:value={excerpt} /></label>
		</div>
	</div>

	<div class="dcard">
		<h3>Immagine di copertina</h3>
		<div style="display:flex;gap:16px;align-items:center;flex-wrap:wrap">
			{#if coverUrl}<img src={coverUrl} alt="" style="width:220px;aspect-ratio:16/10;object-fit:cover;border-radius:12px" />{/if}
			<input bind:this={coverInput} type="file" accept="image/*" hidden onchange={onCover} />
			<button type="button" class="btn btn--ghost btn--xs" onclick={() => coverInput?.click()}>{coverUrl ? 'Cambia copertina' : 'Carica copertina'}</button>
			{#if coverUrl}<button type="button" class="link-btn" onclick={() => (coverUrl = '')}>Rimuovi</button>{/if}
		</div>
	</div>

	<div class="dcard">
		<div class="toolbar" style="justify-content:space-between;margin-bottom:10px">
			<h3 style="margin:0">Contenuto</h3>
			<button type="button" class="btn btn--ghost btn--xs" onclick={() => { syncContent(); preview = !preview; }}>{preview ? 'Torna a modificare' : 'Anteprima'}</button>
		</div>
		{#if preview}
			<div class="post__body" style="border:1px solid var(--line);border-radius:12px;padding:20px">{@html content}</div>
		{:else}
			<div class="ed-toolbar">
				<button type="button" onclick={() => cmd('bold')}><b>B</b></button>
				<button type="button" onclick={() => cmd('italic')}><i>I</i></button>
				<button type="button" onclick={() => cmd('formatBlock', 'H2')}>Titolo</button>
				<button type="button" onclick={() => cmd('formatBlock', 'H3')}>Sottotitolo</button>
				<button type="button" onclick={() => cmd('formatBlock', 'P')}>Testo</button>
				<button type="button" onclick={() => cmd('insertUnorderedList')}>• Elenco</button>
				<button type="button" onclick={link}>Link</button>
				<span class="ed-sep"></span>
				<input bind:this={mediaInput} type="file" accept="image/*,video/mp4,video/webm,video/quicktime" hidden onchange={onMedia} />
				<button type="button" class="is-media" onclick={() => mediaInput?.click()}>📷 Foto / 🎬 Video</button>
				<button type="button" class="is-media" onclick={youtube}>▶ YouTube</button>
			</div>
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<div class="editor post__body" contenteditable="true" bind:this={editor} oninput={syncContent} onblur={syncContent}>{@html p?.content ?? ''}</div>
		{/if}
	</div>

	<div class="dcard toolbar" style="justify-content:space-between;flex-wrap:wrap;gap:12px">
		<div style="display:flex;gap:18px;align-items:center;flex-wrap:wrap">
			<label style="display:flex;gap:8px;align-items:center;font-weight:700"><input type="checkbox" name="published" bind:checked={published} /> Pubblicato sul sito</label>
			<label style="display:flex;gap:8px;align-items:center;font-size:13px">Data <input type="date" name="published_at" bind:value={publishedAt} class="input" style="padding:6px 10px" /></label>
		</div>
		<div style="display:flex;gap:10px;align-items:center">
			{#if p}<button class="link-btn" type="submit" formaction="?/delete" onclick={(e) => { if (!confirm('Eliminare questo articolo?')) e.preventDefault(); }}>Elimina</button>{/if}
			<button class="btn btn--green" type="submit">Salva articolo</button>
		</div>
	</div>
</form>

<style>
	.ed-toolbar { display: flex; flex-wrap: wrap; gap: 6px; padding: 8px; border: 1px solid var(--line); border-bottom: 0; border-radius: 12px 12px 0 0; background: #f7f8fb; }
	.ed-toolbar button { font: inherit; font-size: 13px; font-weight: 700; padding: 6px 10px; border: 1px solid var(--line); border-radius: 8px; background: #fff; cursor: pointer; }
	.ed-toolbar button:hover { border-color: var(--blue); color: var(--blue); }
	.ed-toolbar .is-media { background: var(--sky); }
	.ed-sep { width: 1px; background: var(--line); margin: 0 4px; }
	.editor { min-height: 360px; border: 1px solid var(--line); border-radius: 0 0 12px 12px; padding: 18px 20px; outline: 0; background: #fff; }
	.editor:focus { border-color: var(--blue); }
</style>
