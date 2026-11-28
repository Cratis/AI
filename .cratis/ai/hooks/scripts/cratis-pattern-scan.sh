#!/usr/bin/env bash
# Fixed patterns only. No configuration files, session cache or user text in output.
[[ ${CRATIS_HOOKS_SKIP_SCAN:-} == 1 ]] && exit 0
python3 -I -c '
import json, os, re, stat, sys
from pathlib import Path

def scan():
    data = sys.stdin.buffer.read(16385)
    if len(data) > 16384: return
    request = json.loads(data)
    root = Path(os.environ["CLAUDE_PROJECT_DIR"]).resolve(strict=True)
    tool = request["tool_input"]
    file = Path(request.get("cwd", root)) / (tool.get("file_path") or tool["notebook_path"])
    parts = file.relative_to(root).parts
    if not parts or file.suffix not in (".cs", ".tsx", ".ts"): return
    if any(p.startswith(".") or re.search(r"secret|credential|password|token|private.?key|(^|[._-])env($|[._-])", p, re.I) or p.lower() in {"node_modules", "bin", "obj", "dist", "wwwroot"} for p in parts): return
    # Walk from a pinned directory descriptor. Never follow any child symlink.
    flags = os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK
    fd = os.open(root, flags | os.O_DIRECTORY)
    try:
        for i, part in enumerate(parts):
            child = os.open(part, flags | (os.O_DIRECTORY if i < len(parts)-1 else 0), dir_fd=fd)
            os.close(fd)
            fd = child
        info = os.fstat(fd)
        if not stat.S_ISREG(info.st_mode) or info.st_nlink != 1 or info.st_size > 65536: return
        with os.fdopen(os.dup(fd), "rb") as stream: raw = stream.read(65537)
        if len(raw) > 65536: return
        text = raw.decode()
    finally: os.close(fd)
    text = " ".join(line for line in text.splitlines() if not line.lstrip().startswith(("//", "/*", "*")))
    messages = []
    if file.suffix == ".cs":
        if "[Command" in text and re.search(r"(?:Handle|Provide)\s*\([^)]{0,1024}IEventLog", text): messages.append("Return command events through the append pipeline (ARCCHR0007).")
        if "Microsoft.AspNetCore.Mvc" in text and re.search(r":\s*ControllerBase\b", text): messages.append("Prefer model-bound slices unless this endpoint requires a controller.")
        if "[ReadModel" in text and "[Route(" in text: messages.append("Use Path for a custom model-bound route; Route applies to controllers.")
        if ".AutoMap(" in text and "NoAutoMap" not in text: messages.append("AutoMap is redundant unless re-enabling mapping after NoAutoMap.")
    elif re.search(r"from\s+[\x27\x22]primereact/dialog[\x27\x22]", text): messages.append("For Cratis Components 4 use the Dialogs subpath unless deliberately using PrimeReact.")
    if messages: print(json.dumps({"hookSpecificOutput":{"hookEventName":"PostToolUse","additionalContext":"Advisory: " + " ".join(messages)}}))
try: scan()
except Exception: pass
' 2>/dev/null || :
