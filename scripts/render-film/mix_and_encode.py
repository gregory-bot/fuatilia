"""Step 3: mix narration over the (auto-ducked) music and encode the 1080p MP4.

    python mix_and_encode.py <work_dir> <lang> <output.mp4>
"""
import json
import subprocess
import sys
from pathlib import Path

work, lang, out = Path(sys.argv[1]), sys.argv[2], Path(sys.argv[3])
clips = json.loads((work / f"clips_{lang}.json").read_text())
total_s = json.loads((work / f"timeline_{lang}.json").read_text())["total_ms"] / 1000

inputs = ["-i", str(work / f"music_{lang}.wav")]
chains, labels = [], []
for n, c in enumerate(clips, start=1):
    inputs += ["-i", c["file"]]
    ms = c["start_ms"]
    chains.append(f"[{n}:a]aresample=48000,aformat=channel_layouts=stereo,adelay={ms}|{ms}[v{n}]")
    labels.append(f"[v{n}]")
# The voice is padded to the full film length: the ducking filter stops when its sidechain
# ends, which would otherwise cut the music (and the closing card) short.
graph = ";".join(chains) + ";" + "".join(labels) + f"amix=inputs={len(labels)}:normalize=0,volume=1.6,apad=whole_dur={total_s}[voice];" \
    "[voice]asplit=2[vk][vm];" \
    "[0:a]aformat=channel_layouts=stereo[mus];" \
    "[mus][vk]sidechaincompress=threshold=0.015:ratio=8:attack=60:release=900[ducked];" \
    "[ducked][vm]amix=inputs=2:normalize=0,loudnorm=I=-16:TP=-1.5:LRA=11[aout]"

audio = work / f"audio_{lang}.m4a"
subprocess.run(["ffmpeg", "-y", "-loglevel", "error", *inputs, "-filter_complex", graph, "-map", "[aout]",
                "-c:a", "aac", "-b:a", "256k", "-ar", "48000", str(audio)], check=True)

out.parent.mkdir(parents=True, exist_ok=True)
subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-framerate", "30", "-i", str(work / f"frames_{lang}" / "%05d.jpg"),
                "-i", str(audio), "-c:v", "libx264", "-preset", "slow", "-crf", "16", "-profile:v", "high",
                "-pix_fmt", "yuv420p", "-c:a", "copy", "-shortest", "-movflags", "+faststart", str(out)], check=True)
print(f"wrote {out}")
