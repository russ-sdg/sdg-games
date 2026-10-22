#!/usr/bin/env python3
"""Build the Journeys with Jesus card gallery: web-sized card pictures and journeys-with-jesus/cards-data.js.

  python3 journeys-with-jesus/tools/build-cards.py --src DIR        (run from the repo root)

DIR holds the card images (825 x 1125 PNGs and the Scripture Memory Token PNGs). They were uploaded to the card-images
branch; to get them without merging that branch:  git archive origin/card-images assets/jwj | tar -x -C /some/empty/folder
and pass /some/empty/folder/assets/jwj. The originals are large, so they are not kept on main.

Every card comes out looking like a card: some of the originals are outlined with rounded, transparent corners and some are
plain rectangles, so the plain ones get the same rounded corners and black outline. Writes assets/jwj/cards/<id>-{480,755}.webp.
"""
import argparse, json, os, re
from PIL import Image, ImageDraw

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
OUT = os.path.join(ROOT, 'assets', 'jwj', 'cards')
DATA = os.path.join(ROOT, 'journeys-with-jesus', 'cards-data.js')
WIDTHS = (480, 755)
CARD = (755, 1055)            # size of the outlined cards once their transparent margin is cropped off
RADIUS, STROKE = 36, 5        # corner radius and outline of the outlined cards, in those pixels

PLACES = {                     # file-name token -> name on the card
    'BethanyBeyondJordan': 'Bethany Beyond Jordan', 'BethanyBJ': 'Bethany Beyond Jordan', 'CaesareaPhilippi': 'Caesarea Philippi',
    'MountHermon': 'Mount Hermon', 'MtHermon': 'Mount Hermon', 'Bethany': 'Bethany', 'Bethlehem': 'Bethlehem', 'Bethsaida': 'Bethsaida',
    'Caesarea': 'Caesarea', 'Cana': 'Cana', 'Capernaum': 'Capernaum', 'Countryside': 'Countryside', 'Emmaus': 'Emmaus', 'Ephraim': 'Ephraim',
    'Gadara': 'Gadara', 'Gennesaret': 'Gennesaret', 'Jericho': 'Jericho', 'Jerusalem': 'Jerusalem', 'Joppa': 'Joppa', 'Magdala': 'Magdala',
    'Nain': 'Nain', 'Nazareth': 'Nazareth', 'Pella': 'Pella', 'Ptolemais': 'Ptolemais', 'Samaria': 'Samaria', 'Sychar': 'Sychar', 'Tyre': 'Tyre',
}
REGIONS = {'GALILEE': 'Galilee', 'ISRAEL': 'Israel National', 'JUDAEA': 'Judea', 'DECAPOLIS': 'Decapolis', 'PEREA': 'Perea', 'SAMARIA': 'Samaria', 'SYRIA': 'Syria'}
# The journeys that appear only in the Gospel of John (their cards quote only John): the Gospel of John Expansion Pack
EXPANSION_JOURNEYS = {'BethanyBJBethany', 'BethanyBJJerusalem', 'CanaBethanyBJ', 'CanaSychar', 'CapernaumCana', 'CapernaumJerusalem',
                      'CountrysideJerusalem', 'EphraimBethany', 'GennesaretJerusalem', 'SycharCountryside'}
# Place Cards that come only in the expansion pack (one file per card), and the pictures printed several times (file -> copies)
EXPANSION_PLACES = {'BethanyBeyondJordan2', 'BethanyBeyondJordan3', 'BethanyBeyondJordan4', 'Caesarea', 'Countryside1', 'Countryside2', 'Emmaus',
                    'Jericho3', 'Joppa', 'Nain3', 'Sychar2', 'Sychar3', 'Samaria'}
SPLIT_COPIES = {'Ephraim': (2, 1), 'Pella': (1, 1), 'Galilee': (4, 6), 'Judea': (2, 5)}   # name -> (copies in the game, extra copies in the expansion)
TOKENS = {'scripture-token-front01v2': 'Pr 30:5a', 'scripture-token-front03v2': 'Col 3:16a', 'scripture-token-front05v2': 'Ps 119:11'}
GROUPS = [('journeys', 'Journey Cards', 'The journeys Jesus took'), ('places', 'Place Cards', 'One for each place'),
          ('wild', 'Wild Cards', 'Stand in for any place in a region'), ('tokens', 'Scripture Memory Tokens', 'Earned by reciting Scripture'),
          ('backs', 'Card backs', 'The backs of the cards'), ('expansion', 'Gospel of John Expansion Pack', 'The Journey and Place Cards that appear only in John')]
