#!/usr/bin/env python3
"""Make the web images for the Journeys through Jerusalem page from the pictures in assets/.

  python3 JtJ/tools/build-images.py            (run from the repo root)

Writes WebP files to assets/jtj-web/ and a 1200x630 share picture (jtj-share.jpg). Re-running is safe: files that are
already newer than their source are skipped.
"""
import os
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
SRC, OUT = os.path.join(ROOT, 'assets'), os.path.join(ROOT, 'assets', 'jtj-web')
PICS = {'gameplay': ('JtJgameplay.webp', 900), 'map': ('JtJ Mini Map .png', 300), 'cards': ('JtJcards.webp', 525), 'tokens': ('JtJtokens.png', 640)}
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
        im.save(out, 'WEBP', quality=82, method=6); print('wrote', name, im.size)
    out = os.path.join(OUT, 'jtj-share.jpg')
    if os.path.exists(out): return
    bg = Image.new('RGB', (1200, 630)); d = ImageDraw.Draw(bg)
    for y in range(630):
        t = y / 629; d.line([(0, y), (1200, y)], fill=(round(48 + 40 * t), round(30 + 28 * t), round(16 + 6 * t)))
    f = lambda size, bold=True: ImageFont.truetype(FONT_BOLD if bold else FONT, size)
    d.text((60, 90), 'Journeys', font=f(84), fill=(242, 193, 78))
    d.text((60, 190), 'through Jerusalem', font=f(50), fill=(242, 193, 78))
    d.text((64, 310), 'Follow Biblical characters through', font=f(32, False), fill=(255, 255, 255))
    d.text((64, 356), "Jesus' final days in Jerusalem.", font=f(32, False), fill=(255, 255, 255))
    d.text((64, 450), '2–6 players · 15–30 minutes', font=f(28, False), fill=(235, 224, 200))
    d.text((64, 500), 'sdggames.fun/JtJ', font=f(26, False), fill=(242, 193, 78))
    g = Image.open(os.path.join(SRC, 'JtJgameplay.webp')).convert('RGBA'); w = 490
    g = g.resize((w, w), Image.LANCZOS)
    m = Image.new('L', g.size, 0); ImageDraw.Draw(m).rounded_rectangle([0, 0, w - 1, w - 1], 24, fill=255)
    bg.paste(g.convert('RGB'), (670, 70), m)
    bg.save(out, quality=88); print('wrote share picture')

if __name__ == '__main__': main()
