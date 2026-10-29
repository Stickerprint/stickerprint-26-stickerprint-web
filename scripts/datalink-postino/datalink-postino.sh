#!/bin/bash
# Stickerprint — postino del Data Link Server (innesco).
# launchd (it.stickerprint.datalink-postino) lo lancia a ogni cambiamento in ~/Downloads.
# Il lavoro vero lo fa l'app «Postino Stickerprint» (~/Applications), perche' macOS da' il
# permesso sulla cartella Download solo alle app: uno script lanciato da launchd viene
# rifiutato in silenzio ("Operation not permitted"), senza nemmeno chiedere.
APP="$HOME/Applications/Postino Stickerprint.app"
LOG="$HOME/Library/Logs/datalink-postino.log"
if [ -d "$APP" ]; then
	open -g "$APP"
else
	echo "$(date '+%F %T') ERRORE: non trovo $APP" >> "$LOG"
fi
