# preprint — motore per adesivi personalizzati

`preprint.html` è un file unico, senza dipendenze: HTML, CSS e JavaScript in un
solo documento. Il cliente carica un'immagine, il motore ne ricava la sagoma di
taglio e mostra la prova di stampa.

## Cosa fa, in ordine

1. **Rasterizza** il file caricato (PNG, JPG, SVG, PDF) e lo riduce a una copia
   di lavoro di 1100 px sul lato lungo — `buildWork()`.
2. **Scontorna**: genera un'ottantina di ipotesi di separazione fra disegno e
   sfondo (soglie di trasparenza, riempimenti dal bordo, modelli di colore) e le
   mette in gara con un punteggio — `searchSegmentation()`, `scoreMask()`. La
   gara si svolge su una copia a 360 px per non far aspettare nessuno, poi le
   prime cinque vengono riverificate a piena risoluzione — `verifyAtWork()`.
3. **Costruisce la maschera** definitiva — `computeMask()`.
4. **Prepara il disegno** da stampare: scioglie la fascia di pixel mescolati col
   vecchio sfondo e ripesca i tratti sottili — `buildArtCanvas()`.
5. **Ricava il tracciato di taglio**: dilata la maschera del bordo scelto,
   chiude i buchi, semplifica il contorno e lo addolcisce — `buildCut()`.
6. **Compone**: riempie la sagoma col colore scelto, appoggia il disegno,
   applica il materiale e — sui resinati — la bombatura — `inkLayer()`,
   `renderCore()`, `resinDome()`.

## La regola che viene prima di tutte

> **La grafica del cliente non si butta via, mai.**

Non è uno slogan: è un vincolo che ha già cambiato il codice più volte. Quando
una scelta migliora l'aspetto ma può far sparire un pezzo di disegno, vince il
disegno. `buildCut()` alza il raggio di raccordo finché la sagoma è una sola
invece di tenere il pezzo più grosso e buttare gli altri; il recupero dei tratti
sottili è tarato per lasciar fuori lo sfondo piuttosto che rischiare di mangiare
un capello di una lettera.

Verifica numerica disponibile: ricomponendo il disegno lavorato sul suo sfondo
originale, l'errore medio rispetto al file di partenza è **0,057 su 255**.
È un'identità, non una promessa. Se una modifica la rompe, la modifica è
sbagliata.

## Come si prova

Il motore gira nel browser, ma i difetti si trovano **rendendolo fuori** e
guardando le immagini. In `banco/` c'è un ambiente che esegue le funzioni vere
in Node, con una tela minima che restituisce pixel reali.

    cd banco
    node estrai.js     # ricava motore.js da ../preprint.html
    node tela3.js      # quadrato che riempie la tela
    node tela5.js      # i quattro bianchi di riferimento
    python3 png.py pieno.raw 600 600

**Il banco va rifatto con `estrai.js` dopo ogni modifica al file**, altrimenti
si prova la versione vecchia.

## Trappole già pagate

Sono tutti errori veri, trovati misurando. Vale la pena leggerli prima di
toccare qualcosa.

**Misurare a una risoluzione e applicare a un'altra.** Il punteggio delle
ipotesi si calcola su 360 px, la maschera si costruisce a 1100. Le due cose
possono non coincidere, e l'ipotesi che vince nella gara piccola può mangiare il
disegno in quella grande. Da qui `verifyAtWork()`.

**La tela è grande quanto lo sticker.** Un quadrato la riempie tutta: gli unici
pixel trasparenti sono i quattro angoli arrotondati, l'1,25% della superficie.
Chi cerca il bordo guardando dove la tela diventa trasparente crede che quel
quadrato non abbia bordi sui lati. Nei test **non lasciare margine attorno alla
forma**: si dà al motore un bordo che nella realtà non esiste e il difetto non
si riproduce.

**Applicare due volte la stessa copertura.** Ritagliare con `clip()` e poi
riempire *la stessa* sagoma moltiplica due volte la copertura dei pixel di
bordo: dove il profilo copre mezzo pixel il risultato è 0,25 invece di 0,50, e
sotto si vede la pagina. Si riempie una volta sola e si usa `source-atop`.

**La sfocatura a scatola non è rotonda.** Anche a più passate conserva la
simmetria del quadrato: su un campo di altezza affiora come sfaccettature e
croci. Misurato: a due passate lo scarto fra le direzioni è 13,3%, a quattro
3,1%. Dove serve davvero isotropia c'è `gaussRid()`, una gaussiana vera
calcolata a un quarto di risoluzione.

