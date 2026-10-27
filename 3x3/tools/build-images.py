#!/usr/bin/env python3
"""Make the web images for the Three-by-Three page from the pictures in assets/.

  python3 3x3/tools/build-images.py            (run from the repo root)

Writes WebP files to assets/3x3-web/ and a 1200x630 share picture (3x3-share.jpg). The card pictures for the gallery are made
by 3x3/tools/build-cards.py. Re-running is safe: files that are already newer than their source are skipped.
"""
import os
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
SRC, OUT = os.path.join(ROOT, 'assets'), os.path.join(ROOT, 'assets', '3x3-web')
PICS = {'matches': ('3x3ThreeMatches.webp', 1200)}
FONT_BOLD = next((p for p in ('/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf', '/usr/share/fonts/dejavu/DejaVuSerif-Bold.ttf') if os.path.exists(p)), None)
FONT = next((p for p in ('/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf', '/usr/share/fonts/dejavu/DejaVuSerif.ttf') if os.path.exists(p)), None)

def newer(out, src): return os.path.exists(out) and os.path.getmtime(out) >= os.path.getmtime(src)

def main():
    os.makedirs(OUT, exist_ok=True)
    for name, (f, w) in PICS.items():
        src, out = os.path.join(SRC, f), os.path.join(OUT, name + '.webp')
        if newer(out, src): continue
        im = Image.open(src).convert('RGBA')
        if im.width > w: im = im.resize((w, round(w * im.height / im.width)), Image.LANCZOS)
        im.save(out, 'WEBP', quality=84, method=6); print('wrote', name, im.size)
    out = os.path.join(OUT, '3x3-share.jpg')
    if os.path.exists(out): return
    bg = Image.new('RGB', (1200, 630)); d = ImageDraw.Draw(bg)
    for y in range(630):
        t = y / 629; d.line([(0, y), (1200, y)], fill=(round(38 + 22 * t), round(28 + 20 * t), round(70 + 26 * t)))
    f = lambda size, bold=True: ImageFont.truetype(FONT_BOLD if bold else FONT, size)
    d.text((60, 100), 'Three-by-Three', font=f(74), fill=(240, 200, 100))
    d.text((64, 230), 'A matching game based on the', font=f(32, False), fill=(255, 255, 255))
    d.text((64, 276), 'twelve tribes of Israel.', font=f(32, False), fill=(255, 255, 255))
    d.text((64, 340), 'Collect three sets of three.', font=f(32, False), fill=(255, 255, 255))
    d.text((64, 450), '2–6 players · 10–20 minutes', font=f(28, False), fill=(225, 220, 245))
    d.text((64, 500), 'sdggames.fun/3x3', font=f(26, False), fill=(240, 200, 100))
    xs = 600
    for i, n in enumerate(['Judah', 'Levi', 'Dan']):
        c = Image.open(os.path.join(SRC, f'3x3{n}.webp')).convert('RGBA').resize((170, 255), Image.LANCZOS)
        card = Image.new('RGBA', c.size); card.paste(c); bg.paste(card.convert('RGB'), (xs + i * 190, 150 + (i % 2) * 40), card.split()[3])
    bg.save(out, quality=88); print('wrote share picture')

if __name__ == '__main__': main()
