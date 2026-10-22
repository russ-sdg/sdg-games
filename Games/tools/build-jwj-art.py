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
for name, (src, wide) in ART.items():
    im = Image.open(os.path.join(A, src))
    if im.mode in ('RGBA', 'LA', 'P'):                               # flatten transparency onto white (the pictures sit on white)
        im = im.convert('RGBA'); bg = Image.new('RGB', im.size, 'white'); bg.paste(im, mask=im.split()[3]); im = bg
    else:
        im = im.convert('RGB')
    if im.width > wide: im = im.resize((wide, round(im.height * wide / im.width)), Image.LANCZOS)
    im.save(os.path.join(A, 'jwj', name + '.webp'), 'WEBP', quality=84, method=6)
    print(name, im.size)