**La distanza dal bordo ha creste.** Il campo "quanto sono lontano dal filo" ha
una cresta lungo l'asse mediano della sagoma — una X su un quadrato, una
ramificazione a ogni incrocio di lettere. Derivandolo (le pendenze, la luce) le
creste diventano stelle e spigoli. Per questo il rilievo del resinato non nasce
più da lì ma da `membrana()`, la soluzione di ∇²h = −1: ogni punto sta alla
media dei quattro vicini più una costante, e **la media dei vicini non può
produrre creste**. Qualunque funzione crescente di quel campo resta liscia, per
cui il profilo si può piegare liberamente senza farle tornare.

**Allo zenit la direzione non esiste.** Sul piano della cupola la normale punta
in su e l'azimut del riflesso è l'arcotangente di due numeri quasi nulli, cioè
rumore. Se la sonda di luce varia con l'azimut anche lì, quel rumore diventa un
poligono di sfaccettature. Si sfuma verso la media di tutte le direzioni.

**Il tracciato è una spezzata addolcita.** Ammette fino a 0,7 mm di scarto: su
un tondo da 50 mm è l'1,4% di ondulazione. Invisibile sul contorno, ma il
rilievo lo amplifica in un festone. Sui resinati la tolleranza è tenuta a
0,12 mm.

**Correggere un file solo toccando tutti.** Due modifiche pensate per gli
spiragli bianchi di un logo hanno fatto perdere la sagoma a un logo cromato con
fondo sfumato. Se un rimedio agisce sullo scontorno di ogni file per risolvere
il caso di uno, quasi sempre non vale: meglio un comando che il cliente accende
quando serve — è così che è nato «Rimuovi sfondo».

## Come si aggancia al sito

La combinazione è decisa prima, sul sito, e arriva al file:

```html
<script>window.SPPS_CONFIG={forma:'sagomato',materiale:'bianco',lamina:'lucida'};</script>
```

oppure nell'indirizzo: `?forma=tondo&materiale=oro&w=70&h=45&qta=100`.
Chiavi: `forma`, `materiale`, `lamina`, `prodotto`, `w`, `h`, `qta`. Quella
scritta nel file vince sempre su quella nell'indirizzo, così da una pagina del
bianco nessuno può ordinare l'olografico. I passi già decisi si nascondono da
soli.

La decisione del cliente esce con due eventi:

```js
document.addEventListener('preprint:ok', e => { /* e.detail: misura, bordo,
  colore, materiale, tracciato di taglio */ });
document.addEventListener('preprint:modifiche', e => { /* e.detail.richiesta */ });
```

Dentro un iframe gli eventi non escono: lì serve `postMessage`.

## Generare i file per il sito

Da `preprint.html` si ricavano le varianti (una per sagoma × materiale ×
laminazione) iniettando `SPPS_CONFIG` subito dopo `<body>`. **Il motore resta
uno solo**: correggere un bug vuol dire rigenerare le varianti da questa
sorgente, non modificarne sessanta.

L'etichetta accanto al logo (`motore mNN`) serve a sapere a colpo d'occhio quale
build si sta guardando. Va alzata a ogni consegna: senza, si finisce a discutere
di difetti già corretti in un file che nessuno stava usando.


## Resina: effetto mockup (4 settembre 2026)

`resinDome()` non usa piu' il modello ottico (che resta nel file come
`resinDomeFisico()`, spento). L'effetto e' ricostruito sui mockup Photoshop
dell'utente (sei con grafica vera): distanza dal bordo VERO del pezzo (alpha
del disegno, con una cornice di un pixel fuori dalla tela) e ANGOLO del pixel
attorno al centro della sagoma — le luci sono posizionate nell'immagine come
in un mockup dipinto, non sulla normale del bordo (che dava facce a piramide
sul quadrato). Da li', parametri in `RESM`: filo lucido sottile su tutto il
perimetro (in mm), mezzaluna di riflesso netta in basso a sinistra, luce
secondaria in alto a destra, lucentezza diffusa verso l'alto a sinistra e
ombra morbida in basso a destra (in frazioni del lato minore, cosi' scalano
col pezzo). Niente fascia scura del menisco ne' vignettatura: facevano un
cratere. Le luci non arrivano mai al bianco pieno
(`glMax`), cosi' sul colore resta un velo di tinta. Sul resinato la banda di
luce in movimento (`bagliore`) e' spenta: il mockup e' statico come quelli
di riferimento. Sotto l'adesivo c'e' il foglio di carta (`disegnaFoglio`)
con ombra morbida e grana, sia nell'anteprima sia nel mockup esportato; per
questo `draw()` allarga il margine (`pad`) sul resinato e `fitEmbed` inquadra
tutta la tela.

