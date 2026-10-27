#!/usr/bin/env python3
"""Make the web images for the Fruity page from the card pictures in assets/.

  python3 fruity/tools/build-images.py            (run from the repo root)

Writes to assets/fruity/: a 320 px wide WebP of every card (for the page's small pictures; the full-size cards in assets/ are
what opens when you tap one), the wide picture of the cards for the top of the page, and a 1200x630 share picture.
Re-running is safe: files that are already newer than their source are skipped.
"""
import os
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
SRC, OUT = os.path.join(ROOT, 'assets'), os.path.join(ROOT, 'assets', 'fruity')
CARDS = ['Love', 'Joy', 'Peace', 'Patience', 'Kindness', 'Goodness', 'Faithfulness', 'Gentleness', 'SelfControl']
OTHERS = ['Basket1', 'Basket4', 'Basket8', 'Instructions']
FONT_BOLD = next((p for p in ('/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf', '/usr/share/fonts/dejavu/DejaVuSerif-Bold.ttf') if os.path.exists(p)), None)
FONT = next((p for p in ('/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf', '/usr/share/fonts/dejavu/DejaVuSerif.ttf') if os.path.exists(p)), None)

def newer(out, src): return os.path.exists(out) and os.path.getmtime(out) >= os.path.getmtime(src)

def save_webp(src, out, width):
    if newer(out, src): return
    im = Image.open(src).convert('RGBA')
    if im.width > width: im = im.resize((width, round(width * im.height / im.width)), Image.LANCZOS)
    im.save(out, 'WEBP', quality=82, method=6); print('wrote', os.path.basename(out), im.size)

def main():
    os.makedirs(OUT, exist_ok=True)
    for n in CARDS + OTHERS:
        save_webp(os.path.join(SRC, f'Fruity{n}.webp'), os.path.join(OUT, f'{n.lower()}-320.webp'), 320)
    save_webp(os.path.join(SRC, 'Fruity Complete Set 1 v1.webp'), os.path.join(OUT, 'set.webp'), 1100)
    out = os.path.join(OUT, 'fruity-share.jpg')
    if os.path.exists(out): return
    bg = Image.new('RGB', (1200, 630)); d = ImageDraw.Draw(bg)
    for y in range(630):
        t = y / 629; d.line([(0, y), (1200, y)], fill=(round(28 + 40 * t), round(16 + 10 * t), round(96 + 20 * t)))
    f = lambda size, bold=True: ImageFont.truetype(FONT_BOLD if bold else FONT, size)
    d.text((70, 20), 'Fruity', font=f(100), fill=(255, 201, 77))
    d.text((74, 140), 'A simple card collecting game', font=f(36, False), fill=(255, 255, 255))
    d.text((74, 192), '2\u20136 players \u00b7 5\u201310 minutes', font=f(28, False), fill=(226, 220, 250))
    cards = Image.open(os.path.join(SRC, 'Fruity Complete Set 1 v1.webp')).convert('RGBA'); w = 900
    cards = cards.resize((w, round(w * cards.height / cards.width)), Image.LANCZOS)
    bg.paste(cards, (150, 630 - cards.height - 20), cards)
    d.text((740, 40), 'Collect three fruits', font=f(38), fill=(255, 255, 255))
    d.text((740, 92), 'of the Spirit.', font=f(38), fill=(255, 255, 255))
    d.text((740, 160), 'sdggames.fun/fruity', font=f(26, False), fill=(255, 201, 77))
    bg.save(out, quality=88); print('wrote share picture')

if __name__ == '__main__': main()
