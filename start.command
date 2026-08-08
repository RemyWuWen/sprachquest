#!/bin/bash
# Doble clic en este archivo para jugar a Sprachquest.
cd "$(dirname "$0")" || exit 1
PORT=8777
echo "🇩🇪  Sprachquest — http://localhost:$PORT"
echo "    (deja esta ventana abierta mientras juegas; Ctrl+C para salir)"
sleep 1
(command -v open >/dev/null && open "http://localhost:$PORT") &
python3 -m http.server "$PORT"
