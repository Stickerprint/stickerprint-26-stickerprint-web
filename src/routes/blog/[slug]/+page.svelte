<script lang="ts">
	import Seo from '$lib/components/Seo.svelte';
	import { ORG_ID, absUrl, breadcrumbLd, canonicalUrl } from '$lib/seo';
	import '$lib/styles/pages.css';
	import { postDate } from '$lib/blog';
	let { data } = $props();
	const p = $derived(data.post);
</script>

<Seo title={`${p.title} | Blog Stickerprint`} description={p.excerpt ?? `${p.title}: articolo dal blog Stickerprint.`} image={p.cover_url} type="article" ld={[
	{ '@context': 'https://schema.org', '@type': 'BlogPosting', headline: p.title, description: p.excerpt ?? undefined, image: p.cover_url ? [absUrl(p.cover_url)] : undefined, datePublished: p.published_at ?? p.created_at, dateModified: p.updated_at ?? p.published_at ?? p.created_at, author: { '@type': 'Person', name: p.author }, publisher: { '@id': ORG_ID }, mainEntityOfPage: canonicalUrl(`/blog/${p.slug}`) },
	breadcrumbLd([{ name: 'Home', path: '/' }, { name: 'Blog', path: '/blog' }, { name: p.title, path: `/blog/${p.slug}` }])
]} />

<article class="section container post">
	<a class="link" href="/blog">← Torna al blog</a>
	<span class="tag tag--green" style="display:inline-block;margin:18px 0 10px">{p.category}</span>
	<h1 style="font-size:clamp(30px,4vw,48px);line-height:1.08">{p.title}</h1>
	<p class="meta" style="color:var(--muted);font-size:13.5px;margin-top:10px">Pubblicato da {p.author} il {postDate(p)}</p>
	{#if p.cover_url}<img class="post__cover" src={p.cover_url} alt="" />{/if}
	<!-- contenuto scritto dallo staff nella dashboard (HTML) -->
	<div class="post__body">{@html p.content}</div>
</article>
