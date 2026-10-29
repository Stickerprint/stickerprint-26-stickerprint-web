# Postino del Data Link Server

Sul Mac che fa girare Data Link Server (il portatile di Mattia) sposta i file di taglio `.xpf`
scaricati da Chrome in `~/Downloads` dentro la hot folder `/Users/Shared/DataLink`.
Serve quando lo Studio non ha la cartella collegata (Chrome ha perso il permesso o l'ha rifiutata):
lo Studio scarica il `.xpf` in Download e il postino lo porta al Graphtec entro un paio di secondi.
I PDF di stampa restano in Download, come vuole Mattia.

- Script: `datalink-postino.sh` (copiato in `~/Library/Application Support/Stickerprint/`)
- Agente launchd: `it.stickerprint.datalink-postino.plist` in `~/Library/LaunchAgents/`,
  parte a ogni cambiamento in Download (WatchPaths) e all'accesso.
- Diario: `~/Library/Logs/datalink-postino.log`
- Sposta solo file che hanno un codice Graphtec `G1200xxxx` all'offset 60; "nome (1).xpf" diventa "nome.xpf".

Installare o aggiornare (dalla cartella del repository, su un Mac dove gira Data Link Server):

```bash
mkdir -p ~/Library/Application\ Support/Stickerprint ~/Library/LaunchAgents ~/Library/Logs && cp scripts/datalink-postino/datalink-postino.sh ~/Library/Application\ Support/Stickerprint/ && chmod +x ~/Library/Application\ Support/Stickerprint/datalink-postino.sh && sed "s#/Users/stickerprint#$HOME#g" scripts/datalink-postino/it.stickerprint.datalink-postino.plist > ~/Library/LaunchAgents/it.stickerprint.datalink-postino.plist && (launchctl bootout gui/$(id -u)/it.stickerprint.datalink-postino 2>/dev/null; launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/it.stickerprint.datalink-postino.plist) && launchctl print gui/$(id -u)/it.stickerprint.datalink-postino | grep -m1 state
```

Alla prima esecuzione macOS può chiedere di permettere a «bash» l'accesso alla cartella Download: dire Sì.

Togliere:

```bash
launchctl bootout gui/$(id -u)/it.stickerprint.datalink-postino; rm ~/Library/LaunchAgents/it.stickerprint.datalink-postino.plist
```
