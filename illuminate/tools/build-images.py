#!/usr/bin/env python3
"""Make the web images for the Illuminate page from the pictures in assets/.

  python3 illuminate/tools/build-images.py            (run from the repo root)

Writes WebP files to assets/illuminate/ and a 1200x630 share picture (illuminate-share.jpg). Re-running is safe: files that
are already newer than their source are skipped.
"""
import os
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
SRC, OUT = os.path.join(ROOT, 'assets'), os.path.join(ROOT, 'assets', 'illuminate-web')
PICS = {'box': ('IlluminateBox3D.png', 876), 'banner': ('MMLJrowV1.png', 400), 'card-summary': ('CardSummary.png', 417),
        'kells': ('Kells-Gospel-Plates.png', 1200)}
CARDS = os.path.join(SRC, 'Illuminate')            # the card pictures (assets/Illuminate/*.png)
# pictures made by laying cards from assets/Illuminate side by side: name -> card files
ROWS = {'four-suits': ['Matthew 22-37-39-V4', 'Mark-7-14-V3', 'Luke-11-28-V3', 'John-9-6-7-V3'],
        'role-cards': ['Doctor-Card-V2', 'Neighbor-Card-V2', 'Preacher-Card-V2', 'Teacher-Card-V2'],
        'special-cards': ['Matthew 19-30-V4', 'John-1-5-V3', 'Mark-14-27-V3', 'Luke-19-24-V3'],
        'mark-cards': ['Mark-1-11-V3', 'Mark-1-31-V3', 'Mark-4-2-V3']}
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
    for name, files in ROWS.items():
        out = os.path.join(OUT, name + '.webp'); paths = [os.path.join(CARDS, f + '.png') for f in files]
        if all(newer(out, p) for p in paths): continue
        w, gap = 400, 20; ims = [Image.open(p).convert('RGBA') for p in paths]; h = round(w * ims[0].height / ims[0].width)
        row = Image.new('RGBA', (len(ims) * w + (len(ims) - 1) * gap, h), (0, 0, 0, 0))
        for i, im in enumerate(ims): row.alpha_composite(im.resize((w, h), Image.LANCZOS), (i * (w + gap), 0))
        row.save(out, 'WEBP', quality=84, method=6); print('wrote', name, row.size)
    out = os.path.join(OUT, 'illuminate-share.jpg')
    if os.path.exists(out): return
    bg = Image.new('RGB', (1200, 630)); d = ImageDraw.Draw(bg)
    for y in range(630):
        t = y / 629; d.line([(0, y), (1200, y)], fill=(round(54 + 40 * t), round(30 + 22 * t), round(14 + 6 * t)))
    f = lambda size, bold=True: ImageFont.truetype(FONT_BOLD if bold else FONT, size)
    d.text((70, 150), 'Illuminate', font=f(92), fill=(240, 196, 94))
    d.text((74, 285), 'A trick-taking card game', font=f(40, False), fill=(255, 255, 255))
    d.text((74, 340), 'with a Biblical twist', font=f(40, False), fill=(255, 255, 255))
    d.text((74, 440), 'Four Gospels. Four roles. One Grace.', font=f(26, False), fill=(240, 196, 94))
    d.text((74, 500), 'sdggames.fun/illuminate', font=f(26, False), fill=(226, 214, 190))
    box = Image.open(os.path.join(SRC, 'IlluminateBox3D.png')).convert('RGBA'); w = 520
    box = box.resize((w, round(w * box.height / box.width)), Image.LANCZOS)
    bg.paste(box, (650, (630 - box.height) // 2), box)
    bg.save(out, quality=88); print('wrote share picture')

if __name__ == '__main__': main()
