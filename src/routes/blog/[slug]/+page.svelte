<script lang="ts">
	import Seo from '$lib/components/Seo.svelte';
	import { ORG_ID, absUrl, breadcrumbLd, canonicalUrl } from '$lib/seo';
	import '$lib/styles/pages.css';
	import { usaLingua } from '$lib/traduzioni';
	const { t, path, data: dataIn } = usaLingua();
	let { data } = $props();
	const p = $derived(data.post);
</script>

<Seo title={t('pagine.blog.seoArticolo', { titolo: p.title })} description={p.excerpt ?? t('pagine.blog.descArticolo', { titolo: p.title })} image={p.cover_url} type="article" ld={[
	{ '@context': 'https://schema.org', '@type': 'BlogPosting', headline: p.title, description: p.excerpt ?? undefined, image: p.cover_url ? [absUrl(p.cover_url)] : undefined, datePublished: p.published_at ?? p.created_at, dateModified: p.updated_at ?? p.published_at ?? p.created_at, author: { '@type': 'Person', name: p.author }, publisher: { '@id': ORG_ID }, mainEntityOfPage: canonicalUrl(`/blog/${p.slug}`) },
	breadcrumbLd([{ name: t('pagine.blog.home'), path: '/' }, { name: t('pagine.blog.blog'), path: '/blog' }, { name: p.title, path: `/blog/${p.slug}` }])
]} />

<article class="section container post">
	<a class="link" href={path('/blog')}>{t('pagine.blog.torna')}</a>
	<span class="tag tag--green" style="display:inline-block;margin:18px 0 10px">{p.categoria}</span>
	<h1 style="font-size:clamp(30px,4vw,48px);line-height:1.08">{p.title}</h1>
	<p class="meta" style="color:var(--muted);font-size:13.5px;margin-top:10px">{t('pagine.blog.pubblicato', { autore: p.author, data: dataIn(p.published_at ?? p.created_at) })}</p>
	{#if p.cover_url}<img class="post__cover" src={p.cover_url} alt="" />{/if}
	<!-- contenuto scritto dallo staff nella dashboard (HTML), tradotto nelle altre lingue dal lavoro di traduzione -->
	<div class="post__body">{@html p.content}</div>
</article>
