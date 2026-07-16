#!/bin/bash
# Spustí lokální webserver pro testování webu (otevření souboru přes file://
# nefunguje — prohlížeč kvůli CORS zablokuje textury, fetch i moduly).
# Použití: ./test_local.sh [port]   (výchozí port 8000)

cd "$(dirname "$0")" || exit 1
PORT="${1:-8000}"

echo "→ http://localhost:$PORT/                              (rozcestník)"
echo "→ http://localhost:$PORT/obsah/planet_globe.html       (glóbusy planet)"
echo "→ http://localhost:$PORT/obsah/weather_globe.html      (glóbus počasí)"
echo "→ http://localhost:$PORT/obsah/solar_system.html       (sluneční soustava)"
echo
echo "POZOR: i lokálně se registruje service worker — pokud vidíš starou verzi,"
echo "načti stránku podruhé, nebo použij Ctrl+Shift+R."
echo "Ukončení: Ctrl+C"
echo

python -m http.server "$PORT" --bind 127.0.0.1