Banco: `scratchpad/harness/index.html` (sessione del 4/9) manda al motore
sei file di prova (quadrato, rettangolo, ovale, tondo, stella, scritta) via
postMessage e mostra le istantanee; si fotografa con Chrome headless.

## Contorno del sagomato sugli adesivi (5 settembre 2026)

`P_TAGLIO_L` (rientranza, semplificazione, levigatura per bordo piccolo/medio/grande)
e' stato stretto per gli adesivi: piccolo `[86,12,14]`, medio `[70,25,32]`, grande
`[46,42,54]`. Il tracciato segue di piu' le rientranze fra le lettere e tiene le punte
(stelle, angoli) meno stondate, soprattutto su "piccolo". I resinati usano la tabella
di prima (`P_TAGLIO_L_RES`): la resina vuole raccordi dolci. Banco di prova:
`scratchpad/harness/contorno.html` (prima/dopo sui tre bordi, grafica testo+stella).

## Linee pulite sul tracciato (30 ottobre 2026)

Ordine SP00509 ("vercetti", 381 mm): la lama ha tagliato un bordo seghettato. Causa: la
sagoma si lavora a 900 px sul lato lungo (0,42 mm per pixel a 381 mm) e `contourOne`
inseguiva i gradini della griglia (826 nodi, 104 "angoli" con bordo piccolo); lo Studio
poi lisciava con 0,15 mm. Rimedi: in `contourOne` la spezzata di `traceLoops` passa da
`smoothLoop` (media mobile ±3 px, due passate) prima di rdp/angoli/levigatura; in
`buildCut` lo scarto `devPx` non scende sotto 0,9 px. Il raggio in mm cresce da solo con la
misura (0,17 mm a 50 mm, 1,3 mm a 381 mm): sotto i 50 mm il tracciato si sposta meno di
0,2 mm. `S.noPreSmooth=true` lo spegne per confronto. Nello Studio `fitOpts` scala con il
lato lungo e `puliziaTracciato` (fit.ts) misura gli zig-zag ogni 10 cm sul tracciato finale.

## Etichette in fogli: anteprima del foglio (5 settembre 2026)

Con `foglio=1` (URL) o `config.foglio=true` (messaggio dal sito) il motore mostra il
foglio invece del pezzo singolo: `layoutFoglio()` parte da un A4 verticale o orizzontale
ma il foglio non e' vincolato: puo' crescere fino a `FOGLIO_TOL` (+10% per lato) se cosi'
entra una colonna o una riga in piu', e si ritaglia a misura della griglia (margine di
sicurezza `FOGLIO_M`=10 mm per lato, passo `FOGLIO_G`=2 mm). Si tiene l'orientamento
che ne contiene di piu' (a parita', il foglio piu' piccolo): priorita' al materiale.
`draw()` renderizza il pezzo una volta (`renderTile`) e `ridipingi()` lo ripete sul
foglio (`S._an.sheet`), con il tratteggio di taglio su ogni etichetta. Il messaggio
`render` porta `foglio:{n,cols,rows,w,h}` e il preventivatore delle etichette lo usa
per dire "N etichette per foglio → M fogli". Banco: `scratchpad/harness/foglio.html`.

## Adesivi in rilievo (5 settembre 2026)

Con `rilievo=1` (URL) o `config.rilievo=true` il motore dipinge l'effetto rilievo
(vernice UV spessa, sempre lucida) SOLO sui dettagli del disegno. `rilievoMask()`
divide il disegno in regioni delimitate dai bordi netti (Sobel su luminanza e
crominanza, copia a 640 px) e alza una regione se e' piccola (< 5% dell'area) o sottile (raggio inscritto
< 8% del lato corto) purche' non sia una campitura (< 12%); restano piatti lo
sfondo del file, il colore di fondo scelto, le campiture larghe e OGNI pezzo del
loro stesso colore (il fondo tagliato in spicchi da scritte e cerchi) (le sfumature
non hanno bordi netti, quindi restano una regione sola). Se il rilievo supera il
60% del disegno la soglia dei bordi sale (file complessi). `rilievoApply()` in
`renderCore` compone: ombra portata in basso a destra, ombra interna sul fianco,
cresta di luce in alto a sinistra con filo netto sul ciglio, SUPERFICIE BOMBATA
(altezza a cupola dalla maschera sfumata con due raggi, 0,7 e 2,2 mm: versante verso la
luce schiarito, versante opposto scurito su tutta la superficie), banda di riflesso in
diagonale, velo lucido e colori piu' pieni (`S.rilForza` regola l'intensita'; `?rildebug=1` tinge la maschera di rosso
e mette le regioni in `S.ril.regs`). La lente "Rilievo da vicino" ingrandisce 2,6x
e si trascina per spostarsi. L'effetto va
sopra la finitura (UV opaca spegne il resto, il rilievo resta lucido). Banco:
`scratchpad/harness/rilievo.html`. Sul sito il passo "Finitura" del rilievo ha
UV opaca (consigliata) e UV lucida (`finishTitle`/`finishNote` nel listino).

