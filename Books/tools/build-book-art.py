#!/usr/bin/env python3
"""Build the web images for the book product pages (tyndale_book, FPtF, WICRBC).

Run from the repo root:  python3 Books/tools/build-book-art.py
Covers become assets/books/<slug>/cover-{480,820}.webp; the chapter illustrations (SVG files that wrap one JPEG)
become assets/books/<slug>/ch<N>-{480,820}.webp. The original files in assets/ are left alone.
"""
import base64, os, re, io
from PIL import Image

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..')
A = os.path.join(ROOT, 'assets')
BOOKS = {
    'tyndale': {'cover': 'Tyndale_cover.png', 'ill': [('TyndaleChapter%d.svg', n) for n in (1, 2, 8, 9, 10, 12, 17)]},
    'fptf': {'cover': '1689_cover.jpg', 'ill': [('1689Chapter%d.svg', n) for n in (1, 2, 14, 15, 16)]},
    'wicrbc': {'cover': 'WICRBC_cover.png', 'ill': []},
}
WIDTHS = (480, 820)

def save(im, out, stem):
    im = im.convert('RGB')
    for w in WIDTHS:
        h = round(im.height * w / im.width)
        r = im.resize((w, h), Image.LANCZOS)
        r.save(os.path.join(out, f'{stem}-{w}.webp'), 'WEBP', quality=82, method=6)
        print(stem, w, h)

for slug, b in BOOKS.items():
    out = os.path.join(A, 'books', slug)
    os.makedirs(out, exist_ok=True)
    save(Image.open(os.path.join(A, b['cover'])), out, 'cover')
    for pat, n in b['ill']:
        svg = open(os.path.join(A, pat % n), encoding='utf-8').read()
        m = re.search(r'href="data:image/\w+;base64,([^"]+)"', svg)
        save(Image.open(io.BytesIO(base64.b64decode(m.group(1)))), out, f'ch{n}')
