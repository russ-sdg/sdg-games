#!/usr/bin/env python3
"""Make the web images for the Prophets & Kings page from the pictures in assets/.

  python3 pk/tools/build-images.py            (run from the repo root)

Writes WebP files to assets/pk-web/ and a 1200x630 share picture (pk-share.jpg). Re-running is safe: files that are
already newer than their source are skipped.
"""
import os
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
SRC, OUT = os.path.join(ROOT, 'assets'), os.path.join(ROOT, 'assets', 'pk-web')
PICS = {'action': ('PKActionShot1V1.webp', 800), 'scoring-examples': ('PKScoringExamples.png', 800),
        'deck-summary': ('PK-deck-summary.webp', 517)}
CARDS = os.path.join(SRC, 'pk')           # the card pictures (assets/pk/*.png)
SAMPLES = ['Elisha2V3.png', 'Ahaziah1V2.png', 'Uzziah3V2.png', 'Nebuchadnezzar3V2.png']   # a prophet, a king of Israel, of Judah, and a foreign king
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
    out = os.path.join(OUT, 'samples.webp'); paths = [os.path.join(CARDS, f) for f in SAMPLES]
    if not all(newer(out, p) for p in paths):
        w, gap = 400, 20; ims = [Image.open(p).convert('RGBA') for p in paths]; h = round(w * ims[0].height / ims[0].width)
        row = Image.new('RGBA', (len(ims) * w + (len(ims) - 1) * gap, h), (0, 0, 0, 0))
        for i, im in enumerate(ims): row.alpha_composite(im.resize((w, h), Image.LANCZOS), (i * (w + gap), 0))
        row.save(out, 'WEBP', quality=84, method=6); print('wrote samples', row.size)
    out = os.path.join(OUT, 'pk-share.jpg')
    if os.path.exists(out): return
    bg = Image.new('RGB', (1200, 630)); d = ImageDraw.Draw(bg)
    for y in range(630):
        t = y / 629; d.line([(0, y), (1200, y)], fill=(round(44 + 36 * t), round(24 + 14 * t), round(78 + 20 * t)))
    f = lambda size, bold=True: ImageFont.truetype(FONT_BOLD if bold else FONT, size)
    d.text((70, 40), 'Prophets & Kings', font=f(84), fill=(240, 196, 94))
    d.text((74, 150), 'A set-building card game from the Old Testament', font=f(34, False), fill=(255, 255, 255))
    cards = Image.open(os.path.join(OUT, 'samples.webp')).convert('RGBA'); w = 1000
    cards = cards.resize((w, round(w * cards.height / cards.width)), Image.LANCZOS)
    bg.paste(cards, (100, 250), cards)
    d.text((74, 200), 'sdggames.fun/pk', font=f(24, False), fill=(240, 196, 94))
    bg.save(out, quality=88); print('wrote share picture')

if __name__ == '__main__': main()
