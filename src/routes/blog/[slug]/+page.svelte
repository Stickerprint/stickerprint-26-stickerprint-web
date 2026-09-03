<script lang="ts">
	import '$lib/styles/pages.css';
	import { postDate } from '$lib/blog';
	let { data } = $props();
	const p = $derived(data.post);
</script>

<svelte:head>
	<title>{p.title} | Blog Stickerprint</title>
	{#if p.excerpt}<meta name="description" content={p.excerpt} />{/if}
</svelte:head>

<article class="section container post">
	<a class="link" href="/blog">← Torna al blog</a>
	<span class="tag tag--green" style="display:inline-block;margin:18px 0 10px">{p.category}</span>
	<h1 style="font-size:clamp(30px,4vw,48px);line-height:1.08">{p.title}</h1>
	<p class="meta" style="color:var(--muted);font-size:13.5px;margin-top:10px">Pubblicato da {p.author} il {postDate(p)}</p>
	{#if p.cover_url}<img class="post__cover" src={p.cover_url} alt="" />{/if}
	<!-- contenuto scritto dallo staff nella dashboard (HTML) -->
	<div class="post__body">{@html p.content}</div>
</article>
