#!/usr/bin/env python3
"""Build the web images for the home page (index.html): the family photo and the clothing pictures.

Run from the repo root:  python3 Home/tools/build-home-art.py
Writes WebP files to assets/home/; the originals in assets/ are left alone. Add a line to ART for a new picture.
"""
import os
from PIL import Image

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..')
A = os.path.join(ROOT, 'assets')
ART = {                       # output name -> original file in assets/
    'family': '900_400_family.png',
    'shirt-be-kind': 'Ephesians 4-32 T-Shirt.png',
    'shirt-gracious-words': 'Proverbs 16-24 T-Shirt.png',
    'shirt-five-solas': 'Five Solas T-Shirt.png',
}
for name, src in ART.items():
    im = Image.open(os.path.join(A, src))
    im = im.convert('RGBA') if im.mode in ('RGBA', 'LA', 'P') else im.convert('RGB')
    if im.mode == 'RGBA':                          # flatten transparency onto white
        bg = Image.new('RGB', im.size, 'white'); bg.paste(im, mask=im.split()[3]); im = bg
    im.save(os.path.join(A, 'home', name + '.webp'), 'WEBP', quality=84, method=6)
    print(name, im.size)
