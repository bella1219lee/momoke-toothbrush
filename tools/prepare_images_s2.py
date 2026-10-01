#!/usr/bin/env python3
"""Season 2 images (added 2026-10-01): 20 萌可 (square, ~600px) + 52 stills (fit inside 800x450, aspect kept).
Only resizes, re-encodes and pads to square with white. No other edits.
  img/s2/<file from /workspace/momoke/images/s2/manifest.json>          e.g. img/s2/01_xingfu_v2.jpg
  img/s2_stills/epNN_a.jpg ... (from /workspace/momoke/images/s2_stills/manifest.json)
Usage: /workspace/.pwvenv/bin/python tools/prepare_images_s2.py   (needs Pillow)
"""
import json, os
from PIL import Image

APP = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC_M = "/workspace/momoke/images/s2"
SRC_S = "/workspace/momoke/images/s2_stills"
LONG = 600
STILL_W, STILL_H = 800, 450

def pad_square(im, color=(255, 255, 255)):
    w, h = im.size
    if w == h:
        return im
    s = max(w, h)
    canvas = Image.new("RGB", (s, s), color)
    canvas.paste(im, ((s - w) // 2, (s - h) // 2))
    return canvas

def flatten_white(im):
    if im.mode in ("RGBA", "LA") or (im.mode == "P" and "transparency" in im.info):
        im = im.convert("RGBA")
        bg = Image.new("RGB", im.size, (255, 255, 255))
        bg.paste(im, mask=im.getchannel("A"))
        return bg
    return im.convert("RGB")

dm = os.path.join(APP, "img", "s2"); os.makedirs(dm, exist_ok=True)
for m in json.load(open(os.path.join(SRC_M, "manifest.json"), encoding="utf-8")):
    im = pad_square(flatten_white(Image.open(os.path.join(SRC_M, m["file"]))))
    if max(im.size) > LONG:
        im = im.resize((LONG, LONG), Image.LANCZOS)
    out = os.path.join(dm, m["file"])
    im.save(out, "JPEG", quality=85, optimize=True, progressive=True)
    print(m["order"], m["name"], m["file"], im.size, os.path.getsize(out))

ds = os.path.join(APP, "img", "s2_stills"); os.makedirs(ds, exist_ok=True)
for m in json.load(open(os.path.join(SRC_S, "manifest.json"), encoding="utf-8")):
    im = flatten_white(Image.open(os.path.join(SRC_S, m["file"])))
    im.thumbnail((STILL_W, STILL_H), Image.LANCZOS)
    out = os.path.join(ds, m["file"])
    im.save(out, "JPEG", quality=85, optimize=True, progressive=True)
    print(m["file"], im.size, os.path.getsize(out))
