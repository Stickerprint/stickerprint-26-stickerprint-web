<script lang="ts">
	import '$lib/styles/pages.css';
	import { postDate } from '$lib/blog';
	let { data } = $props();
</script>

<svelte:head><title>Blog | Stickerprint</title><meta name="description" content="News, consigli e idee dal mondo Stickerprint." /></svelte:head>

<section class="section container">
	<h1 style="font-size:clamp(34px,4.5vw,56px)">Il nostro <span class="hl hl--yellow">blog</span></h1>
	<div class="cat-tabs">
		<a href="/blog" class:is-active={!data.cat}>Tutti</a>
		{#each data.categories as c (c)}<a href="/blog?cat={encodeURIComponent(c)}" class:is-active={data.cat === c}>{c}</a>{/each}
	</div>
	{#if data.posts.length === 0}
		<p class="lead">Nessun articolo in questa categoria, per ora.</p>
	{:else}
		<div class="blog-grid">
			{#each data.posts as p (p.id)}
				<a class="post-card" href="/blog/{p.slug}">
					{#if p.cover_url}<img src={p.cover_url} alt="" loading="lazy" />{:else}<div style="aspect-ratio:16/10;border-radius:18px;background:var(--sky)"></div>{/if}
					<span class="tag tag--green" style="justify-self:start">{p.category}</span>
					<h3>{p.title}</h3>
					{#if p.excerpt}<p class="lead" style="font-size:15px">{p.excerpt}</p>{/if}
					<span class="meta">Pubblicato da {p.author} il {postDate(p)}</span>
				</a>
			{/each}
		</div>
	{/if}
</section>
