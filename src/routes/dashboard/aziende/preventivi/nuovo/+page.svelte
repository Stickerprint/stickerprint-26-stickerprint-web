<script lang="ts">
	import OrderEditor from '$lib/components/dashboard/OrderEditor.svelte';
	import { emptyDraft } from '$lib/dashboard/orderDraft';
	let { data, form } = $props();
	const draft = emptyDraft();
	draft.items = [];
</script>

<svelte:head><title>Nuovo preventivo | Dashboard</title></svelte:head>

<p class="lead" style="margin:0"><a class="link" href="/dashboard/aziende/preventivi">Preventivi</a> › <b>Nuovo preventivo</b></p>
<OrderEditor {draft} methods={data.methods} codes={data.codes} contacts={data.contacts} supabase={data.supabase} mode="create" {form} title="Nuovo preventivo" labels={{ lead: 'Cliente, articoli con prezzi e condizioni: si salva come bozza, oppure si passa subito all’email da scrivere al cliente.', save: 'Salva bozza', send: 'Salva e prepara l’email', back: '/dashboard/aziende/preventivi' }} />
