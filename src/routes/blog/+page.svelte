<script lang="ts">
	import Seo from '$lib/components/Seo.svelte';
	import '$lib/styles/pages.css';
	import { usaLingua } from '$lib/traduzioni';
	const { t, path, data: dataIn } = usaLingua();
	let { data } = $props();
	/* articoli, categorie e contorno nella lingua del sito (traduzioni dal database o da src/lib/contenuti-tradotti) */
	const blog = path('/blog');
</script>

<Seo title={t('pagine.blog.seoTitolo')} description={t('pagine.blog.seoDescrizione')} />

<section class="section container">
	<h1 style="font-size:clamp(34px,4.5vw,56px)">{@html t('pagine.blog.titolo')}</h1>
	<div class="cat-tabs">
		<a href={blog} class:is-active={!data.cat}>{t('pagine.blog.tutti')}</a>
		{#each data.categories as c (c.name)}<a href="{blog}?cat={encodeURIComponent(c.name)}" class:is-active={data.cat === c.name}>{c.label}</a>{/each}
	</div>
	{#if data.posts.length === 0}
		<p class="lead">{t('pagine.blog.nessuno')}</p>
	{:else}
		<div class="blog-grid">
			{#each data.posts as p (p.id)}
				<a class="post-card" href={path(`/blog/${p.slug}`)}>
					{#if p.cover_url}<img src={p.cover_url} alt="" loading="lazy" />{:else}<div style="aspect-ratio:16/10;border-radius:18px;background:var(--sky)"></div>{/if}
					<span class="tag tag--green" style="justify-self:start">{p.categoria}</span>
					<h3>{p.title}</h3>
					{#if p.excerpt}<p class="lead" style="font-size:15px">{p.excerpt}</p>{/if}
					<span class="meta">{t('pagine.blog.pubblicato', { autore: p.author, data: dataIn(p.published_at ?? p.created_at) })}</span>
				</a>
			{/each}
		</div>
	{/if}
</section>
