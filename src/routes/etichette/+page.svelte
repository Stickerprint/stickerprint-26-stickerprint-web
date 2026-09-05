<script lang="ts">
	import ProductPage from '$lib/components/ProductPage.svelte';
	let { data } = $props();
</script>

<ProductPage p={data.product} engine={data.engine} reviews={data.reviews} stats={data.stats} shipDate={data.shipDate} shipShort={data.shipShort} faq={data.faq} />
