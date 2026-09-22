<script lang="ts">
	import OrderEditor from '$lib/components/dashboard/OrderEditor.svelte';
	import { emptyDraft } from '$lib/dashboard/orderDraft';
	let { data, form } = $props();
</script>

<svelte:head><title>{data.from ? `Copia dell'ordine ${data.from}` : 'Nuovo ordine manuale'} | Dashboard</title></svelte:head>

<p class="lead" style="margin:0"><a class="link" href="/dashboard/fatturazione/ordini">Ordini</a> › <b>{data.from ? `Copia dell'ordine ${data.from}` : 'Nuovo ordine manuale'}</b></p>
{#if data.from}<p class="success">Ordine compilato con i dati di <b>{data.from}</b>: controlla, modifica quello che serve e salva. Nasce un ordine nuovo con un numero nuovo; l'originale non cambia.</p>{/if}
<OrderEditor draft={data.draft ?? emptyDraft()} methods={data.methods} codes={data.codes} contacts={data.contacts} supabase={data.supabase} mode="create" {form} title={data.from ? `Copia dell'ordine ${data.from}` : 'Nuovo ordine manuale'} />
