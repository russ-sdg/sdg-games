#!/usr/bin/env python3
"""Build the web images for the cards on games.html: assets/games/<slug>.webp from each game's card art.

Run from the repo root:  python3 Games/tools/build-game-art.py
The originals in assets/ are left alone. Add a line to ART when you add a game.
"""
import os
from PIL import Image

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..')
A = os.path.join(ROOT, 'assets')
ART = {                       # slug -> original file in assets/
    'fots': 'FotS450-300.png', 'fruity': 'Fruity 450x300 v1.webp', 'illuminate': 'Illuminate400-300.png',
    'jfp': 'JfP450-300.png', 'jtj': 'JtJ450-300.png', 'jwj': 'JwJ450-300.png', 'pk': 'PK450-300.png',
    'catacombs': 'Catacombs450-300.png', 'romanroad': 'RomanRoad450-300.png', '3x3': '3x3450-300.png',
    'tyndale': 'Tyndale450-300.png', 'wordwords': 'WordWords450-300.jpg',
    'sixdays': '6days/cards/day6-mankind-01-960.webp',
}
for slug, src in ART.items():
    im = Image.open(os.path.join(A, src)).convert('RGB')
    if im.size != (450, 300):                     # art that is not already 450 x 300: crop to 3:2 from the middle, then resize
        w, h = im.size
        cw, ch = (w, round(w * 2 / 3)) if w / h < 1.5 else (round(h * 1.5), h)
        x, y = (w - cw) // 2, (h - ch) // 2
        im = im.crop((x, y, x + cw, y + ch)).resize((450, 300), Image.LANCZOS)
    im.save(os.path.join(A, 'games', slug + '.webp'), 'WEBP', quality=85, method=6)
    print(slug, im.size)
