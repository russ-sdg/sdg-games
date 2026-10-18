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
}
for slug, src in ART.items():
    im = Image.open(os.path.join(A, src)).convert('RGB')
    im.save(os.path.join(A, 'games', slug + '.webp'), 'WEBP', quality=85, method=6)
    print(slug, im.size)
