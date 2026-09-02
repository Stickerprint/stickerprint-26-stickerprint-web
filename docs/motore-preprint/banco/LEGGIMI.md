# Banco di prova

Il motore gira nel browser, ma i difetti si trovano **rendendolo fuori** e
guardando le immagini. Questo banco fa girare le funzioni vere del motore in
Node, con una tela minima che restituisce pixel veri.

    node estrai.js      # ricava motore.js da ../preprint.html
    node tela3.js       # quadrato che riempie la tela → pieno.raw
    node tela5.js       # i quattro bianchi come i mockup di riferimento

I `.raw` sono RGBA grezzi: si aprono con qualunque cosa sappia leggere un
buffer, o si convertono in PNG con tre righe di Python/PIL.

## La regola che vale piu' di tutte

**Rendi la geometria VERA.** La tela e' grande esattamente quanto lo sticker:
un quadrato la riempie tutta e gli unici pixel trasparenti sono i quattro
angoli arrotondati. Se nel test lasci un margine attorno alla forma, dai al
motore un bordo che nella realta' non esiste e il difetto non si riproduce.
Tre giorni persi cosi'.
