"""Step 1: narration clips + timeline.

Generates one clip per sentence with Microsoft's Kenyan neural voices (the same voices Edge
uses for the live film), measures each clip with ffprobe, and writes the film timeline that
both the frame recorder and the audio mix use, so subtitles and voice line up exactly.

    python narration.py <work_dir> [en|sw]
"""
import asyncio
import json
import re
import subprocess
import sys
from pathlib import Path

import edge_tts

VOICES = {"en": "en-KE-AsiliaNeural", "sw": "sw-KE-ZuriNeural"}
LEAD_MS = 1200      # music before the first line
PAUSE_MS = 250      # between sentences
GAP_MS = 1400       # between scenes (matches the web film)
END_HOLD_MS = 4500  # closing card after the last line

work = Path(sys.argv[1])
lang = sys.argv[2] if len(sys.argv) > 2 else "en"
scenes = json.loads((work / "script.json").read_text())
(work / "tts").mkdir(parents=True, exist_ok=True)


def duration_ms(path: Path) -> int:
    out = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(path)],
                         capture_output=True, text=True, check=True).stdout
    return round(float(out) * 1000)


async def main() -> None:
    t = LEAD_MS
    timeline, clips = [], []
    for i, voice in enumerate(scenes):
        sentences = [s.strip() for s in re.findall(r"[^.!?]+[.!?]*", voice[lang])]
        lines = []
        for j, text in enumerate(sentences):
            f = work / "tts" / f"{lang}_{i:02d}_{j:02d}.mp3"
            if not f.exists():
                await edge_tts.Communicate(text, VOICES[lang], rate="-6%").save(str(f))
            lines.append(t)
            clips.append({"file": str(f), "start_ms": t})
            t += duration_ms(f) + PAUSE_MS
        t += (END_HOLD_MS if i == len(scenes) - 1 else GAP_MS) - PAUSE_MS
        timeline.append({"lines": lines, "end": t})
    (work / f"timeline_{lang}.json").write_text(json.dumps({"scenes": timeline, "total_ms": t}))
    (work / f"clips_{lang}.json").write_text(json.dumps(clips))
    print(f"{len(clips)} clips, film length {t / 1000:.1f}s")


asyncio.run(main())
