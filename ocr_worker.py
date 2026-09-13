#!/usr/bin/env python3
import base64
import json
import os
import sys

os.environ.setdefault("FLAGS_use_mkldnn", "0")

import cv2
import numpy as np
from paddleocr import PaddleOCR

ocr = PaddleOCR(use_angle_cls=False, lang="korean", show_log=False, use_gpu=False)
print("READY", flush=True)


def read_image(buf):
    arr = np.frombuffer(buf, dtype=np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if img is None:
        return []
    h = img.shape[0]
    result = ocr.ocr(img, cls=False)
    lines = []
    if not result or result[0] is None:
        return lines
    for item in result[0]:
        if not item or len(item) < 2:
            continue
        box, (text, conf) = item[0], item[1]
        if not text:
            continue
        ys = [p[1] for p in box]
        y = (sum(ys) / len(ys)) / max(h, 1)
        lines.append({"text": str(text).strip(), "conf": float(conf), "y": float(y)})
    return lines


for raw in sys.stdin:
    raw = raw.strip()
    if not raw:
        continue
    try:
        msg = json.loads(raw)
        data = msg.get("image") or ""
        if "," in data:
            data = data.split(",", 1)[1]
        buf = base64.b64decode(data)
        lines = read_image(buf)
        print(json.dumps({"ok": True, "lines": lines}, ensure_ascii=False), flush=True)
    except Exception as exc:
        print(json.dumps({"ok": False, "error": str(exc)}), flush=True)
