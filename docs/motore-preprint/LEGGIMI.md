# motore preprint — pacchetto per Claude Code

    preprint.html   il motore, file unico senza dipendenze
    CLAUDE.md       come e' fatto, le regole, le trappole gia' pagate
    banco/          per rendere il motore fuori dal browser e guardarlo

Aprendo la cartella con Claude Code, `CLAUDE.md` viene letto da solo: contiene
l'architettura, il vincolo che viene prima di tutti (la grafica del cliente non
si butta via) e l'elenco degli errori gia' commessi, con le misure.

Per provare una modifica:

    cd banco && node estrai.js && node tela3.js && python3 png.py pieno.raw 600 600

Serve solo Node. Il `png.py` vuole Python con Pillow, ma i `.raw` sono RGBA
grezzi e si aprono anche in altro modo.
