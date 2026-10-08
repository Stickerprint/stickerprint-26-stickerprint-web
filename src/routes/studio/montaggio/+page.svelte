<script lang="ts">
	/**
	 * Stickerprint Studio — MONTAGGIO.
	 *
	 * Un ordine con tre lavori diversi da 50 pezzi l'uno non merita tre strisce e tre avviamenti di
	 * macchina. Qui si caricano i soggetti uno dopo l'altro — ognuno col suo prodotto, la sua misura e
	 * la sua quantita' — e lo Studio li mette tutti sulla stessa striscia, con un file di stampa solo
	 * e un file di taglio solo.
	 *
	 * Le regole non cambiano rispetto alle pagine dei singoli prodotti: bordo e stacco dei fogli,
	 * testa di resinatura da 10 aghi, stacco fra i pezzi sciolti, 8% di pezzi in piu' per gli scarti.
	 * Quello che il montatore sceglie in piu' e' la GRIGLIA di ogni foglio (vedi `montaggio.ts`).
	 */
	import EnginePreview from '$lib/components/EnginePreview.svelte';
	import { STUDIO_PRODUCTS, studioProduct } from '$lib/studio/products';
	import { SHEET_RULES, STRIP_MATERIALS, type Placement, type Strip } from '$lib/studio/layout';
	import { montaStriscia, type Blocco, type Soggetto } from '$lib/studio/montaggio';
	import { MARKED_MARGIN, pageWidthFor, newJobId, buildXpf, DEFAULT_COND, type XpfGroup, type XpfJob } from '$lib/studio/graphtec';
	import { SPOTS } from '$lib/studio/spots';
	import { savedDataLink, grantDataLink, pickDataLink, writeXpf, type DataLinkDir } from '$lib/studio/datalink';

	const cutColor = (t: 'Passante' | 'CutContour') => SPOTS[t].rgb;

	const FORME = ['sagomato', 'tondo', 'ovale', 'quadrato', 'rettangolo'];
	const MATERIALI = ['bianco', 'trasparente', 'olografico', 'glitterato', 'argento', 'oro'];
	/** i prodotti che si possono montare: tutti quelli dello studio tranne i fogli gia' impaginati dal cliente */
	const PRODOTTI = STUDIO_PRODUCTS.filter((p) => !p.multi && !p.soon);
	/** sugli ordini si stampa l'8% in piu' dei pezzi chiesti, per coprire gli scarti (come nelle altre pagine) */
	const SCARTO = 0.08;
	/** oltre questa larghezza i crocini escono dalla bobina: il massimo che la Roland stampa e' 710 */
	const PAGINA_MAX = 710;

	interface Riga {
		id: number;
		prodotto: string;
		forma: string;
		materiale: string;
		file: File | null;
		nome: string;
		/** misura chiesta (mm); 0 = come viene dal file */
		w: number | '';
		h: number | '';
		qty: number | '';
		/* risultato del motore */
		stato: 'vuota' | 'attesa' | 'pronta' | 'errore';
		err: string;
		pathD: string;
		png: Uint8Array | null;
		cutW: number;
		cutH: number;
		bleed: number;
		nodi: number;
		anteprima: string;
	}

	let seq = 0;
	const nuova = (): Riga => ({
		id: ++seq, prodotto: PRODOTTI[0].id, forma: 'sagomato', materiale: 'bianco', file: null, nome: '',
		w: '', h: '', qty: 50, stato: 'vuota', err: '', pathD: '', png: null, cutW: 0, cutH: 0, bleed: 0, nodi: 0, anteprima: ''
	});
	let righe = $state<Riga[]>([nuova()]);
	let jobName = $state('');

	/* ---------------------------------------------------------------- striscia */
	let matId = $state(STRIP_MATERIALS[0].id);
	const mat = $derived(STRIP_MATERIALS.find((m) => m.id === matId) ?? STRIP_MATERIALS[0]);
	let pageW = $state(0);
	$effect(() => { if (!pageW) pageW = pageWidthFor(mat.width); });
	/* in montaggio le strisce sono lunghe: meglio lasciare spazio e farlo stringere all'operatore */
	let maxH = $state(1000);
	let gapBlocchi = $state(10);
	let regole = $state<'resinati' | 'etichette'>('resinati');

	/* ---------------------------------------------------------------- motore */
	let engine = $state<ReturnType<typeof EnginePreview> | undefined>();
	let attiva = $state<Riga | null>(null);
	let atteso: ((ok: boolean) => void) | null = null;
	let lavorando = $state(false);

	const pDi = (r: Riga) => studioProduct(r.prodotto) ?? PRODOTTI[0];

	function onRender(s: { png: string | null; w: number; h: number }) {
		if (atteso && s.png) { const f = atteso; atteso = null; f(true); }
	}

	/** aspetta che il motore abbia finito di disegnare il file appena messo */
	const aspettaMotore = (ms = 25000) =>
		new Promise<boolean>((ok) => {
			atteso = ok;
			setTimeout(() => { if (atteso === ok) { atteso = null; ok(false); } }, ms);
		});

	async function fit(d: string, shape: string | undefined, border: number) {
		if (shape !== 'diecut' || !d) return { d, nodes: (d.match(/[MLHVCAZmlhvca]/g) ?? []).length };
		const [{ fitPathD, samplePath }, { parsePath }] = await Promise.all([import('$lib/studio/fit'), import('$lib/studio/path')]);
		const b = border > 0 ? border : 1;
		const f = fitPathD(samplePath(parsePath(d)), {
			tolerance: Math.max(0.02, Math.min(0.15, Math.max(0.05, b * 0.25))),
			smooth: Math.max(0.01, Math.min(0.15, Math.max(0.05, b * 0.12))),
			cornerDeg: 55
		});
		return f.d ? { d: f.d, nodes: f.nodes } : { d, nodes: (d.match(/[MLHVCAZmlhvca]/g) ?? []).length };
	}

	/** manda un soggetto nel motore e ne tira fuori tracciato e grafica di stampa */
	async function prepara(r: Riga) {
		if (!r.file) { r.err = 'Manca il file del cliente.'; r.stato = 'errore'; return; }
		r.stato = 'attesa'; r.err = '';
		attiva = r;
		try {
			if (!(await aspettaMotore())) throw new Error('Il motore non ha risposto: riprova.');
			const g = await engine!.studio('geom');
			if (!g.pathD) throw new Error('Il motore non ha restituito il tracciato di taglio.');
			const t = await fit(g.pathD, g.shape, g.border ?? 1);
			const p = await engine!.studio('print', { dpi: 600, pathD: t.d });
			if (!p.blob || !p.cutW || !p.cutH) throw new Error('Il motore non ha restituito la grafica di stampa.');
			r.pathD = t.d; r.nodi = t.nodes;
			r.png = new Uint8Array(await p.blob.arrayBuffer());
			r.cutW = p.cutW; r.cutH = p.cutH; r.bleed = p.bleed ?? 0;
			const m = await engine!.studio('mockup', { px: 700, pathD: t.d });
			if (m.blob) { if (r.anteprima) URL.revokeObjectURL(r.anteprima); r.anteprima = URL.createObjectURL(m.blob); }
			r.stato = 'pronta';
		} catch (e) {
			r.stato = 'errore'; r.err = e instanceof Error ? e.message : String(e);
		} finally { attiva = null; }
	}

	async function preparaTutte() {
		lavorando = true;
		try { for (const r of righe) if (r.file && r.stato !== 'pronta') await prepara(r); } finally { lavorando = false; }
	}

	function scegli(r: Riga, f: File | null | undefined) {
		if (!f) return;
		r.file = f; r.nome = f.name.replace(/\.[^.]+$/, ''); r.stato = 'vuota'; r.err = ''; r.png = null;
		if (!jobName) jobName = r.nome;
	}

	/* ---------------------------------------------------------------- montaggio */
	const pronte = $derived(righe.filter((r) => r.stato === 'pronta' && r.png));
	const soggetti = $derived<Soggetto[]>(
		pronte.map((r) => {
			const P = pDi(r);
			const q = typeof r.qty === 'number' && r.qty > 0 ? Math.ceil(r.qty * (1 + SCARTO)) : 1;
			return {
				nome: r.nome || P.name, cutW: r.cutW, cutH: r.cutH, qty: q,
				modo: P.mode === 'fogli' ? 'fogli' : 'sciolti',
				rules: P.mode === 'fogli' ? SHEET_RULES[P.sheetRules ?? regole] : undefined,
				gap: 8
			};
		})
	);
	const monta = $derived(
		soggetti.length
			? montaStriscia(soggetti, { pageW: Math.min(PAGINA_MAX, +pageW || pageWidthFor(mat.width)), maxH: +maxH || 1000, margin: MARKED_MARGIN.x, marginY: MARKED_MARGIN.y, gapBlocchi: Math.max(5, +gapBlocchi || 10) })
			: null
	);

	/* ---------------------------------------------------------------- generazione */
	let busy = $state('');
	let esito = $state('');
	let errore = $state('');
	let dlDir = $state<DataLinkDir | null>(null);
	$effect(() => { void savedDataLink().then((d) => (dlDir = d)); });

	const download = (b: Blob, nome: string) => {
		const a = document.createElement('a');
		a.href = URL.createObjectURL(b); a.download = nome; a.click();
		setTimeout(() => URL.revokeObjectURL(a.href), 5000);
	};
	const safe = (s: string) => (s || 'montaggio').replace(/[\\/:*?"<>|]+/g, '-').trim().slice(0, 60);

	async function genera() {
		if (!monta?.ok) return;
		busy = 'gen'; esito = ''; errore = '';
		try {
			const { buildPdf } = await import('$lib/studio/pdf');
			const arts = pronte.map((r) => ({
				png: r.png!, cutW: r.cutW, cutH: r.cutH, bleed: r.bleed, pathD: r.pathD, pieceCut: pDi(r).pieceCut
			}));
			const pages: Strip[] = monta.strips.map((s) => ({
				w: s.w, h: s.h,
				pieces: s.blocchi.flatMap((b) => b.pieces.map((p): Placement => ({ ...p, a: b.soggetto }))),
				sheets: s.blocchi.filter((b) => b.foglio).map((b) => b.foglio!)
			}));
			const ids = pages.map(() => newJobId());
			const bytes = await buildPdf({
				title: `${jobName || 'montaggio'} — ${mat.label}`, arts, pages,
				pieceCut: arts[0].pieceCut, sheetCut: 'Passante', graphtecIds: ids
			});
			download(new Blob([bytes as BlobPart], { type: 'application/pdf' }), `${safe(jobName)}_montaggio.pdf`);

			/* il taglio: un gruppo per soggetto, ognuno con la sua condizione (mezzo taglio o passante) */
			const dir = dlDir && (await grantDataLink(dlDir)) ? dlDir : null;
			let scritti = 0;
			for (const [i, s] of monta.strips.entries()) {
				const groups: XpfGroup[] = pronte
					.map((r, k): XpfGroup => ({
						pathD: r.pathD, cutW: r.cutW, cutH: r.cutH,
						pieces: s.blocchi.filter((b) => b.soggetto === k).flatMap((b) => b.pieces),
						cond: pDi(r).pieceCut === 'Passante' ? DEFAULT_COND.through : DEFAULT_COND.half
					}))
					.filter((g) => g.pieces.length);
				const job: XpfJob = {
					id: ids[i], W: s.w, H: s.h, pathD: groups[0].pathD, cutW: groups[0].cutW, cutH: groups[0].cutH,
					pieces: groups[0].pieces, groups, sheets: pages[i].sheets,
					pieceCond: groups[0].cond ?? DEFAULT_COND.half, sheetCond: pages[i].sheets?.length ? DEFAULT_COND.through : null
				};
				const x = buildXpf(job);
				const nome = `${safe(jobName)}${monta.strips.length > 1 ? `-${i + 1}` : ''}_${ids[i]}.xpf`;
				if (dir) { await writeXpf(dir, nome, x); scritti++; }
				else download(new Blob([x as BlobPart], { type: 'application/octet-stream' }), nome);
			}
			esito = scritti
				? `Fatto: PDF scaricato e ${scritti} ${scritti === 1 ? 'taglio scritto' : 'tagli scritti'} in Data Link Server (${ids.join(', ')}).`
				: `Fatto: PDF e taglio scaricati (${ids.join(', ')}). Metti il .xpf nella cartella di Data Link Server.`;
		} catch (e) {
			errore = e instanceof Error ? e.message : String(e);
		} finally { busy = ''; }
	}

	async function collega() {
		try { dlDir = await pickDataLink(); } catch (e) { errore = e instanceof Error ? e.message : String(e); }
	}

	/* ---------------------------------------------------------------- anteprima */
	const colore = (i: number) => ['#0a95ff', '#f4b400', '#2fbf71', '#e84393', '#8e44ad', '#16a085'][i % 6];
	const strip0 = $derived(monta?.ok ? monta.strips[0] : null);
</script>

<svelte:head><title>Montaggio · Stickerprint Studio</title></svelte:head>

<div class="mo-head">
	<div>
		<h1>Montaggio</h1>
		<p class="mo-lead">Piu' soggetti sulla stessa striscia: un file di stampa, un file di taglio, un avviamento di macchina.</p>
	</div>
	<a class="btn btn--ghost" href="/studio">← Prodotti</a>
</div>

<div class="mo-wrap">
	<section class="mo-col">
		<div class="dcard">
			<div class="mo-row mo-row--top">
				<label class="mo-f mo-f--grow"><span>Nome lavoro / n. ordine</span><input class="input" bind:value={jobName} placeholder="SP00400" /></label>
				<button class="btn btn--blue" type="button" disabled={lavorando || !righe.some((r) => r.file && r.stato !== 'pronta')} onclick={preparaTutte}>
					{lavorando ? 'Leggo i file…' : 'Leggi i file'}
				</button>
			</div>
		</div>

		{#each righe as r, i (r.id)}
			<div class="dcard mo-sogg" style="--c:{colore(i)}">
				<div class="mo-row mo-row--head">
					<span class="mo-n">{i + 1}</span>
					<strong class="mo-nome">{r.nome || 'Soggetto senza file'}</strong>
					{#if r.stato === 'pronta'}<span class="mo-ok">✓ {r.cutW.toFixed(1)} × {r.cutH.toFixed(1)} mm · {r.nodi} punti</span>
					{:else if r.stato === 'attesa'}<span class="mo-wait">leggo il file…</span>
					{:else if r.stato === 'errore'}<span class="mo-err">{r.err}</span>{/if}
					{#if righe.length > 1}
						<button class="mo-x" type="button" aria-label="Togli il soggetto" onclick={() => (righe = righe.filter((x) => x.id !== r.id))}>✕</button>
					{/if}
				</div>

				<div class="mo-row">
					{#if r.anteprima}<img class="mo-thumb" src={r.anteprima} alt="" />{/if}
					<label class="mo-f mo-f--grow"><span>File del cliente</span>
						<input class="input" type="file" accept="image/*,.pdf,.svg" onchange={(e) => scegli(r, (e.currentTarget as HTMLInputElement).files?.[0])} /></label>
				</div>

				<div class="mo-row">
					<label class="mo-f"><span>Prodotto</span>
						<select class="input" bind:value={r.prodotto} onchange={() => (r.stato = 'vuota')}>
							{#each PRODOTTI as p (p.id)}<option value={p.id}>{p.name}</option>{/each}
						</select></label>
					<label class="mo-f"><span>Sagoma</span>
						<select class="input" bind:value={r.forma} onchange={() => (r.stato = 'vuota')}>
							{#each FORME as f (f)}<option value={f}>{f}</option>{/each}
						</select></label>
					<label class="mo-f"><span>Materiale</span>
						<select class="input" bind:value={r.materiale} onchange={() => (r.stato = 'vuota')}>
							{#each MATERIALI as m (m)}<option value={m}>{m}</option>{/each}
						</select></label>
				</div>

				<div class="mo-row">
					<label class="mo-f"><span>Larghezza (mm)</span><input class="input" type="number" min="5" step="0.1" bind:value={r.w} placeholder="dal file" onchange={() => (r.stato = 'vuota')} /></label>
					<label class="mo-f"><span>Altezza (mm)</span><input class="input" type="number" min="5" step="0.1" bind:value={r.h} placeholder="dal file" onchange={() => (r.stato = 'vuota')} /></label>
					<label class="mo-f"><span>Pezzi</span><input class="input" type="number" min="1" step="1" bind:value={r.qty} /></label>
					<button class="btn btn--ghost mo-prep" type="button" disabled={!r.file || r.stato === 'attesa'} onclick={() => prepara(r)}>
						{r.stato === 'pronta' ? 'Rileggi' : 'Leggi'}
					</button>
				</div>
				{#if typeof r.qty === 'number' && r.qty > 0}
					<p class="mo-note">Ne preparo {Math.ceil(r.qty * (1 + SCARTO))}: l'8% in piu' per gli scarti.</p>
				{/if}
			</div>
		{/each}

		<button class="btn btn--ghost mo-add" type="button" onclick={() => (righe = [...righe, nuova()])}>+ Aggiungi un soggetto</button>
	</section>

	<aside class="mo-col mo-col--side">
		<div class="dcard">
			<h3>La striscia</h3>
			<div class="mo-chips">
				{#each STRIP_MATERIALS as m (m.id)}
					<button type="button" class="mo-chip" class:is-on={matId === m.id} onclick={() => { matId = m.id; pageW = pageWidthFor(m.width); }}>{m.label}</button>
				{/each}
			</div>
			<label class="mo-f"><span>Larghezza della pagina (mm)</span>
				<input class="input" type="number" min="200" max={PAGINA_MAX} step="1" bind:value={pageW} /></label>
			<p class="mo-note">Cutting Master usa {pageWidthFor(mat.width)} mm sulla bobina da {mat.width / 10} cm. Si puo' arrivare a {PAGINA_MAX}: oltre, i crocini escono dal materiale.</p>
			<label class="mo-f"><span>Altezza massima (mm)</span><input class="input" type="number" min="100" step="10" bind:value={maxH} /></label>
			<label class="mo-f"><span>Stacco fra i soggetti (mm)</span><input class="input" type="number" min="5" step="1" bind:value={gapBlocchi} /></label>
			<label class="mo-f"><span>Regole del foglio</span>
				<select class="input" bind:value={regole}><option value="resinati">Resinati (bordo 12,5 · testa 10 aghi)</option><option value="etichette">Etichette (bordo 10)</option></select></label>
			<p class="mo-note">Vale per i prodotti a fogli che non hanno regole proprie.</p>
		</div>

		<div class="dcard">
			<h3>Anteprima</h3>
			{#if !soggetti.length}
				<p class="mo-note">Carica i file e premi <b>Leggi i file</b>: qui vedi come si dispongono sulla striscia.</p>
			{:else if monta && !monta.ok}
				<p class="mo-err">{monta.error}</p>
			{:else if strip0 && monta}
				{#each monta.strips as s, si (si)}
					<p class="mo-label">Striscia {si + 1}: <b>{s.w} × {s.h} mm</b></p>
					<svg class="mo-prev" viewBox="0 0 {s.w} {s.h}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Anteprima della striscia">
						<rect x="0" y="0" width={s.w} height={s.h} fill="#fff" stroke="#c9d2dd" stroke-width="1" />
						{#each s.blocchi as b (b.x + '-' + b.y + '-' + b.soggetto)}
							{#if b.foglio}
								<rect x={b.foglio.x} y={b.foglio.y} width={b.foglio.w} height={b.foglio.h} fill="none" stroke={cutColor('Passante')} stroke-width="1.2" />
							{/if}
							{#each b.pieces as p (p.x + '-' + p.y)}
								{@const r = pronte[b.soggetto]}
								<rect x={p.x} y={p.y} width={p.rot ? r.cutH : r.cutW} height={p.rot ? r.cutW : r.cutH}
									rx={Math.min(r.cutW, r.cutH) / 6} fill={colore(b.soggetto)} opacity="0.75" />
							{/each}
						{/each}
					</svg>
				{/each}
				<ul class="mo-sum">
					{#each soggetti as s, i (i)}
						<li><span class="mo-dot" style="background:{colore(i)}"></span>{s.nome} — {s.qty} pz
							{#if monta.strips.some((st) => st.blocchi.some((b) => b.soggetto === i && b.foglio))}
								{@const nf = monta.strips.reduce((a, st) => a + st.blocchi.filter((b) => b.soggetto === i).length, 0)}
								· {nf} {nf === 1 ? 'foglio' : 'fogli'}
							{/if}
						</li>
					{/each}
				</ul>
				{#each monta.note as n (n)}<p class="mo-note">{n}</p>{/each}
			{/if}
		</div>

		<div class="dcard">
			<h3>Produzione</h3>
			<p class="mo-note">
				{#if dlDir}Taglio scritto in Data Link Server.{:else}Cartella di Data Link Server non collegata: il taglio verra' scaricato. <button class="mo-link" type="button" onclick={collega}>collega la cartella</button>{/if}
			</p>
			<button class="btn btn--pink mo-gen" type="button" disabled={!monta?.ok || !!busy} onclick={genera}>
				{busy ? 'Preparo i file…' : 'Genera stampa e taglio'}
			</button>
			{#if esito}<p class="mo-ok mo-blocco">{esito}</p>{/if}
			{#if errore}<p class="mo-err mo-blocco">{errore}</p>{/if}
		</div>
	</aside>
</div>

<!-- il motore lavora un soggetto alla volta, fuori vista: serve solo a ricavare tracciato e grafica -->
<div class="mo-hidden">
	<EnginePreview bind:this={engine}
		file={attiva?.file ?? null}
		forma={attiva?.forma ?? 'sagomato'}
		materiale={attiva?.materiale ?? 'bianco'}
		finitura="lucida"
		prodotto={attiva ? pDi(attiva).engineProduct : 'sticker'}
		foglio={!!(attiva && pDi(attiva).foglio)}
		rilievo={!!(attiva && pDi(attiva).rilievo)}
		vetro={!!(attiva && pDi(attiva).vetro)}
		w={typeof attiva?.w === 'number' ? attiva.w : 0}
		h={typeof attiva?.h === 'number' ? attiva.h : 0}
		showCut={false} stage={120} onrender={onRender} />
</div>

<style>
	.mo-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; margin-bottom: 16px; }
	.mo-head h1 { margin: 0; }
	.mo-lead { margin: 4px 0 0; color: var(--muted); font-size: 13.5px; }
	.mo-wrap { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 380px); gap: 16px; align-items: start; }
	.mo-col { display: flex; flex-direction: column; gap: 12px; min-width: 0; }
	.mo-sogg { border-left: 4px solid var(--c); }
	.mo-row { display: flex; gap: 10px; align-items: flex-end; flex-wrap: wrap; }
	.mo-row--top { align-items: flex-end; }
	.mo-row--head { align-items: center; margin-bottom: 10px; }
	.mo-n { width: 22px; height: 22px; border-radius: 50%; background: var(--c); color: #fff; font: 800 12px/22px Arial, sans-serif; text-align: center; flex: none; }
	.mo-nome { font-size: 14px; }
	.mo-x { margin-left: auto; border: 0; background: none; color: var(--muted); cursor: pointer; font-size: 15px; }
	.mo-f { display: block; font-size: 12px; font-weight: 700; }
	.mo-f span { display: block; margin-bottom: 4px; }
	.mo-f--grow { flex: 1 1 200px; }
	.mo-f .input { width: 100%; }
	.mo-prep { flex: none; }
	.mo-thumb { width: 54px; height: 54px; object-fit: contain; border: 1px solid var(--line); border-radius: 8px; background: #fff; flex: none; }
	.mo-note { margin: 8px 0 0; color: var(--muted); font-size: 12px; }
	.mo-ok { color: #15803d; font-size: 12px; font-weight: 700; }
	.mo-wait { color: var(--muted); font-size: 12px; }
	.mo-err { color: #b91c1c; font-size: 12.5px; }
	.mo-blocco { margin-top: 10px; }
	.mo-add { align-self: flex-start; }
	.mo-chips { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 10px; }
	.mo-chip { border: 1px solid var(--line); background: #fff; border-radius: 999px; padding: 6px 12px; font: 700 12px/1 inherit; cursor: pointer; }
	.mo-chip.is-on { background: var(--navy); color: #fff; border-color: var(--navy); }
	.mo-prev { width: 100%; height: auto; max-height: 420px; background: #f7f9fc; border-radius: 8px; margin-bottom: 10px; }
	.mo-label { margin: 10px 0 6px; font-size: 12.5px; }
	.mo-sum { margin: 6px 0 0; padding: 0; list-style: none; font-size: 12.5px; line-height: 1.8; }
	.mo-dot { display: inline-block; width: 10px; height: 10px; border-radius: 3px; margin-right: 6px; }
	.mo-gen { width: 100%; }
	.mo-link { border: 0; background: none; padding: 0; color: var(--blue); text-decoration: underline; cursor: pointer; font: inherit; }
	.mo-hidden { position: absolute; left: -10000px; top: 0; width: 420px; height: 240px; overflow: hidden; }
	h3 { margin: 0 0 10px; font-size: 14px; }
	@media (max-width: 1000px) { .mo-wrap { grid-template-columns: 1fr; } }
</style>
