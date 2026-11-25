<script lang="ts">
	/* L'editor del preventivo con il blocco «Costi e margini» (Mattia, 25/11/2026): l'anagrafica diventa un blocco unico
	   che si chiude, i costi stanno subito sotto a tutta larghezza e gli articoli si compilano sotto ai costi. */
	import type { ComponentProps } from 'svelte';
	import OrderEditor from './OrderEditor.svelte';
	import CostiPreventivo from './CostiPreventivo.svelte';
	import { categoryOf, type OrderDraft, type ProductCode } from '$lib/dashboard/orderDraft';
	import type { Contesto } from '$lib/margini/preventivo';

	type DatiCosti = Omit<Contesto, 'prodottoDi'>;
	let { costi, ...editor }: ComponentProps<typeof OrderEditor> & { /** listini, codici, macchinari e calendario per il calcolo; senza, il blocco non compare */ costi?: DatiCosti | null } = $props();

	let rif = $state<ReturnType<typeof OrderEditor> | null>(null);
	// svelte-ignore state_referenced_locally
	let bozza = $state<OrderDraft>(editor.draft);
	const contesto = $derived<Contesto | null>(costi ? { ...costi, prodottoDi: (code: string) => categoryOf(code, editor.codes as ProductCode[]) } : null);
	/* il blocco si puo' nascondere: la scelta resta nel browser */
	let visibile = $state(true);
	$effect(() => { try { visibile = localStorage.getItem('sp-costi-preventivo') !== 'chiuso'; } catch { /* niente memoria */ } });
	function mostra(v: boolean) { visibile = v; try { localStorage.setItem('sp-costi-preventivo', v ? 'aperto' : 'chiuso'); } catch { /* niente memoria */ } }
</script>

{#if contesto}
	<OrderEditor bind:this={rif} {...editor} anagraficaUnica ondraft={(d) => (bozza = d)}>
		{#snippet dopoAnagrafica()}
			{#if visibile}
				<CostiPreventivo {bozza} {contesto} onmodifica={(fn) => rif?.modifica(fn)} onchiudi={() => mostra(false)} />
			{:else}
				<button type="button" class="pcc__apri" onclick={() => mostra(true)}>💰 Costi e margini <span>mostra ▾</span></button>
			{/if}
		{/snippet}
	</OrderEditor>
{:else}
	<OrderEditor {...editor} />
{/if}

<style>
	.pcc__apri { display: flex; justify-content: space-between; align-items: center; width: 100%; border: 1.5px dashed var(--line); border-radius: 14px; padding: 12px 16px; font: inherit; font-weight: 800; font-size: 14px; background: #fff; color: var(--ink); cursor: pointer; }
	.pcc__apri span { font-weight: 600; font-size: 12px; color: var(--muted); }
	.pcc__apri:hover { border-color: var(--blue); }
</style>
