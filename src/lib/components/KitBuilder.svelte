<script lang="ts">
	/**
	 * Kit di adesivi: bustina trasparente con cavallotto personalizzato e fino a 6 adesivi.
	 * Il cliente carica il file del cavallotto (si impagina sulla linguetta) e fino a 6 file di
	 * adesivi: ogni adesivo viene scontornato dal motore degli adesivi personalizzati (stesso
	 * identico motore, un'istanza nascosta che lavora in coda) e "cade" dentro la bustina.
	 * Materiale e misura sono unici per tutto il kit.
	 */
	import { goto } from '$app/navigation';
	import { addToCart } from '$lib/cart';
	import { saveCartFile, saveCartPreview } from '$lib/utils/draftStore';
	import { kitQuote, KIT_QTY, KIT_SIZES, KIT_MAX } from '$lib/pricing/kit';
	import type { EngineConfig } from '$lib/pricing/engine';
	import EnginePreview from './EnginePreview.svelte';

	let { cfg, shipDate }: { cfg: EngineConfig; shipDate: string } = $props();

	type Slot = { file: File | null; png: string | null; w: number; h: number; url: string | null; busy: boolean; rot: number; dx: number; dropped: boolean };
	const blank = (): Slot => ({ file: null, png: null, w: 0, h: 0, url: null, busy: false, rot: 0, dx: 0, dropped: false });
	let slots = $state<Slot[]>(Array.from({ length: KIT_MAX }, blank));
	let cavFile = $state<File | null>(null);
	let cavUrl = $state<string | null>(null);
	const MATERIALS = $derived(cfg.materials.filter((m) => m.visible));
	const FINISHES = $derived(cfg.finishes.filter((f) => f.visible));
	let materiale = $state('bianco');
	let finitura = $state('lucida');
	let misura = $state(50);
	let qty = $state(50);
	let flash = $state('');
	let adding = $state(false);
	$effect(() => { if (!MATERIALS.some((m) => m.id === materiale)) materiale = MATERIALS[0]?.id ?? 'bianco'; if (!FINISHES.some((f) => f.id === finitura)) finitura = FINISHES.find((f) => f.laminate)?.id ?? FINISHES[0]?.id ?? 'nessuna'; });

	const filled = $derived(slots.filter((s) => s.file));
	const n = $derived(filled.length);
	const quote = $derived(kitQuote(cfg, { materiale, finitura, misura, n: Math.max(1, n), qty }));
	const ready = $derived(n > 0 && !!cavFile && slots.every((s) => !s.busy));
	const eur = (v: number) => v.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' });

	/* ---- motore in coda: una sola istanza nascosta, un adesivo alla volta ---- */
	let engineFile = $state<File | null>(null);
	let engineSlot = -1;
	let queue: number[] = [];
	function enqueue(i: number) { if (!queue.includes(i)) queue.push(i); pump(); }
	function pump() {
		if (engineSlot >= 0) return;
		const i = queue.shift();
		if (i === undefined) return;
		const s = slots[i];
		if (!s?.file) { pump(); return; }
		engineSlot = i; s.busy = true;
		engineFile = null;
		queueMicrotask(() => { engineFile = s.file; });
	}
	function onRender(r: { png: string | null; w: number; h: number }) {
		const i = engineSlot; if (i < 0) return;
		const s = slots[i];
		if (s && r.png) { s.png = r.png; s.w = r.w; s.h = r.h; if (!s.dropped) { s.dropped = true; } }
		if (s) s.busy = false;
		engineSlot = -1;
		pump();
	}
	// materiale, lamina o misura nuovi: si rifanno tutti gli adesivi
	let lastCfg = '';
	$effect(() => {
		const key = `${materiale}|${finitura}|${misura}`;
		if (key === lastCfg) return; lastCfg = key;
		slots.forEach((s, i) => { if (s.file) enqueue(i); });
	});

	/* ---- caricamento ---- */
	const ACCEPT = 'image/*,.pdf,.svg';
	function ok(f: File) { return /^image\//.test(f.type) || /\.(pdf|svg|png|jpe?g|webp)$/i.test(f.name); }
	function setCav(f: File | null) {
		if (!f || !ok(f)) return;
		if (cavUrl) URL.revokeObjectURL(cavUrl);
		cavFile = f; cavUrl = URL.createObjectURL(f);
	}
	function setSticker(i: number, f: File | null) {
		if (!f || !ok(f)) return;
		const s = slots[i];
		s.file = f; s.png = null; s.dropped = false;
		s.rot = Math.round((Math.random() * 24 - 12) * 10) / 10;
		s.dx = Math.round((Math.random() * 30 - 15) * 10) / 10;
		enqueue(i);
	}
	function removeSticker(i: number) { slots[i] = blank(); queue = queue.filter((k) => k !== i); }
	/** file trascinati sulla bustina: il primo slot libero, poi i successivi, a cascata */
	function addMany(files: FileList | File[]) {
		const list = Array.from(files).filter(ok);
		if (!list.length) return;
		let k = 0;
		for (const f of list) {
			const i = slots.findIndex((s) => !s.file);
			if (i < 0) { flash = 'Il kit è completo: 6 adesivi.'; break; }
			setTimeout(() => setSticker(i, f), k * 350); k++;
			slots[i].file = f; // prenota lo slot
		}
	}
	let over = $state(false);
	function onDrop(e: DragEvent) { e.preventDefault(); over = false; if (e.dataTransfer?.files?.length) addMany(e.dataTransfer.files); }
	function pick(e: Event, i: number) { const f = (e.currentTarget as HTMLInputElement).files; if (!f?.length) return; if (f.length > 1) addMany(f); else setSticker(i, f[0]); (e.currentTarget as HTMLInputElement).value = ''; }
	function pickCav(e: Event) { const f = (e.currentTarget as HTMLInputElement).files?.[0]; setCav(f ?? null); (e.currentTarget as HTMLInputElement).value = ''; }

	/* ---- foto del kit per carrello e ordine: bustina, cavallotto e adesivi disegnati su tela ---- */
	async function kitPhoto(): Promise<Blob | null> {
		const W = 900, H = 1100, c = document.createElement('canvas'); c.width = W; c.height = H;
		const g = c.getContext('2d'); if (!g) return null;
		g.fillStyle = '#f4f5f8'; g.fillRect(0, 0, W, H);
		const bx = 150, by = 210, bw = 600, bh = 800;
		// bustina
		const rr = (x: number, y: number, w: number, h: number, r: number) => { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); };
		g.save(); g.shadowColor = 'rgba(0,0,0,0.18)'; g.shadowBlur = 40; g.shadowOffsetY = 18; rr(bx, by, bw, bh, 26); g.fillStyle = 'rgba(255,255,255,0.72)'; g.fill(); g.restore();
		// adesivi dentro
		const imgs = await Promise.all(filled.map((s) => load(s.png!)));
		g.save(); rr(bx + 6, by + 6, bw - 12, bh - 12, 22); g.clip();
		imgs.forEach((im, k) => { const s = filled[k]; const sw = bw * 0.62, sh = sw * (im.height / im.width); const cx = bx + bw / 2 + (s.dx / 100) * bw, cy = by + bh - sh / 2 - 70 - k * 44; g.save(); g.translate(cx, cy); g.rotate((s.rot * Math.PI) / 180); g.shadowColor = 'rgba(0,0,0,0.25)'; g.shadowBlur = 14; g.shadowOffsetY = 6; g.drawImage(im, -sw / 2, -sh / 2, sw, sh); g.restore(); });
		g.restore();
		// riflesso della plastica
		g.save(); rr(bx, by, bw, bh, 26); g.clip(); const gr = g.createLinearGradient(bx, by, bx + bw, by + bh); gr.addColorStop(0, 'rgba(255,255,255,0.55)'); gr.addColorStop(0.35, 'rgba(255,255,255,0.05)'); gr.addColorStop(0.6, 'rgba(255,255,255,0.28)'); gr.addColorStop(1, 'rgba(255,255,255,0.05)'); g.fillStyle = gr; g.fillRect(bx, by, bw, bh); g.restore();
		rr(bx, by, bw, bh, 26); g.strokeStyle = 'rgba(0,0,0,0.12)'; g.lineWidth = 2; g.stroke();
		// cavallotto
		const cw = bw + 8, ch = 190, cx0 = bx - 4, cy0 = by - 60;
		g.save(); g.shadowColor = 'rgba(0,0,0,0.22)'; g.shadowBlur = 18; g.shadowOffsetY = 8; rr(cx0, cy0, cw, ch, 14); g.fillStyle = '#fff'; g.fill(); g.restore();
		if (cavUrl) { try { const im = await load(cavUrl); g.save(); rr(cx0, cy0, cw, ch, 14); g.clip(); const k = Math.max(cw / im.width, ch / im.height); const iw = im.width * k, ih = im.height * k; g.drawImage(im, cx0 + (cw - iw) / 2, cy0 + (ch - ih) / 2, iw, ih); g.restore(); } catch { /* senza immagine */ } }
		g.beginPath(); g.arc(cx0 + cw / 2, cy0 + 28, 11, 0, Math.PI * 2); g.fillStyle = '#f4f5f8'; g.fill(); g.strokeStyle = 'rgba(0,0,0,0.15)'; g.stroke();
		return new Promise((r) => c.toBlob(r, 'image/png'));
	}
	const load = (src: string) => new Promise<HTMLImageElement>((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = src; });

	async function addKit() {
		if (!ready || adding) return;
		adding = true;
		try {
			const id = crypto.randomUUID();
			if (cavFile) await saveCartFile(id + ':cav', cavFile);
			let k = 0;
			for (const s of slots) if (s.file) { k++; await saveCartFile(`${id}:s${k}`, s.file); }
			const photo = await kitPhoto(); if (photo) await saveCartPreview(id, photo);
			const q = kitQuote(cfg, { materiale, finitura, misura, n, qty });
			const item = addToCart({ product: 'kit_adesivi', productName: 'Kit di adesivi', engineProduct: 'sticker', forma: `kit${n}`, materiale, finitura, w: misura, h: misura, qty, net: q.net, gross: q.gross, fileName: `cavallotto + ${n} adesivi` });
			// il carrello vuole il file sotto l'id della riga: per il kit e' il cavallotto
			if (cavFile) await saveCartFile(item.id, cavFile);
			if (photo) await saveCartPreview(item.id, photo);
			for (const key of [':cav', ...Array.from({ length: n }, (_, i) => `:s${i + 1}`)]) { const f = key === ':cav' ? cavFile : slots.filter((s) => s.file)[Number(key.slice(2)) - 1]?.file; if (f) await saveCartFile(item.id + key, f); }
			await goto('/checkout');
		} finally { adding = false; }
	}
