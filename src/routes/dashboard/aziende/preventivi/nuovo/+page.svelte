<script lang="ts">
	import OrderEditor from '$lib/components/dashboard/OrderEditor.svelte';
	import { emptyDraft } from '$lib/dashboard/orderDraft';
	let { data, form } = $props();
	// svelte-ignore state_referenced_locally
	const draft = data.draft ?? (() => { const d = emptyDraft(); d.items = []; return d; })();
</script>

<svelte:head><title>{data.from ? `Copia del preventivo ${data.from}` : 'Nuovo preventivo'} | Dashboard</title></svelte:head>

<p class="lead" style="margin:0"><a class="link" href="/dashboard/aziende/preventivi">Preventivi</a> › <b>{data.from ? `Copia del preventivo ${data.from}` : 'Nuovo preventivo'}</b></p>
{#if data.from}<p class="success">Preventivo compilato con i dati di <b>{data.from}</b>: controlla, modifica quello che serve e salva. Nasce un preventivo nuovo con un numero nuovo; l'originale non cambia.</p>{/if}
<OrderEditor {draft} methods={data.methods} codes={data.codes} contacts={data.contacts} supabase={data.supabase} mode="create" {form} title={data.from ? `Copia del preventivo ${data.from}` : 'Nuovo preventivo'} labels={{ lead: 'Cliente, articoli con prezzi e condizioni: si salva come bozza, oppure si passa subito all’email da scrivere al cliente.', save: 'Salva bozza', send: 'Salva e prepara l’email', back: '/dashboard/aziende/preventivi' }} />
