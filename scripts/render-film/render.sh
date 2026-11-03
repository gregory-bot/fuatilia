#!/usr/bin/env bash
# Export "Amina's journey" as a 1080p MP4 with Kenyan-voiced narration and music.
# Needs: ffmpeg, Google Chrome, Node, Python 3, and the app running (make dev).
#   scripts/render-film/render.sh [en|sw]
set -euo pipefail
LANG_CODE="${1:-en}"
HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"
WORK="$ROOT/video/.work"
OUT="$ROOT/video/fuatilia-aminas-journey-1080p-$LANG_CODE.mp4"
mkdir -p "$WORK"

[ -d "$HERE/.venv" ] || python3 -m venv "$HERE/.venv"
"$HERE/.venv/bin/pip" install -q edge-tts
[ -d "$HERE/node_modules" ] || (cd "$HERE" && npm install --silent --no-audit --no-fund playwright-core@1.55.0)

(cd "$ROOT/frontend" && node -e "import('./src/components/film/scenes.js').then(m => console.log(JSON.stringify(m.SCENES.map(s => s.voice))))") > "$WORK/script.json"
"$HERE/.venv/bin/python" "$HERE/narration.py" "$WORK" "$LANG_CODE"
node "$HERE/record.mjs" "$WORK" "$LANG_CODE"
python3 "$HERE/mix_and_encode.py" "$WORK" "$LANG_CODE" "$OUT"
