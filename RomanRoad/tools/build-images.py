#!/usr/bin/env python3
"""Make the web images for the Roman Road page from the pictures in assets/.

  python3 RomanRoad/tools/build-images.py            (run from the repo root)

Writes WebP files to assets/rr-web/ and a 1200x630 share picture (rr-share.jpg). Re-running is safe: files that are
already newer than their source are skipped.
"""
import os
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
SRC, OUT = os.path.join(ROOT, 'assets'), os.path.join(ROOT, 'assets', 'rr-web')
PICS = {'hero': ('RomanRoad450-300.png', 450), 'backs': ('RRcardbacksV1.png', 867), 'faces': ('RRfaces.png', 1600), 'setup': ('RRInitialSetupV2.png', 800),
        'foundation': ('RRFoundationPilesV2.png', 800), 'movement': ('RRMovementBeforeV2.png', 800), 'firstplay': ('RRFirstPlayV1.png', 800),
        'building-start': ('RRBuilding Start.png', 1200), 'building-play': ('RRPlaying Start.png', 1200), 'glimpse': ('RR glimpse.png', 400)}
FONT_BOLD = next((p for p in ('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', '/usr/share/fonts/dejavu/DejaVuSans-Bold.ttf') if os.path.exists(p)), None)
FONT = next((p for p in ('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', '/usr/share/fonts/dejavu/DejaVuSans.ttf') if os.path.exists(p)), None)

def newer(out, src): return os.path.exists(out) and os.path.getmtime(out) >= os.path.getmtime(src)

def main():
    os.makedirs(OUT, exist_ok=True)
    for name, (f, w) in PICS.items():
        src, out = os.path.join(SRC, f), os.path.join(OUT, name + '.webp')
        if newer(out, src): continue
        im = Image.open(src).convert('RGBA')
        if im.width > w: im = im.resize((w, round(w * im.height / im.width)), Image.LANCZOS)
        im.save(out, 'WEBP', quality=84, method=6); print('wrote', name, im.size)
    out = os.path.join(OUT, 'rr-share.jpg')
    if os.path.exists(out): return
    bg = Image.new('RGB', (1200, 630)); d = ImageDraw.Draw(bg)
    for y in range(630):
        t = y / 629; d.line([(0, y), (1200, y)], fill=(round(22 + 14 * t), round(34 + 22 * t), round(70 + 30 * t)))
    f = lambda size, bold=True: ImageFont.truetype(FONT_BOLD if bold else FONT, size)
    d.text((60, 110), 'Roman Road', font=f(92), fill=(247, 190, 80))
    d.text((64, 250), 'A fast-paced card game that', font=f(34, False), fill=(255, 255, 255))
    d.text((64, 298), 'shares the gospel in four verses', font=f(34, False), fill=(255, 255, 255))
    d.text((64, 346), 'from Romans.', font=f(34, False), fill=(255, 255, 255))
    d.text((64, 450), '2–4 players · 15–30 minutes', font=f(28, False), fill=(220, 228, 245))
    d.text((64, 500), 'sdggames.fun/RomanRoad', font=f(26, False), fill=(247, 190, 80))
    g = Image.open(os.path.join(SRC, 'RomanRoad450-300.png')).convert('RGB').resize((540, 360), Image.LANCZOS)
    m = Image.new('L', g.size, 0); ImageDraw.Draw(m).rounded_rectangle([0, 0, g.width - 1, g.height - 1], 24, fill=255)
    bg.paste(g, (610, 135), m)
    bg.save(out, quality=88); print('wrote share picture')

if __name__ == '__main__': main()