SYNOPTIC_NOTE = ''

def split_places(token):
    """'CapernaumNazareth' -> ['Capernaum', 'Nazareth'] (longest known place first)."""
    for key in sorted(PLACES, key=len, reverse=True):
        if token.startswith(key):
            rest = token[len(key):]
            if not rest: return [PLACES[key]]
            tail = split_places(rest)
            if tail: return [PLACES[key]] + tail
    return None

def slug(s): return re.sub(r'[^a-z0-9]+', '-', s.lower()).strip('-')

def outlined(im):
    a = im.getchannel('A'); return a.getpixel((2, 2)) < 20          # a transparent corner: the card already has its own outline

def card_image(path):
    im = Image.open(path).convert('RGBA')
    if outlined(im):
        im = im.crop(im.getchannel('A').point(lambda v: 255 if v > 128 else 0).getbbox())
        return im if im.size == CARD else im.resize(CARD, Image.LANCZOS)
    k = 4                                                              # a plain rectangle: round its corners and give it the same outline
    face = im.resize((CARD[0] * k, CARD[1] * k), Image.LANCZOS)
    mask = Image.new('L', face.size, 0); ImageDraw.Draw(mask).rounded_rectangle([0, 0, face.width - 1, face.height - 1], radius=RADIUS * k, fill=255)
    face.putalpha(mask)
    ImageDraw.Draw(face).rounded_rectangle([0, 0, face.width - 1, face.height - 1], radius=RADIUS * k, outline=(0, 0, 0, 255), width=STROKE * k)
    return face.resize(CARD, Image.LANCZOS)

def token_image(path):
    im = Image.open(path).convert('RGBA')
    return im.crop(im.getchannel('A').point(lambda v: 255 if v > 128 else 0).getbbox())

def parse(n):
    """A card file name -> ('region', name) | ('journey', [a, b]) | ('place', name); None for backs and tokens."""
    if n in TOKENS or n.startswith('scripture-token') or re.search(r'Back[vV]\d+$', n): return None
    base = re.sub(r'[Vv]\d+$', '', n)                                  # the version number of the picture
    m = re.match(r'^([A-Z]{4,})[xX]\d+$', base)
    if m: return ('region', REGIONS[m.group(1)])
    base = re.sub(r'[Xx]\d+$', '', base) if re.search(r'[a-z][Xx]\d+$', base) else re.sub(r'\d+$', '', base)   # copies (X3) or the card's number (1)
    parts = split_places(base)
    if not parts: raise SystemExit(f'cannot read the name of {n}')
    return ('journey', parts) if len(parts) == 2 else ('place', parts[0])

def copies(what, n):
    """' (x3)' for a picture printed several times; the split between the game and the expansion where it is both."""
    if what in SPLIT_COPIES:
        a, b = SPLIT_COPIES[what]; return f' ({a} in the game, {b} more in the expansion)'
    m = re.search(r'[xX](\d+)', re.sub(r'[Vv]\d+$', '', n))
    return f' (x{m.group(1)})' if m and int(m.group(1)) > 1 else ''

