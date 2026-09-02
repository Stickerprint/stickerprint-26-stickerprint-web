<script lang="ts">
	let { items }: { items: { q: string; a: string }[] } = $props();
	let open = $state<number | null>(null);
</script>

<div class="faq">
	{#each items as it, k (it.q)}
		<div class="faq__item" class:is-open={open === k}>
			<button type="button" class="faq__q" aria-expanded={open === k} onclick={() => (open = open === k ? null : k)}>
				{it.q}
				<span class="faq__chev" aria-hidden="true"></span>
			</button>
			{#if open === k}<p class="faq__a">{it.a}</p>{/if}
		</div>
	{/each}
</div>
