<script lang="ts">
	import OrderEditor from '$lib/components/dashboard/OrderEditor.svelte';
	import { emptyDraft } from '$lib/dashboard/orderDraft';
	let { data, form } = $props();
</script>

<svelte:head><title>Nuovo ordine manuale | Dashboard</title></svelte:head>

<p class="lead" style="margin:0"><a class="link" href="/dashboard/fatturazione/ordini">Ordini</a> › <b>Nuovo ordine manuale</b></p>
<OrderEditor draft={emptyDraft()} methods={data.methods} codes={data.codes} contacts={data.contacts} supabase={data.supabase} mode="create" {form} title="Nuovo ordine manuale" />
