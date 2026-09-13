#!/usr/bin/env python3
import json
import sys
import tempfile
import os

os.environ.setdefault("FLAGS_use_mkldnn", "0")

from paddleocr import PaddleOCR

ocr = PaddleOCR(use_angle_cls=False, lang="korean", show_log=False, use_gpu=False)
print("READY", flush=True)


def read_image(path):
    result = ocr.ocr(path, cls=False)
    lines = []
    confs = []
    if not result or result[0] is None:
        return "", 0
    page = result[0] or []
    for item in page:
        if not item or len(item) < 2:
            continue
        text, conf = item[1]
        if not text:
            continue
        confs.append(float(conf))
        lines.append(str(text).strip())
    avg = int(round(100 * (sum(confs) / len(confs)))) if confs else 0
    return "\n".join(lines), avg


for raw in sys.stdin:
    raw = raw.strip()
    if not raw:
        continue
    try:
        msg = json.loads(raw)
        data = msg.get("image") or ""
        if "," in data:
            data = data.split(",", 1)[1]
        import base64

        buf = base64.b64decode(data)
        fd, path = tempfile.mkstemp(suffix=".jpg")
        os.close(fd)
        with open(path, "wb") as f:
            f.write(buf)
        try:
            text, conf = read_image(path)
        finally:
            try:
                os.remove(path)
            except OSError:
                pass
        print(json.dumps({"ok": True, "text": text, "confidence": conf}, ensure_ascii=False), flush=True)
    except Exception as exc:
        print(json.dumps({"ok": False, "error": str(exc)}), flush=True)
