#!/usr/bin/env python3
"""Cut the four role symbols (medical symbol, heart, church, bell) out of the card pictures, so the page shows exactly what is printed.

  python3 illuminate/play/tools/build-symbols.py        (run from the repo root)

Writes assets/illuminate-web/symbols/<role>.webp (transparent background, 96 px tall).
"""
import os
from PIL import Image

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
CARDS = os.path.join(ROOT, 'assets', 'illuminate-web', 'cards')
OUT = os.path.join(ROOT, 'assets', 'illuminate-web', 'symbols')
# a card whose first symbol is this role's, and where that symbol sits (x0, y0, x1, y1 at 825 px wide)
SRC = {'preacher': 'matthew-4-17', 'teacher': 'matthew-5-6', 'doctor': 'matthew-9-22', 'neighbor': 'matthew-9-36'}
BOX = (45, 400, 235, 640)

def main():
    os.makedirs(OUT, exist_ok=True)
    for role, card in SRC.items():
        im = Image.open(os.path.join(CARDS, f'{card}-825.webp')).convert('RGB').crop(BOX)
        px, (w, h) = im.load(), im.size
        hit = []
        for y in range(h):
            for x in range(w):
                r, g, b = px[x, y]; mx, mn = max(r, g, b), min(r, g, b)
                if mx - mn > 70 or mx < 90: hit.append((x, y))      # coloured ink or dark outline, not the cream parchment
        xs, ys = [p[0] for p in hit], [p[1] for p in hit]
        box = (min(xs) - 3, min(ys) - 3, max(xs) + 4, max(ys) + 4)
        sym = im.crop(box).convert('RGBA'); sp = sym.load()
        for y in range(sym.height):                                  # make the parchment transparent
            for x in range(sym.width):
                r, g, b, a = sp[x, y]
                if max(r, g, b) - min(r, g, b) < 40 and min(r, g, b) > 150: sp[x, y] = (r, g, b, 0)
        s = 96 / sym.height
        sym = sym.resize((max(1, round(sym.width * s)), 96), Image.LANCZOS)
        sym.save(os.path.join(OUT, f'{role}.webp'), quality=90)
        print(role, sym.size)

if __name__ == '__main__':
    main()