## Tratti sottili e controforme (5 settembre 2026)

Bug storico in `buildArtCanvas`: nella rampa di bordo il colore "vero" del disegno
veniva propagato da qualsiasi pixel interno alla maschera lontano dal bordo, comprese
le controforme (il buco della A, della O, della P) che sono sfondo del file rimasto
dentro. I tratti sottili accanto prendevano quel bianco e sparivano: restavano solo le
lettere senza buchi ("S LV I A LI"). Ora un pixel fa da fonte di colore solo se dista
dal colore di sfondo piu' di 26 (RGB). Vale per tutti i prodotti.
Rilievo: due misure. Elementi sottili (raggio inscritto < 0,9 mm) ricevono ombre corte,
luci fini, niente cupola larga ne' velo/overlay (rompevano l'antialias delle scritte
piccole); elementi grandi la cupola piena. Banco: `rilievo.html?art=trainer`.

## Resina: cupola vera vista dall'alto (5 settembre 2026)

In `resinDome` alle luci dipinte dei mockup si aggiunge un modello fisico: dal campo di
distanza (sfumato, cosi' quadrati e rettangoli non fanno creste a piramide) si ricava
un'altezza a menisco `h=1-(1-t)^3`, la normale e l'ombreggiatura con luce in alto a
sinistra (`AMB` 0,78; il versante opposto si scurisce, rinforzato sui fondi chiari
`kShade=1+0,4*lum`, cosi' la cupola si vede anche sul bianco). Il riflesso e' Blinn-Phong
(pow 60) e NON e' bianco puro: sui colori prende fino al 38% del colore del fondo. Le luci
dipinte (mezzaluna, alone, luce secondaria) restano al 50% sui tondi/sagomati e al 12% su
quadrati e rettangoli (li' facevano una cornice interna a L). Resinati sagomati: il bordo
"piccolo" e' nascosto (solo medio e grande), `ppGeoUI()`.

## Lingue (21 ottobre 2026)

Il sito apre il motore con `?lang=en|es|fr|de|nl` (`EnginePreview.svelte`, `buildSrc`). Senza
parametro resta tutto in italiano, byte per byte. In cima allo script di `index.html`:

- `TR = { en, es, fr, de, nl }`, un dizionario per lingua indicizzato dalla **frase italiana
  esatta** (spazi normalizzati): 287 voci per lingua, tono e glossario da `docs/traduzioni.md`.
- `tr(s, vars)`: ritorna `TR[LANG][s] ?? s`; con `vars` sostituisce i segnaposto `{n}`, `{c}`...
  (es. `tr('Genero il foglio ({n} pezzi)…',{n:L.n})`). In italiano restituisce la stringa com'e'.
- all'avvio (solo se `lang` non e' `it`) un walker traduce i nodi di testo, `placeholder`,
  `title`, `aria-label` e `value` dei bottoni di tutto il body, e mette `document.title` e
  `<html lang>`; un `MutationObserver` (childList + characterData) traduce quello che il motore
  scrive dopo con `textContent`/`innerHTML`, se il testo intero e' nel dizionario.
- `toast()` e `busy()` passano da `tr()`; i messaggi con parti variabili sono stati
  riscritti con segnaposto; le note HTML intere (`WT`, `bgFixBar`, `uFondoNota`,
  `ppRimuoviNota`) usano l'HTML completo come chiave.

Regole: `U_SHP`/`U_MAT` e i dati mandati al sito (`formaEtichetta`, `bordo.livello`...) restano
in italiano, si traduce solo la visualizzazione. Una frase nuova nel motore va aggiunta a `TR`
nelle cinque lingue (chiave = testo italiano trimmato); se contiene numeri, usare `{n}`. Non
aggiungere una traduzione che sia a sua volta una chiave italiana con traduzione diversa:
l'osservatore oscillerebbe.
