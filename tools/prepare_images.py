#!/usr/bin/env python3
"""Resize/compress the real Season 1 萌可 images and build app icons.
Only resizes, re-encodes and pads to square with white. No other edits.
Usage: /workspace/.pwvenv/bin/python tools/prepare_images.py   (needs Pillow)
"""
import json, os
from PIL import Image

SRC = "/workspace/momoke/images/s1"
APP = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DST = os.path.join(APP, "img", "s1")
ICONS = os.path.join(APP, "icons")
LONG = 600

def pad_square(im, color=(255, 255, 255)):
    w, h = im.size
    if w == h:
        return im
    s = max(w, h)
    canvas = Image.new("RGB", (s, s), color)
    canvas.paste(im, ((s - w) // 2, (s - h) // 2))
    return canvas

os.makedirs(DST, exist_ok=True)
os.makedirs(ICONS, exist_ok=True)
manifest = json.load(open(os.path.join(SRC, "manifest.json"), encoding="utf-8"))
for m in manifest:
    im = Image.open(os.path.join(SRC, m["file"])).convert("RGB")
    im = pad_square(im)
    if max(im.size) > LONG:
        im = im.resize((LONG, LONG), Image.LANCZOS)
    out = os.path.join(DST, m["file"])
    im.save(out, "JPEG", quality=85, optimize=True, progressive=True)
    print(m["file"], im.size, os.path.getsize(out))

aixin = pad_square(Image.open(os.path.join(SRC, "01_aixin.jpg")).convert("RGB"))
for size, name in [(180, "apple-touch-icon.png"), (192, "icon-192.png"), (512, "icon-512.png")]:
    aixin.resize((size, size), Image.LANCZOS).save(os.path.join(ICONS, name), "PNG", optimize=True)
    print(name)


# ---------------------------------------------------------------------------
# Season 1 princesses (5) and episode stills (52, v2) — added 2026-09-26.
# Princess: flatten any transparency onto white, pad to square with white, ~600px.
# Stills: fit inside 800×450 (aspect kept), JPEG q85. No other edits.
# ---------------------------------------------------------------------------
PRINCESS_SRC = "/workspace/momoke/images/s1_princess"
PRINCESS = [  # (source file, output file) — alt_* files are intentionally not used
    ("01_aixin_gongzhu.png", "01_aixin.jpg"),     # 愛心公主 s1-p-01
    ("02_zhengyi_gongzhu.png", "02_zhengyi.jpg"), # 正義公主 s1-p-02
    ("03_yongqi_gongzhu.png", "03_yongqi.jpg"),   # 勇氣公主 s1-p-03
    ("04_xiwang_gongzhu.png", "04_xiwang.jpg"),   # 希望公主 s1-p-04
    ("05_yinyue_gongzhu.png", "05_yinyue.jpg"),   # 音樂公主 s1-p-05
]
# Stills v2 (2026-09-26): 52 stills, 2 per episode (ep01_a … ep26_b), from s1_stills_v2/manifest.json.
# Output keeps the source file name: img/stills/ep01_a.jpg … (the old s1_stills / s1-still-XX files are no longer used).
STILLS_SRC = "/workspace/momoke/images/s1_stills_v2"
STILLS = [(m["file"], m["file"]) for m in json.load(open(os.path.join(STILLS_SRC, "manifest.json"), encoding="utf-8"))]
STILL_W, STILL_H = 800, 450  # fit inside 800×450, keep aspect ratio (no crop, no padding)

def flatten_white(im):
    if im.mode in ("RGBA", "LA") or (im.mode == "P" and "transparency" in im.info):
        im = im.convert("RGBA")
        bg = Image.new("RGB", im.size, (255, 255, 255))
        bg.paste(im, mask=im.getchannel("A"))
        return bg
    return im.convert("RGB")

pdst = os.path.join(APP, "img", "princess")
os.makedirs(pdst, exist_ok=True)
for src, out in PRINCESS:
    im = pad_square(flatten_white(Image.open(os.path.join(PRINCESS_SRC, src))))
    if max(im.size) > LONG:
        im = im.resize((LONG, LONG), Image.LANCZOS)
    im.save(os.path.join(pdst, out), "JPEG", quality=85, optimize=True, progressive=True)
    print(src, "->", out, im.size)

sdst = os.path.join(APP, "img", "stills")
os.makedirs(sdst, exist_ok=True)
for f in os.listdir(sdst):  # remove files that are no longer in the manifest (e.g. old s1-still-XX.jpg)
    if f not in {o for _, o in STILLS}:
        os.remove(os.path.join(sdst, f)); print("removed old", f)
for src, out in STILLS:
    im = flatten_white(Image.open(os.path.join(STILLS_SRC, src)))
    im.thumbnail((STILL_W, STILL_H), Image.LANCZOS)
    im.save(os.path.join(sdst, out), "JPEG", quality=85, optimize=True, progressive=True)
    print(src, "->", out, im.size)