def entries(src):
    names = sorted(f[:-4] for f in os.listdir(src) if f.endswith('.png'))
    per_place = {}
    for n in names:
        k = parse(n)
        if k and k[0] == 'place':
            g = 'expansion' if re.sub(r'[Vv]\d+$', '', n) in EXPANSION_PLACES else 'places'
            per_place[(k[1], g)] = per_place.get((k[1], g), 0) + 1
    out, seen = [], {}
    for n in names:
        path = os.path.join(src, n + '.png')
        if n in TOKENS:
            out.append(dict(id='token-' + slug(TOKENS[n]), group='tokens', name='Scripture Memory Token: ' + TOKENS[n], file=path, kind='token',
                            alt=f'A gold hexagonal Scripture Memory Token with the verse {TOKENS[n]}.')); continue
        if n.startswith('scripture-token-back'):
            out.append(dict(id='token-back', group='tokens', name='Scripture Memory Token (back)', file=path, kind='token', alt='The back of a gold hexagonal Scripture Memory Token.')); continue
        if n.startswith('JourneysBack'):
            out.append(dict(id='back-journey', group='backs', name='Journey Card back', file=path, kind='card', alt='The back of a Journey Card: olive green with the Journeys with Jesus logo.')); continue
        if n.startswith('PlacesBack'):
            out.append(dict(id='back-place', group='backs', name='Place Card back', file=path, kind='card', alt='The back of a Place Card: pale yellow with the Journeys with Jesus logo.')); continue
        kind, what = parse(n)
        base_name = re.sub(r'[Vv]\d+$', '', n)
        if kind == 'region':
            out.append(dict(id='wild-' + slug(what), group='wild', name=f'{what} Wild Card' + copies(what, n), file=path, kind='card', alt=f'The {what} Wild Card, which stands in for any place in that region.'))
        elif kind == 'journey':
            a, b = what
            grp = 'expansion' if re.sub(r'[Vv]\d+$', '', n) in EXPANSION_JOURNEYS else 'journeys'
            out.append(dict(id=slug(f'{a} to {b}'), group=grp, name=f'{a} to {b}', file=path, kind='card',
                            alt=f'The Journey Card from {a} to {b}, with a map of the land and the points in the four corners.'))
        else:
            seen[what] = seen.get(what, 0) + 1
            grp = 'expansion' if base_name in EXPANSION_PLACES else 'places'
            idx = seen[what]
            total = per_place[(what, grp)]
            if grp == 'expansion': idx = sum(1 for m in names if parse(m) == ('place', what) and re.sub(r'[Vv]\d+$', '', m) in EXPANSION_PLACES and m <= n)
            if total > 1: label = f'{what} ({idx} of {total})'
            else: label = what + copies(what, n)
            out.append(dict(id=slug(what) + (f'-{seen[what]}' if sum(v for (w, g), v in per_place.items() if w == what) > 1 else ''), group=grp, name=label,
                            file=path, kind='card', alt=f'A Place Card for {what}, with a verse from the World English Bible.'))
    return out

def main():
    ap = argparse.ArgumentParser(); ap.add_argument('--src', required=True); ap.add_argument('--force', action='store_true'); args = ap.parse_args()
    os.makedirs(OUT, exist_ok=True)
    cards, wanted = [], set()
    for e in entries(args.src):
        im = None
        for w in WIDTHS:
            fn = f"{e['id']}-{w}.webp"; wanted.add(fn)
            if os.path.exists(os.path.join(OUT, fn)) and not args.force: continue       # already built (--force to redo)
            if im is None: im = (token_image if e['kind'] == 'token' else card_image)(e['file'])
            t = im if w >= im.width else im.resize((w, round(w * im.height / im.width)), Image.LANCZOS)
            t.save(os.path.join(OUT, fn), 'WEBP', quality=86, method=6)
        probe = Image.open(os.path.join(OUT, f"{e['id']}-{WIDTHS[-1]}.webp"))
        cards.append({'id': e['id'], 'group': e['group'], 'name': e['name'], 'alt': e['alt'], 'src': f"../assets/jwj/cards/{e['id']}", 'widths': list(WIDTHS), 'w': probe.width, 'h': probe.height})
    for f in os.listdir(OUT):
        if f.endswith('.webp') and f not in wanted: os.remove(os.path.join(OUT, f))
    order = [g[0] for g in GROUPS]
    cards.sort(key=lambda c: (order.index(c['group']), c['name']))
    data = {'total': len(cards), 'expected': len(cards), 'noun': 'cards', 'groups': [{'id': g, 'label': l, 'title': t} for g, l, t in GROUPS], 'cards': cards}
    with open(DATA, 'w') as fh:
        fh.write('// Generated by journeys-with-jesus/tools/build-cards.py. Do not edit by hand.\n')
        fh.write('window.SDG_CARDS = ' + json.dumps(data, indent=1) + ';\n')
    counts = {}
    for c in cards: counts[c['group']] = counts.get(c['group'], 0) + 1
    print(len(cards), 'cards:', counts)

main()
