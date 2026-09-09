<script lang="ts">
	/**
	 * Kit di adesivi: bustina trasparente con cavallotto personalizzato e fino a 6 adesivi.
	 * Stesso schema degli altri preventivatori (anteprima a sinistra, passaggi a destra, riepilogo
	 * sotto). Passaggi: materiale (uno per tutto il kit) → cavallotto → adesivi → quantita'.
	 * Ogni file passa da un popup con il motore degli adesivi personalizzati (bordo, sfondo, zoom,
	 * misura); alla conferma l'adesivo cade nella bustina, dove si puo' spostare col mouse.
	 */
	import { goto } from '$app/navigation';
	import { addToCart } from '$lib/cart';
	import { saveCartFile, saveCartPreview } from '$lib/utils/draftStore';
	import { kitQuote, KIT_QTY, KIT_SIZES, KIT_MAX } from '$lib/pricing/kit';
	import type { EngineConfig } from '$lib/pricing/engine';
	import EnginePreview from './EnginePreview.svelte';

	let { cfg, shipDate }: { cfg: EngineConfig; shipDate: string } = $props();

	/* misure del cavallotto (linguetta piegata: il fronte e' 80 x 40 mm) */
	const CAV = { w: 80, h: 40 };
	type Render = { png: string; w: number; h: number };
	type Slot = { file: File | null; png: string | null; w: number; h: number; misura: number; x: number; y: number; rot: number; dropped: boolean; landed: boolean; busy: boolean };
	const blank = (): Slot => ({ file: null, png: null, w: 0, h: 0, misura: 50, x: 0, y: 0, rot: 0, dropped: false, landed: false, busy: false });
	let slots = $state<Slot[]>(Array.from({ length: KIT_MAX }, blank));
	let cav = $state<{ file: File | null; png: string | null }>({ file: null, png: null });
	const MATERIALS = $derived(cfg.materials.filter((m) => m.visible));
	const FINISHES = $derived(cfg.finishes.filter((f) => f.visible));
	let materiale = $state('bianco');
	let finitura = $state('lucida');
	let qty = $state(50);
	let vatIncluded = $state(true);
	let step = $state<'materiale' | 'cavallotto' | 'adesivi' | 'qty'>('materiale');
	const STEPS = ['materiale', 'cavallotto', 'adesivi', 'qty'] as const;
	const stepNo = (s: string) => STEPS.indexOf(s as (typeof STEPS)[number]) + 1;
	let adding = $state(false);
	let flash = $state('');
	$effect(() => { if (!MATERIALS.some((m) => m.id === materiale)) materiale = MATERIALS[0]?.id ?? 'bianco'; if (!FINISHES.some((f) => f.id === finitura)) finitura = FINISHES.find((f) => f.laminate)?.id ?? FINISHES[0]?.id ?? 'nessuna'; });
	const material = $derived(MATERIALS.find((m) => m.id === materiale));
	const finish = $derived(FINISHES.find((f) => f.id === finitura));
	const filled = $derived(slots.filter((s) => s.file));
	const n = $derived(filled.length);
	const misuraMedia = $derived(n ? Math.round(filled.reduce((a, s) => a + s.misura, 0) / n) : 50);
	const q = $derived(kitQuote(cfg, { materiale, finitura, misura: misuraMedia, n: Math.max(1, n), qty }));
	const ready = $derived(n > 0 && !!cav.png && slots.every((s) => !s.busy));
	const eur0 = (v: number) => v.toLocaleString('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
	const eur2 = (v: number) => v.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' });
	const progress = $derived((stepNo(step) / STEPS.length) * 100);

	/* ---- popup con il motore: cavallotto o adesivo ---- */
	type Pop = { kind: 'cav' | 'sticker'; index: number; file: File; misura: number; w: number; h: number; ratio: number; last: Render | null; busy: boolean };
	let pop = $state<Pop | null>(null);
	const ACCEPT = 'image/png,image/jpeg,image/svg+xml,application/pdf';
	function ok(f: File) { return /^image\//.test(f.type) || /\.(pdf|svg|png|jpe?g|webp)$/i.test(f.name); }
	function openPop(kind: 'cav' | 'sticker', index: number, file: File) {
		if (!ok(file)) return;
		const misura = kind === 'sticker' ? (slots[index]?.misura || 50) : CAV.w;
		pop = { kind, index, file, misura, w: kind === 'cav' ? CAV.w : misura, h: kind === 'cav' ? CAV.h : Math.round(misura * 0.8), ratio: 0, last: null, busy: true };
	}
	function popRender(r: { png: string | null; name?: string | null; w: number; h: number }) {
		if (!pop || !r.png) return;
		if (r.name && r.name !== baseName(pop.file)) return;
		pop.last = { png: r.png, w: r.w, h: r.h }; pop.busy = false;
		if (pop.kind === 'sticker' && r.w > 0 && r.h > 0 && !pop.ratio) { pop.ratio = r.w / r.h; setPopSize(pop.misura); }
	}
	function setPopSize(m: number) {
		if (!pop) return;
		pop.misura = m;
		const r = pop.ratio || 1.25;
		if (r >= 1) { pop.w = m; pop.h = Math.round((m / r) * 2) / 2; } else { pop.h = m; pop.w = Math.round(m * r * 2) / 2; }
		pop.busy = true;
	}
	function confirmPop() {
		if (!pop?.last) return;
		if (pop.kind === 'cav') { cav = { file: pop.file, png: pop.last.png }; pop = null; if (step === 'cavallotto') step = 'adesivi'; return; }
		const s = slots[pop.index];
		s.file = pop.file; s.png = pop.last.png; s.w = pop.last.w; s.h = pop.last.h; s.misura = pop.misura;
		s.rot = Math.round((Math.random() * 24 - 12) * 10) / 10;
		s.x = Math.round(Math.random() * 30 - 15); s.y = -Math.min(5, filled.length - 1) * 7;
		s.dropped = true; s.landed = false;
		const idx = pop.index; setTimeout(() => { if (slots[idx]?.file === s.file) slots[idx].landed = true; }, 1300);   /* anche senza animazione (riduci movimento) */
		pop = null;
		if (n >= KIT_MAX && step === 'adesivi') step = 'qty';
	}
	const baseName = (f: File) => f.name.replace(/\.[^.]+$/, '');

	/* ---- caricamento ---- */
	function pickCav(e: Event) { const f = (e.currentTarget as HTMLInputElement).files?.[0]; (e.currentTarget as HTMLInputElement).value = ''; if (f) openPop('cav', 0, f); }
	function pickSlot(e: Event, i: number) { const f = (e.currentTarget as HTMLInputElement).files?.[0]; (e.currentTarget as HTMLInputElement).value = ''; if (f) openPop('sticker', i, f); }
	function removeSticker(i: number) { slots[i] = blank(); }
	let over = $state(false);
	/** file trascinati sulla bustina: si apre il popup per il primo, gli altri restano in attesa */
	let pending: File[] = [];
	function onDrop(e: DragEvent) {
		e.preventDefault(); over = false;
		const list = Array.from(e.dataTransfer?.files ?? []).filter(ok);
		if (!list.length) return;
		if (!cav.png && step !== 'adesivi') { openPop('cav', 0, list[0]); pending = list.slice(1); return; }
		pending = list; nextPending();
	}
	function nextPending() {
		if (pop) return;
		const f = pending.shift(); if (!f) return;
		const i = slots.findIndex((s) => !s.file);
		if (i < 0) { flash = 'Il kit è completo: 6 adesivi.'; pending = []; return; }
		openPop('sticker', i, f);
	}
	$effect(() => { if (!pop && pending.length) setTimeout(nextPending, 250); });

	/* ---- materiale cambiato dopo i caricamenti: si rifanno adesivi e cavallotto in coda, con un motore nascosto ---- */
	let job = $state<{ kind: 'cav' | 'sticker'; index: number; file: File; w: number; h: number } | null>(null);
	let queue: { kind: 'cav' | 'sticker'; index: number }[] = [];
	let guard: ReturnType<typeof setTimeout> | undefined;
	function pump() {
		if (job) return;
		const j = queue.shift(); if (!j) return;
		if (j.kind === 'cav') { if (!cav.file) { pump(); return; } job = { ...j, file: cav.file, w: CAV.w, h: CAV.h }; }
		else { const s = slots[j.index]; if (!s?.file) { pump(); return; } s.busy = true; job = { ...j, file: s.file, w: s.w || s.misura, h: s.h || s.misura }; }
		clearTimeout(guard); guard = setTimeout(() => { if (job) { if (job.kind === 'sticker') slots[job.index].busy = false; job = null; pump(); } }, 25000);
	}
	function jobRender(r: { png: string | null; name?: string | null; w: number; h: number }) {
		if (!job || !r.png) return;
		if (r.name && r.name !== baseName(job.file)) return;
		if (job.kind === 'cav') cav.png = r.png; else { const s = slots[job.index]; s.png = r.png; s.w = r.w; s.h = r.h; s.busy = false; }
		clearTimeout(guard); job = null; pump();
	}
	let lastMat = '';
	$effect(() => {
		const key = `${materiale}|${finitura}`;
		if (key === lastMat) return;
		const first = lastMat === ''; lastMat = key;
		if (first) return;
		queue = []; if (cav.file) queue.push({ kind: 'cav', index: 0 }); slots.forEach((s, i) => { if (s.file) queue.push({ kind: 'sticker', index: i }); });
		pump();
	});

	/* ---- adesivi trascinabili dentro la bustina ---- */
	let inner = $state<HTMLDivElement | undefined>();
	let drag: { i: number; sx: number; sy: number; x0: number; y0: number } | null = null;
	let top = $state(10);
	function down(e: PointerEvent, i: number) {
		const s = slots[i]; if (!s.landed) return;
		(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
		drag = { i, sx: e.clientX, sy: e.clientY, x0: s.x, y0: s.y };
		top += 1; (e.currentTarget as HTMLElement).style.zIndex = String(top);
		e.preventDefault();
	}
	function move(e: PointerEvent) {
		if (!drag || !inner) return;
		const W = inner.clientWidth, H = inner.clientHeight;
		const x = drag.x0 + ((e.clientX - drag.sx) / W) * 100, y = drag.y0 + ((e.clientY - drag.sy) / H) * 100;
		slots[drag.i].x = Math.max(-34, Math.min(34, x)); slots[drag.i].y = Math.max(-62, Math.min(6, y));
	}
	function up() { drag = null; }

	/* ---- foto del kit per carrello e ordine ---- */
	async function kitPhoto(): Promise<Blob | null> {
		const W = 900, H = 1100, c = document.createElement('canvas'); c.width = W; c.height = H;
		const g = c.getContext('2d'); if (!g) return null;
		g.fillStyle = '#f4f5f8'; g.fillRect(0, 0, W, H);
		const bx = 150, by = 210, bw = 600, bh = 800;
		const rr = (x: number, y: number, w: number, h: number, r: number) => { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); };
		g.save(); g.shadowColor = 'rgba(0,0,0,0.18)'; g.shadowBlur = 40; g.shadowOffsetY = 18; rr(bx, by, bw, bh, 26); g.fillStyle = 'rgba(255,255,255,0.72)'; g.fill(); g.restore();
		const imgs = await Promise.all(filled.map((s) => load(s.png!)));
		g.save(); rr(bx + 6, by + 6, bw - 12, bh - 12, 22); g.clip();
		imgs.forEach((im, k) => { const s = filled[k]; const sw = bw * 0.62, sh = sw * (im.height / im.width); const cx = bx + bw / 2 + (s.x / 100) * bw, cy = by + bh - sh / 2 - 70 + (s.y / 100) * bh; g.save(); g.translate(cx, cy); g.rotate((s.rot * Math.PI) / 180); g.shadowColor = 'rgba(0,0,0,0.25)'; g.shadowBlur = 14; g.shadowOffsetY = 6; g.drawImage(im, -sw / 2, -sh / 2, sw, sh); g.restore(); });
		g.restore();
		g.save(); rr(bx, by, bw, bh, 26); g.clip(); const gr = g.createLinearGradient(bx, by, bx + bw, by + bh); gr.addColorStop(0, 'rgba(255,255,255,0.55)'); gr.addColorStop(0.35, 'rgba(255,255,255,0.05)'); gr.addColorStop(0.6, 'rgba(255,255,255,0.28)'); gr.addColorStop(1, 'rgba(255,255,255,0.05)'); g.fillStyle = gr; g.fillRect(bx, by, bw, bh); g.restore();
		rr(bx, by, bw, bh, 26); g.strokeStyle = 'rgba(0,0,0,0.12)'; g.lineWidth = 2; g.stroke();
		const cw = bw + 8, ch = Math.round((cw * CAV.h) / CAV.w), cx0 = bx - 4, cy0 = by - 60;
		g.save(); g.shadowColor = 'rgba(0,0,0,0.22)'; g.shadowBlur = 18; g.shadowOffsetY = 8; rr(cx0, cy0, cw, ch, 14); g.fillStyle = '#fff'; g.fill(); g.restore();
		if (cav.png) { try { const im = await load(cav.png); g.save(); rr(cx0, cy0, cw, ch, 14); g.clip(); g.drawImage(im, cx0, cy0, cw, ch); g.restore(); } catch { /* senza immagine */ } }
		g.beginPath(); g.arc(cx0 + cw / 2, cy0 + 26, 11, 0, Math.PI * 2); g.fillStyle = '#f4f5f8'; g.fill(); g.strokeStyle = 'rgba(0,0,0,0.15)'; g.stroke();
		return new Promise((r) => c.toBlob(r, 'image/png'));
	}
	const load = (src: string) => new Promise<HTMLImageElement>((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = src; });

	async function addKit() {
		if (!ready || adding) return;
		adding = true;
		try {
			const photo = await kitPhoto();
			const quote = kitQuote(cfg, { materiale, finitura, misura: misuraMedia, n, qty });
			const item = addToCart({ product: 'kit_adesivi', productName: 'Kit di adesivi', engineProduct: 'sticker', forma: `kit${n}`, materiale, finitura, w: misuraMedia, h: misuraMedia, qty, net: quote.net, gross: quote.gross, fileName: `cavallotto + ${n} adesivi` });
			if (cav.file) { await saveCartFile(item.id, cav.file); await saveCartFile(item.id + ':cav', cav.file); }
			let k = 0; for (const s of slots) if (s.file) { k++; await saveCartFile(`${item.id}:s${k}`, s.file); }
			if (photo) await saveCartPreview(item.id, photo);
			await goto('/checkout');
		} finally { adding = false; }
	}
</script>

<section class="cfg kitcfg" id="configura">
	<!-- ANTEPRIMA: la bustina -->
	<div class="cfg__preview kit__preview">
		<div class="kit__stage" class:is-over={over} role="region" aria-label="Anteprima del kit" ondragover={(e) => { e.preventDefault(); over = true; }} ondragleave={() => (over = false)} ondrop={onDrop}>
			<div class="bag">
				<label class="cav" class:has={!!cav.png} title="Carica il file del cavallotto">
					<input type="file" hidden accept={ACCEPT} onchange={pickCav} />
					{#if cav.png}<img src={cav.png} alt="Cavallotto" />{:else}<span class="cav__plus">+</span><span class="cav__txt">Carica il cavallotto</span>{/if}
					<i class="cav__hole"></i>
				</label>
				<div class="bag__body">
					<i class="bag__zip"></i>
					<div class="bag__inner" role="presentation" bind:this={inner} onpointermove={move} onpointerup={up} onpointercancel={up}>
						{#each slots as s, i (i)}
							{#if s.png}
								<img class="stk" class:drop={s.dropped && !s.landed} class:grab={s.landed} src={s.png} alt="Adesivo {i + 1}" draggable="false" style="--rot:{s.rot}deg; --x:{s.x}%; --y:{s.y}%; --k:{filled.indexOf(s)}" onanimationend={() => (slots[i].landed = true)} onpointerdown={(e) => down(e, i)} />
							{/if}
						{/each}
						{#if !n}<p class="bag__hint">Trascina qui i file degli adesivi<br /><small>uno per ogni adesivo, fino a 6</small></p>{/if}
					</div>
					<i class="bag__shine"></i>
					<i class="bag__fold"></i>
				</div>
			</div>
			{#if n}<p class="kit__tip">Puoi spostare gli adesivi nella bustina con il mouse.</p>{/if}
		</div>
	</div>

	<!-- PASSAGGI -->
	<aside class="cfg__steps">
		<div class="cfg__head">
			<div><p class="eyebrow">Configura in 30 secondi</p><h2 class="cfg__title">Crea il tuo Kit di adesivi</h2></div>
			<span class="cfg__stepcount">Passaggio {stepNo(step)} di {STEPS.length}</span>
		</div>
		<div class="progress"><span style="width:{progress}%"></span></div>

		<!-- 1 materiale -->
		<div class="step" class:is-open={step === 'materiale'}>
			<button class="step__head" type="button" onclick={() => (step = 'materiale')} aria-expanded={step === 'materiale'}>
				<span class="step__n">{#if stepNo(step) > 1}✓{:else}1{/if}</span>
				<span class="step__title">Su che materiale stampiamo? {#if step !== 'materiale'}<em>{material?.label}{#if finish && FINISHES.length > 1}, {finish.label}{/if}</em>{/if}</span>
				<span class="step__edit">{step === 'materiale' ? '' : 'Modifica'}</span>
			</button>
			{#if step === 'materiale'}
				<div class="step__body">
					<p class="step__hint">Un materiale per tutto il kit: tutti gli adesivi escono uguali. Il bianco va bene quasi sempre.</p>
					<div class="pic-grid pic-grid--3 pic-grid--sm">
						{#each MATERIALS as m (m.id)}
							<button type="button" class="pic" class:is-active={materiale === m.id} onclick={() => { materiale = m.id; step = cav.png ? 'adesivi' : 'cavallotto'; }}>
								<img src={m.img} alt="" /><b>{m.label}</b>{#if m.tag}<span class="pic__tag">{m.tag}</span>{/if}
							</button>
						{/each}
					</div>
					{#if FINISHES.length > 1}
						<p class="step__hint" style="margin-top:12px">{cfg.finishTitle ?? 'Lamina protettiva'}</p>
						<div class="kit__chips">{#each FINISHES as f (f.id)}<button type="button" class="chip" class:is-on={finitura === f.id} onclick={() => (finitura = f.id)}>{f.label}</button>{/each}</div>
					{/if}
				</div>
			{/if}
		</div>

		<!-- 2 cavallotto -->
		<div class="step" class:is-open={step === 'cavallotto'}>
			<button class="step__head" type="button" onclick={() => (step = 'cavallotto')} aria-expanded={step === 'cavallotto'}>
				<span class="step__n">{#if cav.png}✓{:else}2{/if}</span>
				<span class="step__title">Il cavallotto {#if step !== 'cavallotto'}<em>{cav.file ? cav.file.name : 'da caricare'}</em>{/if}</span>
				<span class="step__edit">{step === 'cavallotto' ? '' : 'Modifica'}</span>
			</button>
			{#if step === 'cavallotto'}
				<div class="step__body">
					<p class="step__hint">La linguetta in cima alla bustina, {CAV.w} × {CAV.h} mm: logo, grafica o nome. Lo impaginiamo noi sul fronte.</p>
					<label class="kit__cav" class:has={!!cav.png}>
						<input type="file" hidden accept={ACCEPT} onchange={pickCav} />
						{#if cav.png}<img src={cav.png} alt="" /><span>{cav.file?.name}</span><b>Cambia</b>{:else}<span class="kit__plus">+</span><span>Carica il file del cavallotto</span>{/if}
					</label>
					{#if cav.png}<button type="button" class="btn btn--blue btn--sm" style="margin-top:12px" onclick={() => (step = 'adesivi')}>Avanti: gli adesivi →</button>{/if}
				</div>
			{/if}
		</div>

		<!-- 3 adesivi -->
		<div class="step" class:is-open={step === 'adesivi'}>
			<button class="step__head" type="button" onclick={() => (step = 'adesivi')} aria-expanded={step === 'adesivi'}>
				<span class="step__n">{#if n > 0 && step !== 'adesivi'}✓{:else}3{/if}</span>
				<span class="step__title">Gli adesivi {#if step !== 'adesivi'}<em>{n} di {KIT_MAX}</em>{/if}</span>
				<span class="step__edit">{step === 'adesivi' ? '' : 'Modifica'}</span>
			</button>
			{#if step === 'adesivi'}
				<div class="step__body">
					<p class="step__hint">Un file per ogni adesivo, fino a {KIT_MAX}. Per ciascuno scegli bordo, sfondo e misura, poi lo vedi cadere nella bustina.</p>
					<div class="kit__slots">
						{#each slots as s, i (i)}
							<label class="slot" class:has={!!s.file} class:busy={s.busy}>
								<input type="file" hidden accept={ACCEPT} onchange={(e) => pickSlot(e, i)} />
								{#if s.png}<img src={s.png} alt="" />{:else}<span class="slot__plus">+</span>{/if}
								<em>{i + 1}</em>
								{#if s.file}<button type="button" class="slot__x" aria-label="Togli" onclick={(e) => { e.preventDefault(); removeSticker(i); }}>✕</button>{/if}
							</label>
						{/each}
					</div>
					{#if flash}<p class="kit__flash">{flash}</p>{/if}
					{#if n}<button type="button" class="btn btn--blue btn--sm" style="margin-top:12px" onclick={() => (step = 'qty')}>Avanti: quanti kit →</button>{/if}
				</div>
			{/if}
		</div>

		<!-- 4 quantita' -->
		<div class="step step--qty" class:is-open={step === 'qty'}>
			<button class="step__head" type="button" onclick={() => (step = 'qty')} aria-expanded={step === 'qty'}>
				<span class="step__n">4</span>
				<span class="step__title">Quanti kit <em>{qty.toLocaleString('it-IT')} kit · {eur0(vatIncluded ? q.gross : q.net)}</em></span>
				<span class="step__edit">{step === 'qty' ? '' : 'Modifica'}</span>
			</button>
			{#if step === 'qty'}
				<div class="step__body">
					<div class="qty-grid">
						{#each KIT_QTY as k (k)}
							{@const qq = kitQuote(cfg, { materiale, finitura, misura: misuraMedia, n: Math.max(1, n), qty: k })}
							<button type="button" class="qty" class:is-active={qty === k} onclick={() => (qty = k)}>
								<span class="qty__top"><b>{k.toLocaleString('it-IT')}</b><b>{eur0(vatIncluded ? qq.gross : qq.net)}</b></span>
								<span class="qty__bottom">{(vatIncluded ? qq.perKitGross : qq.perKitNet).toFixed(2).replace('.', ',')} €/kit</span>
							</button>
						{/each}
					</div>
					<p class="step__hint">Il prezzo del kit dipende da quanti adesivi ci metti dentro: ora {Math.max(1, n)}.</p>
				</div>
			{/if}
		</div>
	</aside>

	<!-- RIEPILOGO: spedizione, credito, totale, come negli altri preventivatori -->
	<div class="cfg__summary">
		<div class="sum sum--ship"><span class="sum__ico">🚀</span><div class="sum__text"><span class="sum__label">Spedizione stimata</span><span class="sum__value">{shipDate}</span><span class="sum__sub">Corriere espresso tracciato</span></div></div>
		<div class="sum sum--credit"><span class="sum__ico"><img src="/images/coin-sp.png" alt="Credito Stickerprint" /></span><div class="sum__text"><span class="sum__label">Guadagni in credito</span><span class="sum__value">{eur2(q.net * cfg.creditRate)}</span><span class="sum__sub">da usare sul prossimo ordine</span></div></div>
		<div class="sum sum--total">
			<div class="sum__text">
				<span class="sum__label">Totale {vatIncluded ? 'IVA inclusa' : 'IVA esclusa'}</span>
				<span class="sum__value sum__value--big">{eur0(vatIncluded ? q.gross : q.net)}</span>
				<div class="vat-toggle"><span class:active={!vatIncluded}>IVA esclusa</span><button type="button" class="switch" class:on={vatIncluded} role="switch" aria-checked={vatIncluded} aria-label="Mostra prezzi IVA inclusa" onclick={() => (vatIncluded = !vatIncluded)}><i></i></button><span class:active={vatIncluded}>IVA inclusa</span></div>
			</div>
			<span class="sum__per">{(vatIncluded ? q.perKitGross : q.perKitNet).toFixed(2).replace('.', ',')} €/kit</span>
		</div>
		<button class="btn btn--green btn--cart" type="button" onclick={addKit} disabled={!ready || adding} title={ready ? '' : 'Carica cavallotto e almeno un adesivo'}>{adding ? 'Un attimo…' : ready ? 'Aggiungi al carrello →' : !cav.png ? 'Carica il cavallotto' : !n ? 'Carica almeno un adesivo' : 'Un attimo…'}</button>
	</div>
</section>

<!-- POPUP: il motore per il file appena caricato (bordo, sfondo, zoom dal pannello del motore; misura qui sotto) -->
{#if pop}
	<div class="modal-backdrop" role="dialog" aria-modal="true" aria-label={pop.kind === 'cav' ? 'Cavallotto' : 'Adesivo'}>
		<div class="modal kit__modal">
			<button type="button" class="modal__close" aria-label="Chiudi" onclick={() => (pop = null)}>✕</button>
			<h3>{pop.kind === 'cav' ? 'Il cavallotto' : `Adesivo ${pop.index + 1}`} <small>{pop.file.name}</small></h3>
			<div class="kit__modal-engine">
				<EnginePreview file={pop.file} forma={pop.kind === 'cav' ? 'rettangolare' : 'sagomato'} {materiale} {finitura} prodotto="sticker" w={pop.w} h={pop.h} panel showCut={false} stage={340} onrender={popRender} />
			</div>
			{#if pop.kind === 'sticker'}
				<p class="step__hint">Misura dell'adesivo (lato lungo)</p>
				<div class="kit__chips">{#each KIT_SIZES as m (m)}<button type="button" class="chip" class:is-on={pop.misura === m} onclick={() => setPopSize(m)}>{m} mm</button>{/each}</div>
				{#if pop.last}<p class="step__hint">Esce {pop.last.w.toFixed(1).replace('.', ',')} × {pop.last.h.toFixed(1).replace('.', ',')} mm con il bordo.</p>{/if}
			{:else}
				<p class="step__hint">Il cavallotto è {CAV.w} × {CAV.h} mm. Sposta o ingrandisci la grafica con i comandi sotto l'anteprima.</p>
			{/if}
			<div class="kit__modal-actions">
				<button type="button" class="btn btn--sm" onclick={() => (pop = null)}>Annulla</button>
				<button type="button" class="btn btn--green" disabled={pop.busy || !pop.last} onclick={confirmPop}>{pop.busy ? 'Preparo l’anteprima…' : pop.kind === 'cav' ? 'Conferma il cavallotto' : 'Conferma: mettilo nella bustina'}</button>
			</div>
		</div>
	</div>
{/if}

<!-- motore nascosto: rifa' adesivi e cavallotto quando cambia il materiale -->
{#if job}
	<div class="kit__engine" aria-hidden="true">
		<EnginePreview file={job.file} forma={job.kind === 'cav' ? 'rettangolare' : 'sagomato'} {materiale} {finitura} prodotto="sticker" w={job.w} h={job.h} showCut={false} stage={260} onrender={jobRender} />
	</div>
{/if}
