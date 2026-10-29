#!/bin/bash
# Postino Stickerprint — il vero spostamento dei file di taglio.
# Gira come "app" (bundle) perche' macOS chiede il permesso sulla cartella Download solo alle app,
# non a uno script lanciato da launchd (che viene rifiutato in silenzio: "Operation not permitted").
# Lo apre datalink-postino.sh a ogni cambiamento in Download.
SRC="$HOME/Downloads"
DST="/Users/Shared/DataLink"
LOG="$HOME/Library/Logs/datalink-postino.log"
[ -d "$DST" ] || exit 0
if ! ls "$SRC" >/dev/null 2>"$HOME/Library/Logs/datalink-postino.err"; then
	echo "$(date '+%F %T') ERRORE: non riesco a leggere $SRC ($(tr -d '\n' < "$HOME/Library/Logs/datalink-postino.err")). Dai il permesso a «Postino Stickerprint» su Download (Impostazioni di Sistema › Privacy e sicurezza › File e cartelle, oppure Accesso completo al disco)." >> "$LOG"
	exit 0
fi
shopt -s nullglob
sleep 1   # Chrome scrive .crdownload e poi rinomina: un attimo per finire
for f in "$SRC"/*.xpf "$SRC"/*.XPF; do
	[ -f "$f" ] || continue
	s1=$(stat -f%z "$f"); sleep 1; s2=$(stat -f%z "$f")
	[ "$s1" = "$s2" ] || continue            # ancora in scrittura: al prossimo giro
	[ "$s1" -gt 100 ] || continue            # file vuoto o rotto
	# deve essere un lavoro Graphtec vero: il codice G1200xxxx sta all'offset 60
	id=$(dd if="$f" bs=1 skip=60 count=9 2>/dev/null)
	case "$id" in G1200*) ;; *) echo "$(date '+%F %T') ignoro $(basename "$f"): non e' un file di taglio Graphtec" >> "$LOG"; continue ;; esac
	name=$(basename "$f" | sed -E 's/ \([0-9]+\)(\.[xX][pP][fF])$/\1/')   # "nome (1).xpf" -> "nome.xpf"
	xattr -d com.apple.quarantine "$f" 2>/dev/null
	if mv -f "$f" "$DST/$name"; then
		echo "$(date '+%F %T') $name ($id) -> $DST" >> "$LOG"
	else
		echo "$(date '+%F %T') ERRORE: non riesco a spostare $(basename "$f") in $DST" >> "$LOG"
	fi
done
