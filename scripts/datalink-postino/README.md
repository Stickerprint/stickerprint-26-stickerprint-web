# Postino del Data Link Server

Sul Mac che fa girare Data Link Server (il portatile di Mattia) sposta i file di taglio `.xpf`
scaricati da Chrome in `~/Downloads` dentro la hot folder `/Users/Shared/DataLink`.
Serve quando lo Studio non ha la cartella collegata (Chrome ha perso il permesso o l'ha rifiutata):
lo Studio scarica il `.xpf` in Download e il postino lo porta al Graphtec entro un paio di secondi.
I PDF di stampa restano in Download, come vuole Mattia. In funzione dal 29/10/2026.

Come e' fatto (tre pezzi, tutti in questa cartella):

- `it.stickerprint.datalink-postino.plist` → agente launchd in `~/Library/LaunchAgents/`: parte a ogni
  cambiamento in Download (WatchPaths) e all'accesso, e lancia `datalink-postino.sh`.
- `datalink-postino.sh` → innesco, copiato in `~/Library/Application Support/Stickerprint/`: fa solo
  `open -g` dell'app qui sotto. Uno script lanciato da launchd NON puo' leggere Download: macOS lo
  rifiuta in silenzio ("Operation not permitted") senza chiedere il permesso.
- `Postino Stickerprint.app` → applet AppleScript (`Postino.applescript` compilato con `osacompile`,
  in `~/Applications/`) che esegue `Contents/Resources/postino.sh`, il vero spostamento. Essendo
  un'app, macOS le da' il permesso sulla cartella Download e lo ricorda.
- `postino.sh` → sposta solo file con un codice Graphtec `G1200xxxx` all'offset 60; "nome (1).xpf"
  diventa "nome.xpf"; diario in `~/Library/Logs/datalink-postino.log`.

Installare o aggiornare (dalla cartella del repository, su un Mac dove gira Data Link Server):

```bash
mkdir -p ~/Applications ~/Library/Application\ Support/Stickerprint ~/Library/LaunchAgents ~/Library/Logs && rm -rf ~/Applications/Postino\ Stickerprint.app && cp -R scripts/datalink-postino/Postino\ Stickerprint.app ~/Applications/ && cp scripts/datalink-postino/datalink-postino.sh ~/Library/Application\ Support/Stickerprint/ && chmod +x ~/Library/Application\ Support/Stickerprint/datalink-postino.sh && sed "s#/Users/stickerprint#$HOME#g" scripts/datalink-postino/it.stickerprint.datalink-postino.plist > ~/Library/LaunchAgents/it.stickerprint.datalink-postino.plist && (launchctl bootout gui/$(id -u)/it.stickerprint.datalink-postino 2>/dev/null; launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/it.stickerprint.datalink-postino.plist) && echo "Postino installato"
```

Se macOS chiede di permettere a «Postino Stickerprint» l'accesso alla cartella Download: dire Sì.
Se nel diario compare "non riesco a leggere Downloads", dare il permesso da Impostazioni di Sistema ›
Privacy e sicurezza › File e cartelle (o Accesso completo al disco) a Postino Stickerprint.

Ricompilare l'app dopo una modifica a `postino.sh` o `Postino.applescript`:

```bash
cd scripts/datalink-postino && rm -rf "Postino Stickerprint.app" && osacompile -o "Postino Stickerprint.app" Postino.applescript && cp postino.sh "Postino Stickerprint.app/Contents/Resources/" && /usr/libexec/PlistBuddy -c "Set :CFBundleIdentifier it.stickerprint.postino" -c "Add :LSUIElement bool true" -c "Set :CFBundleName Postino Stickerprint" "Postino Stickerprint.app/Contents/Info.plist" && codesign --force --deep --sign - "Postino Stickerprint.app"
```

Togliere:

```bash
launchctl bootout gui/$(id -u)/it.stickerprint.datalink-postino; rm -rf ~/Library/LaunchAgents/it.stickerprint.datalink-postino.plist ~/Applications/Postino\ Stickerprint.app
```
