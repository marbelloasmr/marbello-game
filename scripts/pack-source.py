import os
import re
import zipfile

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
OUT = os.path.join(ROOT, "public", "marbello-kod.zip")
SKIP_DIRS = {
    "node_modules",
    ".vercel",
    ".tanstack",
    "screenshots",
    "attachments",
    "artifacts",
    "dist",
    ".git",
}
SKIP_FILES = {"marbello-kod.zip", "marbello-game.zip", ".node_modules.lock"}
MARKER = re.compile(r"[ \t]*\{/\* source-download:start \*/\}.*?\{/\* source-download:end \*/\}[ \t]*\n?", re.S)

def keep(path: str) -> bool:
    rel = os.path.relpath(path, ROOT)
    parts = rel.split(os.sep)
    if parts[0] in SKIP_DIRS:
        return False
    if os.path.basename(path) in SKIP_FILES:
        return False
    return True

def payload(path: str) -> bytes:
    with open(path, "rb") as handle:
        data = handle.read()
    if path.endswith((".tsx", ".ts", ".css")):
        text = data.decode("utf-8")
        text = MARKER.sub("", text)
        return text.encode("utf-8")
    return data

os.makedirs(os.path.dirname(OUT), exist_ok=True)
if os.path.exists(OUT):
    os.remove(OUT)

with zipfile.ZipFile(OUT, "w", compression=zipfile.ZIP_DEFLATED) as archive:
    for dirpath, dirnames, filenames in os.walk(ROOT):
        dirnames[:] = [name for name in dirnames if name not in SKIP_DIRS]
        for name in filenames:
            full = os.path.join(dirpath, name)
            if not keep(full):
                continue
            rel = os.path.relpath(full, ROOT)
            archive.writestr(rel, payload(full))

with zipfile.ZipFile(OUT) as archive:
    play = archive.read("src/components/game/PlayExperience.tsx").decode("utf-8")
    if "Pobierz kod" in play or "source-download" in play:
        raise SystemExit("download button leaked into the zip")
print(OUT, os.path.getsize(OUT))
