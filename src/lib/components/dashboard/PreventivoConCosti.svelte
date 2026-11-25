<script lang="ts">
	/* L'editor del preventivo con accanto il pannello «Costi e margini» (Mattia, 25/11/2026). Sugli schermi larghi il
	   pannello sta a destra e resta in vista mentre si scorre; su quelli stretti va sotto l'editor. */
	import type { ComponentProps } from 'svelte';
	import OrderEditor from './OrderEditor.svelte';
	import CostiPreventivo from './CostiPreventivo.svelte';
	import { categoryOf, type OrderDraft, type ProductCode } from '$lib/dashboard/orderDraft';
	import type { Contesto } from '$lib/margini/preventivo';

	type DatiCosti = Omit<Contesto, 'prodottoDi'>;
	let { costi, ...editor }: ComponentProps<typeof OrderEditor> & { /** listini, codici, macchinari e calendario per il calcolo; senza, il pannello non compare */ costi?: DatiCosti | null } = $props();

	let rif = $state<ReturnType<typeof OrderEditor> | null>(null);
	// svelte-ignore state_referenced_locally
	let bozza = $state<OrderDraft>(editor.draft);
	const contesto = $derived<Contesto | null>(costi ? { ...costi, prodottoDi: (code: string) => categoryOf(code, editor.codes as ProductCode[]) } : null);
	/* il pannello si puo' nascondere: la scelta resta nel browser */
	let visibile = $state(true);
	$effect(() => { try { visibile = localStorage.getItem('sp-costi-preventivo') !== 'chiuso'; } catch { /* niente memoria */ } });
	function mostra(v: boolean) { visibile = v; try { localStorage.setItem('sp-costi-preventivo', v ? 'aperto' : 'chiuso'); } catch { /* niente memoria */ } }
</script>

{#if contesto}
	<div class="pcc" class:is-chiuso={!visibile}>
		<div class="pcc__editor"><OrderEditor bind:this={rif} {...editor} ondraft={(d) => (bozza = d)} /></div>
		{#if visibile}
			<aside class="pcc__pannello">
				<button type="button" class="pcc__chiudi" onclick={() => mostra(false)} title="Nascondi il pannello dei costi">nascondi ›</button>
				<CostiPreventivo {bozza} {contesto} onmodifica={(fn) => rif?.modifica(fn)} />
			</aside>
		{:else}
			<button type="button" class="pcc__apri" onclick={() => mostra(true)}>💰 Costi e margini</button>
		{/if}
	</div>
{:else}
	<OrderEditor {...editor} />
{/if}

<style>
	.pcc { display: grid; gap: 18px; align-items: start; }
	.pcc__editor { min-width: 0; }
	/* sotto l'editor (schermi stretti) il pannello non si allarga a tutta pagina */
	.pcc__pannello { min-width: 0; display: grid; gap: 6px; width: 100%; max-width: 620px; }
	.pcc__chiudi { justify-self: end; border: 0; background: transparent; color: var(--muted); font: inherit; font-size: 12px; cursor: pointer; padding: 0 4px; }
	.pcc__apri { position: fixed; right: 18px; bottom: 18px; z-index: 30; border: 0; border-radius: 999px; padding: 12px 18px; font: inherit; font-weight: 800; background: var(--navy); color: #fff; cursor: pointer; box-shadow: 0 8px 24px rgba(5, 5, 56, .3); }
	/* schermo largo: pannello a destra, fermo mentre si scorre l'editor */
	@media (min-width: 1500px) {
		.pcc:not(.is-chiuso) { grid-template-columns: minmax(0, 1fr) 430px; }
		.pcc__pannello { max-width: none; position: sticky; top: 10px; max-height: calc(100vh - 20px); overflow-y: auto; padding-right: 2px; }
	}
</style>
