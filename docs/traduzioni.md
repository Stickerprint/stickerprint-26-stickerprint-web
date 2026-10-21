# Traduzioni del sito: regole, tono, glossario

Il sito pubblico parla sei lingue: italiano (base), spagnolo, francese, tedesco, olandese e inglese americano.
La dashboard e lo Studio restano in italiano. Questo file e' la guida per chi traduce (persona o agente).

## Come funziona nel codice

- Lingua e valuta: `src/lib/i18n.ts` (locali, prefissi `/es` `/fr` `/de` `/nl` `/us`, listino dollari). URL in lingua: `src/lib/slugs.ts`.
- Testi: una cartella `src/lib/traduzioni/`, **un file per area del sito** (`comune`, `home`, `prodotti`, `configuratore`,
  `kit`, `fogli`, `checkout`, `account`, `pagine`). Dentro: `const it = {...}` e' la forma, `en/es/fr/de/nl` hanno le stesse
  chiavi (TypeScript le controlla; il test `index.test.ts` fallisce se manca una chiave o un testo e' vuoto).
- Nei componenti Svelte: `const { t, path, prezzo, prezzoUnit, numero, data } = usaLingua();`
  - `t('home.titolo')` → testo; segnaposto `{nome}` → `t('footer.spedizioneGratis', { soglia })`.
  - `path('/adesivi-personalizzati')` → link interno con prefisso e slug tradotti (`/de/individuelle-aufkleber`). **Ogni `href` interno passa da `path()`.**
  - `prezzo(euro)` → prezzo nella valuta e nel formato della lingua (in `/us` converte in dollari col listino). Mai `toFixed(2) + ' €'`, mai `Intl` con `it-IT` scritto a mano.
  - `numero(n)`, `data(d)` → formati della lingua.
- Nel server (email, PDF): `t(locale, 'chiave')` da `$lib/traduzioni`, con `perLingua(lang)` se si ha solo la lingua del cliente.
- Testi con HTML dentro (grassetti, link): tenere i tag nella stringa e renderli con `{@html t(...)}` SOLO se la stringa viene dal catalogo (mai da input utente).
- Chiavi: in italiano, corte, in camelCase: `titolo`, `sottotitolo`, `cta`, `caricaFile`. Raggruppare per blocco di pagina: `home.hero.titolo`.
- Le frasi che cambiano per numero (1 adesivo / 2 adesivi): due chiavi (`uno`, `tanti`) o un segnaposto, mai concatenazioni di parole.

## Tono per lingua

| Lingua | Forma | Tono |
|---|---|---|
| it | tu | diretto, un po' giocoso, frasi corte (e' la voce del sito: "Fatti bene. Punto.") |
| en (US) | you | diretto, concreto, da brand DTC americano; niente british spelling (color, customize) |
| es | tú | caldo e diretto, spagnolo di Spagna (vosotros ok, niente voseo) |
| fr | vous | cordiale ma non burocratico; francese di Francia; "stickers" e' la parola che cercano, "autocollants" va bene come sinonimo |
| de | du | moderno, diretto (i brand di sticker tedeschi usano il du); niente Sie; parole composte corrette (Doming-Aufkleber) |
| nl | je | informale, pratico, olandese dei Paesi Bassi (non fiammingo) |

Si traduce il senso, non la parola: gli slogan si riscrivono perche' suonino naturali nella lingua, non calcati sull'italiano.
Dove c'e' un modo di dire locale che la gente usa davvero per cercare il prodotto, si usa quello (vedi glossario).

## Glossario (termini da usare sempre uguali)

| it | en-US | es | fr | de | nl |
|---|---|---|---|---|---|
| adesivi personalizzati | custom stickers | pegatinas personalizadas | stickers personnalisés | individuelle Aufkleber (anche: Sticker) | stickers op maat |
| adesivi resinati | domed stickers | pegatinas resinadas (3D) | stickers résinés (doming) | Doming-Aufkleber (3D-Aufkleber) | doming stickers |
| adesivi in rilievo | raised stickers | pegatinas en relieve | stickers en relief | Relief-Aufkleber | reliëf stickers |
| etichette (in fogli) | labels (on sheets) | etiquetas (en hojas) | étiquettes (en planches) | Etiketten (auf Bögen) | etiketten (op vellen) |
| fogli di adesivi | sticker sheets | hojas de pegatinas | planches de stickers | Stickerbögen | stickervellen |
| vetrofanie | window decals | vinilos para escaparate | stickers vitrine | Fensteraufkleber | raamstickers |
| kit di adesivi | sticker pack | pack de pegatinas | kit de stickers | Sticker-Set | stickerpakket |
| kit campioni | sample kit | kit de muestras | kit d'échantillons | Muster-Set | proefpakket |
| sagomato (taglio) | die-cut | troquelado | découpe à la forme | konturgeschnitten / Konturschnitt | contourgesneden |
| lamina (lucida/opaca) | laminate (glossy/matte) | laminado (brillo/mate) | lamination (brillante/mate) | Laminierung (glänzend/matt) | laminaat (glans/mat) |
| vinile | vinyl | vinilo | vinyle | Vinyl | vinyl |
| anteprima automatica | instant preview | vista previa automática | aperçu automatique | automatische Vorschau | automatisch voorbeeld |
| prova di stampa | proof | prueba de impresión | BAT (bon à tirer) | Druckfreigabe / Vorschau | drukproef |
| spedizione gratuita da | free shipping from | envío gratis a partir de | livraison gratuite dès | kostenloser Versand ab | gratis verzending vanaf |
| carrello | cart | carrito | panier | Warenkorb | winkelwagen |
| preventivo | quote | presupuesto | devis | Angebot | offerte |
| ordine | order | pedido | commande | Bestellung | bestelling |
| credito Stickerprint | Stickerprint credit | crédito Stickerprint | crédit Stickerprint | Stickerprint-Guthaben | Stickerprint-tegoed |
| IVA | tax (US: prices shown without sales tax) | IVA | TVA | MwSt. | btw |

Numeri e unita': i millimetri restano millimetri anche negli USA (si puo' aggiungere i pollici fra parentesi dove conta: 2" ≈ 50 mm).
Prezzi: `prezzo()` fa tutto; non scrivere mai il simbolo di valuta nei testi. Date: `data()`.
Soglie di spedizione gratuita: `locale.freeShipping` (50 € IT, 69 € UE, 99 $ USA): mai scritte a mano nei testi.

## Cosa NON si traduce

- Nome Stickerprint, nomi dei materiali tecnici (Cromo oro, UV), i codici prodotto, gli URL delle immagini.
- La dashboard, lo Studio, le API.
- Niente: anche i contenuti del database (FAQ, categorie, articoli del blog, offerte) sono tradotti. Si scrivono in italiano in dashboard;
  il traduttore automatico (Claude API, `src/lib/server/traduttore-contenuti.ts`) li traduce ogni notte o col bottone in
  Setup > Traduzioni dei contenuti e li salva nella colonna `tr` (migrazione 0060) con l'impronta dell'italiano: se il testo
  cambia, si ritraduce. Le traduzioni fatte a mano il 21/10/2026 stanno in `src/lib/contenuti-tradotti/contenuti.json` come riserva.
