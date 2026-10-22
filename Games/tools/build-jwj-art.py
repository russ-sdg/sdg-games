#!/usr/bin/env python3
"""Build the web images for the Journeys with Jesus page: assets/jwj/<name>.webp from the originals in assets/.

Run from the repo root:  python3 Games/tools/build-jwj-art.py
"""
import os
from PIL import Image

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..')
A = os.path.join(ROOT, 'assets')
ART = {                       # output name -> (original file in assets/, widest output in pixels)
    'play-space': ('JwJ Sample Play Space.png', 1200),
    'setup': ('JwJ Small Sample Play.png', 800),
    'galilee': ('JwJ New Board.png', 800),
    'judea': ('JwJ glimpse.png', 400),
    'cards': ('JwJCardsV2.webp', 600),
    'journey-card': ('SmCapernaumNazarethV2.png', 500),
    'wild-card': ('SmallGALILEEx10v2.png', 500),
    'extension': ('Journey-Extension-Example.webp', 1000),
    'expansion-box': ('JwJ GoJ box.png', 471),
}
# pictures whose white background is baked in (not transparent in the original): make the outer white transparent
KNOCK_OUT = {'extension', 'expansion-box'}
def knock_out_white(im, tol=14):
    from collections import deque
    px = im.load(); w, h = im.size
    near = lambda p: p[0] >= 255 - tol and p[1] >= 255 - tol and p[2] >= 255 - tol
    seen = bytearray(w * h); q = deque()
    for x in range(w):
        for y in (0, h - 1): q.append((x, y))
    for y in range(h):
        for x in (0, w - 1): q.append((x, y))
    while q:                                                           # flood fill inward from the edges only
        x, y = q.popleft()
        if not (0 <= x < w and 0 <= y < h) or seen[y * w + x] or not near(px[x, y]): continue
        seen[y * w + x] = 1; px[x, y] = (255, 255, 255, 0)
        q.extend(((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)))
    return im

for name, (src, wide) in ART.items():
    im = Image.open(os.path.join(A, src))
    im = im.convert('RGBA')                                           # keep transparency: the pictures sit on the page, not on white
    if name in KNOCK_OUT: im = knock_out_white(im)
    if im.width > wide: im = im.resize((wide, round(im.height * wide / im.width)), Image.LANCZOS)
    im.save(os.path.join(A, 'jwj', name + '.webp'), 'WEBP', quality=84, method=6)
    print(name, im.size)
