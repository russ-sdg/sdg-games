#!/usr/bin/env python3
"""Make the web images for the Fruit of the Spirit page from the original PNGs in assets/.

  python3 FotS/tools/build-images.py            (run from the repo root)

Writes WebP files to assets/fots/ and a 1200x630 share picture (fots-share.jpg). Re-running is safe: files that are
already newer than their source are skipped. The page (FotS/index.html) reads width and height from these, so run
this again, and update the page, if a source picture changes.
"""
import os
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
SRC, OUT = os.path.join(ROOT, 'assets'), os.path.join(ROOT, 'assets', 'fots')
BANNERS = {'love': 'Love', 'joy': 'Joy', 'peace': 'Peace', 'patience': 'Patience', 'kindness': 'Kindness', 'goodness': 'Goodness',
           'faithfulness': 'Faithfulness', 'gentleness': 'Gentleness', 'self-control': 'Self Control', 'wild': 'Wild',
           'envy': 'Envy', 'jealousy': 'Jealousy', 'revelry': 'Revelry', 'rivalry': 'Rivalry', 'uncleanness': 'Unccleanness'}
# name -> (source file, width to make it)
PICS = {'fruit-cards': ('Fruit Cards 3x3.png', 900), 'deed-cards': ('Deed Cards 3x2.png', 900), 'wild-card': ('FS Wild Card.png', 480),
        'instructions-singles': ('FS Singles Instructions.png', 1000), 'instructions-team': ('FS Team Instructions.png', 1000),
        'fruit-tree': ('Fruit Tree v1.png', 800), 'tree': ('FotS450-300.png', 450)}
for k, v in BANNERS.items():
    PICS[f'banner-{k}'] = (f'FS {v} Banner.png', 800)

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
        im.save(out, 'WEBP', quality=82, method=6)
        print('wrote', name, im.size)
    # the share picture: the logo on cream over the page's green, with the tree
    out = os.path.join(OUT, 'fots-share.jpg')
    bg = Image.new('RGB', (1200, 630)); d = ImageDraw.Draw(bg)
    for y in range(630):
        t = y / 629; d.line([(0, y), (1200, y)], fill=(round(20 + 60 * t), round(40 + 70 * t), round(28 + 8 * t)))
    logo = Image.open(os.path.join(SRC, 'FotS Line Logo v1.png')).convert('RGBA'); logo.thumbnail((1000, 200))
    card = Image.new('RGBA', (1080, logo.height + 50), (250, 246, 230, 255)); card.alpha_composite(logo, ((1080 - logo.width) // 2, 25))
    mask = Image.new('L', card.size, 0); ImageDraw.Draw(mask).rounded_rectangle([0, 0, card.width - 1, card.height - 1], 28, fill=255)
    bg.paste(card.convert('RGB'), (60, 50), mask)
    y0 = 50 + card.height + 30
    tree = Image.open(os.path.join(SRC, 'FotS450-300.png')).convert('RGBA'); h = 630 - y0 - 30
    tree = tree.resize((round(tree.width * h / tree.height), h), Image.LANCZOS)
    panel = Image.new('RGB', tree.size, (250, 246, 230)); panel.paste(tree.convert('RGB'))
    m2 = Image.new('L', panel.size, 0); ImageDraw.Draw(m2).rounded_rectangle([0, 0, panel.width - 1, panel.height - 1], 24, fill=255)
    bg.paste(panel, (60, y0), m2)
    font = lambda size, bold=True: ImageFont.truetype(FONT_BOLD if bold else FONT, size)
    x = 60 + panel.width + 50
    d.text((x, y0 + 20), 'Collect all nine.', font=font(46), fill=(243, 214, 120))
    d.text((x, y0 + 90), 'Take that. Give that.', font=font(46), fill=(255, 255, 255))
    d.text((x, y0 + 175), 'A card game from Galatians 5:22\u201323', font=font(30, False), fill=(230, 236, 214))
    d.text((x, y0 + 220), 'sdggames.fun/FotS', font=font(30, False), fill=(243, 214, 120))
    bg.save(out, quality=88); print('wrote share picture')

if __name__ == '__main__': main()
