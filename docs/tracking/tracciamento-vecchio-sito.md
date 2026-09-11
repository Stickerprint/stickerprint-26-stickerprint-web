# Tracciamento del sito attuale stickerprint.it — inventario completo

Rilevato l'11 settembre 2026 leggendo l'HTML servito, il contenitore Google Tag Manager
pubblicato e tutti i moduli JavaScript del sito (111 file). Copia del contenitore:
`GTM-PXKJS5J6.container.js` in questa cartella (è il file che Google serve al browser, con
tutti i tag, i trigger e le variabili configurati dall'agenzia).

## 1. Codici inseriti direttamente nell'HTML del sito

| Cosa | Identificativo | Dove |
|---|---|---|
| Google Tag Manager | **GTM-PXKJS5J6** | `<head>` (snippet standard) + `<noscript>` iframe nel `<body>` |
| Klaviyo onsite | **X7Mrme** (`https://static.klaviyo.com/onsite/js/X7Mrme/klaviyo.js`) | `<head>`, script async |
| iubenda | site id **3794551**, widget `90e6b334-05c2-4720-92d7-aa8a5c1bac2e` | caricato da GTM (tag iubenda), nell'HTML c'è solo un CSS che nasconde il widget duplicato `.iub__us-widget` |

Snippet GTM esatto:

```html
<!-- Google Tag Manager -->
<script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','GTM-PXKJS5J6');</script>
<!-- End Google Tag Manager -->
<!-- Klaviyo -->
<script async src="https://static.klaviyo.com/onsite/js/X7Mrme/klaviyo.js"></script>
```
```html
<noscript><iframe src="https://www.googletagmanager.com/ns.html?id=GTM-PXKJS5J6" height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>
```

## 2. Cosa c'è dentro il contenitore GTM-PXKJS5J6 (21 tag, 72 variabili)

| Piattaforma | Identificativo | Tag configurati |
|---|---|---|
| Google Analytics 4 | **G-NFDD7FJJ2L** | configurazione (send_page_view off, google signals off, ad personalization off) · `page_view` su `custom_page_view` · eventi e-commerce con `ecommerce` dal dataLayer · `purchase` con `user_data` · `generate_lead` con `form_name` · eventi `file_uploads_*` con parametri file_name / file_extension / file_size / file_id ed error_code / error_message |
| Google Ads | **AW-589723982** | configurazione con `user_data` (conversioni avanzate) · conversione **acquisto** etichetta `qihnCOXbq4UcEM7ymZkC` (valore, transaction_id, items, sconto, nuovo cliente/di ritorno, LTV, feed IT/it) · conversione **lead** etichetta `RngyCN_ZhsAcEM7ymZkC` · conversioni per evento: `view_item` → `OfR5CO7bq4UcEM7ymZkC`, `add_to_cart` → `TrdCCOjbq4UcEM7ymZkC`, `begin_checkout` → `JaGpCOvbq4UcEM7ymZkC` · remarketing dinamico (retail, items + valore, user id) · conversion linker |
| Meta Pixel | **1493906807829719** | inizializzazione · `PageView` · `Purchase` con advanced matching (email, telefono, indirizzo, external_id = user id) · eventi standard ereditati dal dataLayer (view_item, add_to_cart, begin_checkout, add_payment_info) con contents / content_ids / content_name / content_category / num_items ricavati da `ecommerce.items` |
| Microsoft Clarity | **vys5ac6psi** | tag base con consent mode + eventi personalizzati (nome evento del dataLayer) |
| iubenda | site id **3794551** | template ufficiale iubenda per Consent Mode v2: purpose 2 → basic, 3 → esperienza, 4 → misurazione (analytics_storage), 5 → pubblicità (ad_storage); ads data redaction attiva, url passthrough attivo, wait 2000 ms |
| Sorgente di traffico | cookie `gtm_dd_sep_*` | template "traffic source" che salva per 365 giorni source, medium, campaign, gclid, fbclid e li allega a ogni evento GA4 (`gtm_utm_source`, `gtm_utm_medium`, `gtm_utm_campaign`, `gtm_gclid`, `gtm_fbclid`) |
| Custom HTML | — | script che calcola SHA-256 dei dati utente (per conversioni avanzate / matching) |

Parametri aggiunti a ogni evento GA4: `gtm_container_info`, `gtm_page_path`, `gtm_referrer`, `gtm_info_timestampe`, utm/gclid/fbclid. Proprietà utente: `logged_status`, `user_id`, `gtm_user_id`.

Trigger (eventi del dataLayer che il sito deve emettere):
`custom_page_view` · `login` · `view_item` · `add_to_cart` · `view_cart` · `begin_checkout` · `add_contact_info` · `add_payment_info` · `purchase` · `generate_lead` (solo pagina `/aziende`) · `file_uploads_*` (regex) · `view_item_list` · consenso `granted`.

Nota: `generate_lead`, `view_item_list` e `file_uploads_ok` sono previsti da GTM ma il sito attuale NON li emette mai (nel codice esiste solo `file_uploads_ko`). Sul nuovo sito conviene emetterli davvero.

## 3. Eventi che il sito spinge nel dataLayer (struttura esatta, da riprodurre)

Ogni evento e-commerce è preceduto da `dataLayer.push({ ecommerce: null })`.

- **custom_page_view** (a ogni navigazione): `{ event, page_location, page_title, user_properties: { logged_in, user_id } }`
- **login** / **sign_up**: `{ event, user_properties: { logged_in: true, user_id } }`
- **view_item** (pagina prodotto, dopo 500 ms, una volta per prodotto+quantità): `{ event, ecommerce: { currency: "EUR", value, items: [ITEM] } }`
- **add_to_cart**: come view_item, con la quantità scelta
- **remove_from_cart**, **view_cart**: `{ ecommerce: { currency, value, items } }`
- **begin_checkout**: `{ ecommerce: { currency, value, items } }`
- **add_contact_info**: `{ ecommerce: { currency, value, coupon, items } }`
- **add_payment_info**: `{ ecommerce: { currency, value, coupon, payment_type: "Carta di credito" | "PayPal", items } }`
- **purchase**:
  ```
  { event: "purchase",
    ecommerce: { transaction_id: <numero ordine>, value, tax, currency: "EUR",
                 payment_type, shipping_tier: "Express" | "Spedizione Gratuita",
                 coupon, discount, customer_type: "new" | "returning", items: [ITEM con index] },
    user_data: { email (minuscolo), phone_number,
                 address: { first_name, last_name, street, city, region, postal_code, country: "IT" } (tutto minuscolo) },
    user_properties: { logged_in, user_id, order_total_count, life_time_value } }
  ```
- **file_uploads_ko**: `{ event, file_data: { file_name, file_extension, file_size, file_id: "upl_error" }, value, error_details: { error_code: "ERR_FILE_SIZE_LIMIT" | "ERR_FILE_TYPE", error_message }, ecommerce }`
- **admin_order_revision** (solo area admin, quando viene caricata una prova di stampa)

Struttura ITEM:
```
{ item_id: "<prefisso>_<forma>"  (es. adesivi_personalizzati_sagomato, campioni_pacchetto, promo_<n>),
  item_name: "<nome prodotto> <forma>",
  item_brand: "Sticker Print",
  item_category: <categoria>, item_category2: <sottocategoria, opzionale>,
  item_size: "<larghezza> x <altezza> mm",
  item_variant: <materiale>, item_variant2: <protezione/lamina>,
  price: <prezzo unitario, 2 decimali>, quantity: <pezzi> }
```

## 4. Domini di terze parti effettivamente contattati dal browser

googletagmanager.com · region1.google-analytics.com · pagead2.googlesyndication.com ·
static.klaviyo.com, static-tracking.klaviyo.com, static-forms.klaviyo.com, fast.a.klaviyo.com, a.klaviyo.com ·
embeds.iubenda.com, cdn.iubenda.com, idb.iubenda.com · www.clarity.ms, scripts.clarity.ms, b.clarity.ms ·
connect.facebook.net (pixel, dopo il consenso) · fonts.googleapis.com · d3k81ch9hvuctc.cloudfront.net (asset Klaviyo).

Non presenti: TikTok, Pinterest, LinkedIn, Hotjar, Bing UET (le stringhe nel contenitore sono solo la mappa dei vendor di iubenda).

## 5. Cosa serve sul nuovo sito

1. Stesso snippet GTM (GTM-PXKJS5J6) nell'`app.html` e script Klaviyo X7Mrme: il contenitore resta quello, non va ricostruito.
2. Emettere gli stessi eventi del dataLayer con le stesse strutture (sezione 3), aggiungendo quelli che oggi mancano: `generate_lead` con `form_name` sul modulo di /aziende, `file_uploads_ok`, `view_item_list`.
3. iubenda: stesso site id 3794551 (cookie policy e consenso li carica GTM).
4. Quando il dominio passa a stickerprint.it non cambia nulla: GTM, GA4, Ads, Meta, Clarity e Klaviyo sono legati agli account, non al dominio. Da aggiornare solo l'URL del sito nelle impostazioni di GA4 (stream), Search Console e Klaviyo.
