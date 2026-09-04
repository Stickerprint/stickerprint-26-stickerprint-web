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
