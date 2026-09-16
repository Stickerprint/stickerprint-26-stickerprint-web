# SEO: come è fatto e cosa fare al lancio

## Cosa c'è nel codice

- `src/lib/seo.ts`: dominio definitivo `SITE_URL` (https://stickerprint.it, senza www), host di produzione, percorsi privati, canonical, JSON-LD (Product, BreadcrumbList).
- `src/lib/seo-home.ts`: WebSite + OnlineStore (dati aziendali reali, Instagram). Niente AggregateRating sull'azienda.
- `src/lib/components/Seo.svelte`: titolo, description, Open Graph, Twitter Card, JSON-LD della pagina. Canonical e robots li mette `+layout.svelte` per tutte le pagine.
- `src/hooks.server.ts`: header `X-Robots-Tag: noindex, nofollow` fuori dal dominio definitivo (anteprime Vercel, meett.it, stickerprint-web.vercel.app) e sui percorsi privati. Il layout aggiunge anche il meta robots.
- `src/routes/robots.txt` e `src/routes/sitemap.xml`: dinamici per host. La sitemap risponde 404 fuori produzione.
- Pagine prodotto (`ProductPage.svelte`): titolo/description SEO da `products.ts` (`seoTitle`, `seoDesc`), Product JSON-LD con prezzo "a partire da" del listino, AggregateRating e Review SOLO con recensioni vere del database (`real: true` in `reviews.ts`), breadcrumb visibili + BreadcrumbList.
- Kit (`/kit-adesivi`): Product con prezzo del kit tipo (10 kit). Blog: BlogPosting.
- Font Montserrat/Rubik locali (`@fontsource`), immagini in webp, reel YouTube caricati al clic (`LiteYouTube.svelte`), immagine hero della home con preload.
- Controllo: `node scripts/seo-check.mjs https://stickerprint.it` (in test: `... https://stickerprint-web.vercel.app --test`; in locale: `SEO_HOST=stickerprint.it node scripts/seo-check.mjs http://localhost:4173`).

## Regole

- Le recensioni di esempio nel codice (`FALLBACK` in `reviews.ts`) non entrano mai nei dati strutturati. Prima del lancio importare le recensioni vere: senza almeno 3 recensioni approvate per prodotto, il Product esce senza stelle (corretto).
- Il configuratore non usa parametri in URL: niente pagine duplicate da gestire.
- Multilingua: `/en` e `/us` impostano solo la valuta e rimandano alla home. Sono noindex. Hreflang solo quando esisteranno pagine tradotte davvero.

## Al lancio (in ordine)

1. DNS di stickerprint.it → Vercel (progetto stickerprint-web), senza www come canonico; www → 301 verso senza www (Vercel lo fa dal pannello Domains).
2. Vercel: `PUBLIC_SITE_URL=https://stickerprint.it` (link nelle email), `PUBLIC_TRACKING=on`.
3. Redirect dal vecchio sito: i percorsi sono gli stessi; aggiungere in `src/hooks.server.ts` (o `vercel.json`) solo le differenze trovate in Search Console (vecchi articoli del blog, URL con parametri, /proof).
4. `node scripts/seo-check.mjs https://stickerprint.it` deve chiudere con 0 errori.
5. Search Console: verificare la proprietà (Dominio), inviare `https://stickerprint.it/sitemap.xml`, controllare "Pagine" dopo qualche giorno.
6. Bing Webmaster Tools: importazione da Search Console.
7. Rich Results Test su una pagina prodotto e sulla home (search.google.com/test/rich-results).
8. meett.it e stickerprint-web.vercel.app restano noindex da soli (host diverso). Se meett.it non serve più, togliere il dominio dal progetto Vercel.
9. Google Business Profile: aggiornare il sito web.

## Dopo il lancio

- Landing per materiale (olografici, trasparenti, oro/argento, glitter) e per uso (packaging, cosmetici, eventi, creator): una alla volta, con foto e testi propri.
- Guide del blog con foto di produzione (file di stampa, taglio, materiali, resinati vs rilievo).
- Merchant Center con la configurazione base a prezzo "a partire da".
