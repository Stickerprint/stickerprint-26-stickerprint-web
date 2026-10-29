-- Postino Stickerprint: applet che lancia postino.sh (dentro Contents/Resources).
-- E' un'app vera (stub Apple), cosi' macOS chiede UNA volta il permesso sulla cartella Download e lo ricorda.
do shell script "/bin/bash " & quoted form of ((POSIX path of (path to me)) & "Contents/Resources/postino.sh")
