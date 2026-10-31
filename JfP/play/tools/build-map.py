#!/usr/bin/env python3
"""Generate map-data.js (cities, labels, routes) and basemap-source.svg from the
Affinity SVG exports (map-only / road-only / footpath-only / boat-only).

usage: build-map.py <dir with the four SVGs> <out dir>
The basemap-source.svg it writes is the original artwork minus cities, routes and
labels; render it to assets/basemap.webp with render-basemap.mjs.
"""
import re, sys, json, math, glob, os

src_dir, out_dir = sys.argv[1], sys.argv[2]
def read(kind): return open(glob.glob(os.path.join(src_dir, f'*{kind}-only-2026.svg'))[0]).read()
svg = {k: read(k) for k in ('map', 'road', 'footpath', 'boat')}
m = svg['map']

REGION_BY_IMG = {
    '_Image6': 'mac', '_Image9': 'mac', '_Image38': 'mac',
    '_Image17': 'asia', '_Image27': 'asia',
    '_Image28': 'gal', '_Image29': 'gal', '_Image36': 'gal',
    '_Image31': 'isl', '_Image35': 'isl'}

# ---- cities (dot groups; the id is the city name) ---------------------------
cities = {}
for g in re.finditer(r'<g id="([^"]+)"(?: serif:id="([^"]*)")? transform="matrix\(1,0,0,1,([\d.\-]+),([\d.\-]+)\)">(.*?)</g>\s*(?=<g|<rect|<text|</svg|<defs)', m, re.S):
    cid, name, x, y, body = g.groups()
    mi = re.search(r'xlink:href="#(_Image\d+)"[^>]*width="(\d+)px" height="(\d+)px"', body)
    if not mi or mi.group(1) not in REGION_BY_IMG: continue
    w, h = int(mi.group(2)), int(mi.group(3))
    cities[cid] = dict(id=cid, name=name or cid, x=round(float(x) + w / 2, 1), y=round(float(y) + h / 2, 1),
                       big=w >= 34, region=REGION_BY_IMG[mi.group(1)])

# ---- labels and region captions (text inside top-level transformed groups) --
def top_level_text_groups():
    for g in re.finditer(r'\n    <g transform="matrix\(([^)]*)\)">\n(.*?)\n    </g>', m, re.S):
        yield tuple(map(float, g.group(1).split(','))), g.group(2)
labels, captions = {}, []
for (a, b, c, d, e, f), body in top_level_text_groups():
    for t in re.finditer(r'<text x="([\d.]+)px" y="([\d.]+)px" style="([^"]*)">(.*?)</text>', body, re.S):
        tx, ty, style, inner = t.groups()
        tx, ty = float(tx), float(ty)
        text = re.sub(r'<[^>]+>', '', inner).replace('&amp;', '&').strip()
        item = dict(x=round(a * tx + c * ty + e, 1), y=round(b * tx + d * ty + f, 1),
                    rot=round(math.degrees(math.atan2(b, a)), 1))
        if 'font-weight:700' in style:
            item.update(text=text, color=re.search(r'fill:(rgb\([^)]*\))', style).group(1))
            captions.append(item)
        else:
            labels[text] = item
NAME_FIX = {'Mt. Olympus': 'Mount-Olympus'}
city_labels = {NAME_FIX.get(t, t): p for t, p in labels.items()}
missing = [c for c in cities if c not in city_labels]
assert not missing, f'cities without label: {missing}'
for c in captions:
    if c['text'].startswith('&'): c['text'] = '& Achaia'   # source spells it with tspans

# ---- routes -----------------------------------------------------------------
def routes(layer, mode):
    out, seen = [], set()
    for g in re.finditer(r'<g transform="matrix\(([^)]*)\)">\s*<path d="([^"]+)" style="([^"]*)"', svg[layer]):
        a, b, c, d, e, f = map(float, g.group(1).split(','))
        toks = re.findall(r'[MLC]|-?\d+\.?\d*', g.group(2))
        pts, cmds, i = [], [], 0
        newd = []
        while i < len(toks):
            if toks[i] in 'MLC':
                newd.append(toks[i]); i += 1
            else:
                x, y = float(toks[i]), float(toks[i + 1]); i += 2
                X, Y = a * x + c * y + e, b * x + d * y + f
                pts.append((X, Y)); newd.append(f'{X:.1f},{Y:.1f}')
        key = tuple(round(v) for p in (pts[0], pts[-1]) for v in p)
        if key in seen: continue                         # white dash overlay duplicates the black stroke
        seen.add(key)
        def near(p):
            return min(cities.values(), key=lambda c: math.hypot(p[0] - c['x'], p[1] - c['y']))
        ca, cb = near(pts[0]), near(pts[-1])
        for p, c in ((pts[0], ca), (pts[-1], cb)):
            assert math.hypot(p[0] - c['x'], p[1] - c['y']) < 40, f'{mode}: endpoint far from {c["id"]}'
        assert ca['id'] != cb['id']
        d_str = ''.join(t if t in 'MLC' else t + ' ' for t in newd).replace(' M', 'M').replace(' L', 'L').replace(' C', 'C').strip()
        out.append(dict(mode=mode, a=ca['id'], b=cb['id'], d=d_str))
    return out
edges = routes('road', 'road') + routes('footpath', 'foot') + routes('boat', 'boat')
for i, e in enumerate(edges): e['id'] = f"{e['mode']}:{e['a']}~{e['b']}"
pairs = {}
for e in edges: pairs.setdefault(frozenset((e['a'], e['b'])), []).append(e['mode'])
dup = {tuple(sorted(k)): v for k, v in pairs.items() if len(v) > 1}
if dup: print('NOTE pairs connected by several modes:', dup)

data = dict(width=2400, height=1200,
            regions=dict(mac='Macedonia & Achaia', asia='Asia Minor', gal='Galatia', isl='Mediterranean Islands'),
            cities=[dict(c, label=city_labels[c['id']]) for c in cities.values()],
            captions=captions, edges=edges,
            starts=dict(luke='Philippi', silas='Antioch', titus='Crete'))
os.makedirs(out_dir, exist_ok=True)
with open(os.path.join(out_dir, 'map-data.js'), 'w') as fh:
    fh.write('// Generated by tools/build-map.py from the Affinity SVG exports. Do not edit by hand.\n')
    fh.write('export default ' + json.dumps(data, indent=1) + ';\n')

# ---- basemap source: original artwork minus cities/routes/labels ------------
head = m[:m.index('<g transform="matrix(1,0,0,1,-54,-89)">')]
defs = m[m.index('<defs>'):]
open(os.path.join(out_dir, 'basemap-source.svg'), 'w').write(head + defs)
print(f'{len(cities)} cities, {len(edges)} routes: ' + ', '.join(f"{k}={sum(e['mode']==k for e in edges)}" for k in ('road', 'foot', 'boat')))