</script>

<div class="kit">
	<!-- MOCKUP -->
	<div class="kit__stage" class:is-over={over} role="region" aria-label="Anteprima del kit" ondragover={(e) => { e.preventDefault(); over = true; }} ondragleave={() => (over = false)} ondrop={onDrop}>
		<div class="bag">
			<label class="cav" class:has={!!cavUrl} title="Carica il file del cavallotto">
				<input type="file" hidden accept={ACCEPT} onchange={pickCav} />
				{#if cavUrl}<img src={cavUrl} alt="Cavallotto" />{:else}<span class="cav__plus">+</span><span class="cav__txt">Carica il cavallotto</span>{/if}
				<i class="cav__hole"></i>
			</label>
			<div class="bag__body">
				<div class="bag__inner">
					{#each slots as s, i (i)}
						{#if s.png}
							<img class="stk" class:drop={s.dropped} src={s.png} alt="Adesivo {i + 1}" style="--rot:{s.rot}deg; --dx:{s.dx}%; --k:{filled.indexOf(s)}" />
						{/if}
					{/each}
					{#if !n}<p class="bag__hint">Trascina qui fino a 6 file<br /><small>uno per ogni adesivo</small></p>{/if}
				</div>
				<i class="bag__shine"></i>
			</div>
		</div>
		{#if slots.some((s) => s.busy)}<div class="kit__busy">Scontorno in corso…</div>{/if}
	</div>

	<!-- SLOT + OPZIONI -->
	<div class="kit__side">
		<h3>1 · Il cavallotto</h3>
		<p class="kit__p">La linguetta in cima alla bustina, con il tuo logo o la tua grafica.</p>
		<label class="kit__cav" class:has={!!cavUrl}>
			<input type="file" hidden accept={ACCEPT} onchange={pickCav} />
			{#if cavUrl}<img src={cavUrl} alt="" /><span>{cavFile?.name}</span><b>Cambia</b>{:else}<span class="kit__plus">+</span><span>Carica il file del cavallotto</span>{/if}
		</label>

		<h3>2 · Gli adesivi <small>{n}/{KIT_MAX}</small></h3>
		<p class="kit__p">Un file per ogni adesivo. Li scontorniamo noi, uno alla volta, e li vedi cadere nella bustina.</p>
		<div class="kit__slots">
			{#each slots as s, i (i)}
				<label class="slot" class:has={!!s.file} class:busy={s.busy}>
					<input type="file" hidden accept={ACCEPT} multiple onchange={(e) => pick(e, i)} />
					{#if s.png}<img src={s.png} alt="" />{:else if s.file}<span class="slot__wait">…</span>{:else}<span class="slot__plus">+</span>{/if}
					<em>{i + 1}</em>
					{#if s.file}<button type="button" class="slot__x" aria-label="Togli" onclick={(e) => { e.preventDefault(); removeSticker(i); }}>✕</button>{/if}
				</label>
			{/each}
		</div>
		{#if flash}<p class="kit__flash">{flash}</p>{/if}

		<h3>3 · Materiale</h3>
		<div class="kit__chips">
			{#each MATERIALS as m (m.id)}<button type="button" class="chip" class:is-on={materiale === m.id} onclick={() => (materiale = m.id)}>{m.label}</button>{/each}
		</div>
		{#if FINISHES.length > 1}
			<div class="kit__chips kit__chips--small">
				{#each FINISHES as f (f.id)}<button type="button" class="chip" class:is-on={finitura === f.id} onclick={() => (finitura = f.id)}>{f.label}</button>{/each}
			</div>
		{/if}

		<h3>4 · Misura degli adesivi</h3>
		<div class="kit__chips">
			{#each KIT_SIZES as s (s)}<button type="button" class="chip" class:is-on={misura === s} onclick={() => (misura = s)}>{s} mm</button>{/each}
		</div>
		<p class="kit__p small">Lato lungo di ogni adesivo. Tutti gli adesivi del kit hanno la stessa misura e lo stesso materiale.</p>

		<h3>5 · Quanti kit</h3>
		<div class="kit__chips">
			{#each KIT_QTY as q (q)}<button type="button" class="chip" class:is-on={qty === q} onclick={() => (qty = q)}>{q.toLocaleString('it-IT')}</button>{/each}
		</div>

		<div class="kit__price">
			<div><small>{qty.toLocaleString('it-IT')} kit · {Math.max(1, n)} {n === 1 ? 'adesivo' : 'adesivi'} · {misura} mm</small><b>{eur(quote.gross)}</b><small>{eur(quote.perKitGross)} a kit · IVA inclusa · spedizione stimata {shipDate}</small></div>
			<button type="button" class="btn btn--blue" disabled={!ready || adding} onclick={addKit}>{adding ? 'Un attimo…' : 'Aggiungi al carrello'}</button>
		</div>
		{#if !ready}<p class="kit__p small">{#if !cavFile}Manca il cavallotto.{:else if !n}Carica almeno un adesivo.{:else}Aspetta lo scontorno degli adesivi.{/if}</p>{/if}
	</div>
</div>

<!-- motore degli adesivi personalizzati, nascosto: scontorna un adesivo alla volta -->
<div class="kit__engine" aria-hidden="true">
	<EnginePreview file={engineFile} forma="sagomato" {materiale} {finitura} prodotto="sticker" w={misura} h={Math.round(misura * 0.8)} showCut={false} stage={260} onrender={onRender} />
</div>
