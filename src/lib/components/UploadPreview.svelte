<script lang="ts">
	/**
	 * Anteprima automatica (beta): mostra subito il file caricato come adesivo
	 * con bordo bianco e ombra. Il calcolo della sagoma/linea di taglio reale
	 * avverrà lato server nel configuratore; qui è solo l'esperienza istantanea.
	 */
	let file: File | null = $state(null);
	let url: string | null = $state(null);
	let over = $state(false);
	let widthMm = $state(80);
	let heightMm = $state(0);
	let error = $state('');

	const ACCEPT = ['image/png', 'image/jpeg', 'image/svg+xml'];

	function pick(f: File | undefined) {
		error = '';
		if (!f) return;
		if (!ACCEPT.includes(f.type)) {
			error = 'Per l’anteprima istantanea usa PNG, JPG o SVG. PDF e AI li lavoriamo noi nel configuratore.';
			return;
		}
		if (f.size > 25 * 1024 * 1024) {
			error = 'Il file supera i 25 MB.';
			return;
		}
		if (url) URL.revokeObjectURL(url);
		file = f;
		url = URL.createObjectURL(f);
	}

	function onLoad(e: Event) {
		const img = e.currentTarget as HTMLImageElement;
		heightMm = Math.round((widthMm * img.naturalHeight) / img.naturalWidth);
	}

	function reset() {
		if (url) URL.revokeObjectURL(url);
		file = null;
		url = null;
	}
</script>

{#if !file}
	<label
		class="dropzone"
		class:is-over={over}
		ondragenter={(e) => { e.preventDefault(); over = true; }}
		ondragover={(e) => { e.preventDefault(); over = true; }}
		ondragleave={() => (over = false)}
		ondrop={(e) => { e.preventDefault(); over = false; pick(e.dataTransfer?.files[0]); }}
	>
		<input type="file" accept={ACCEPT.join(',')} onchange={(e) => pick((e.currentTarget as HTMLInputElement).files?.[0])} />
		<div>
			<div class="dropzone__icon">
				<svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M12 16V4m0 0l-4 4m4-4l4 4" /><path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" /></svg>
			</div>
			<div class="dropzone__title">Trascina qui il tuo file</div>
			<div class="dropzone__sub">oppure clicca per sceglierlo · PNG, JPG, SVG con sfondo trasparente</div>
			{#if error}<p class="error" style="margin-top:14px">{error}</p>{/if}
		</div>
	</label>
{:else}
	<div class="preview-result">
		<div class="sticker-stage">
			<img class="sticker-img" src={url} alt="Anteprima del tuo adesivo" onload={onLoad} />
		</div>
		<div class="preview-result__meta">
			<span>{file.name}</span>
			<span>{widthMm} × {heightMm || '…'} mm</span>
			<span>Bordo bianco 2 mm</span>
		</div>
		<div class="preview-result__ctas">
			<a class="btn btn--blue" href="/adesivi-personalizzati">Continua l’ordine</a>
			<button class="btn btn--ghost btn--sm" type="button" onclick={reset}>Carica un altro file</button>
		</div>
	</div>
{/if}
