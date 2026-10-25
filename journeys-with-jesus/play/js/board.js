// Journeys with Jesus: draws the gameboard as an SVG (roads black, boat rides white), over a simple map of the land.
// Used by the live game (tap a city to lay a card for it) and the results picture. Nothing here changes the game.
import { PLACES, EDGES, REGIONS } from './board-data.js';

const NS = 'http://www.w3.org/2000/svg';
const el = (name, attrs = {}, text) => { const e = document.createElementNS(NS, name); for (const k in attrs) e.setAttribute(k, attrs[k]); if (text !== undefined) e.textContent = text; return e; };
export const VIEW = { x: 0, y: 40, w: 450, h: 650 };

const LABEL = { n: [0, -9, 'middle'], s: [0, 15, 'middle'], e: [9, 4, 'start'], w: [-9, 4, 'end'], ne: [7, -7, 'start'], nw: [-7, -7, 'end'], se: [7, 14, 'start'], sw: [-7, 14, 'end'] };
const pts = (path) => path.map((id) => `${PLACES[id].x},${PLACES[id].y}`).join(' ');
const length = (path) => path.slice(1).reduce((n, id, i) => n + Math.hypot(PLACES[id].x - PLACES[path[i]].x, PLACES[id].y - PLACES[path[i]].y), 0);

// Options:
//   ends    the two places of the journey you are trying to complete (ringed and named in bold)
//   build   the route you are laying right now, as place ids (gold)
//   routes  journeys already completed: [{ path, color, now, fresh }]  now = completed this turn (white edge), fresh = draw it in
//   held    places you hold a card for (gold ring)
//   bursts  places to flash (the ends of a journey just completed)
//   compact smaller labels (the little map beside your hand)
export function drawBoard(svg, { ends = [], build = [], routes = [], held = [], bursts = [], compact = false } = {}) {
  svg.replaceChildren();
  svg.setAttribute('viewBox', `${VIEW.x} ${VIEW.y} ${VIEW.w} ${VIEW.h}`);
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', 'Map of the land of the Gospels: places joined by roads and boat rides');
  const defs = el('defs');
  const land = el('linearGradient', { id: 'land', x1: 0, y1: 0, x2: 0.6, y2: 1 });
  land.append(el('stop', { offset: '0', 'stop-color': '#f1e7c9' }), el('stop', { offset: '1', 'stop-color': '#dcc99b' }));
  const sea = el('linearGradient', { id: 'sea', x1: 0, y1: 0, x2: 1, y2: 0 });
  sea.append(el('stop', { offset: '0', 'stop-color': '#79aed6' }), el('stop', { offset: '1', 'stop-color': '#a9d0ea' }));
  const paper = el('filter', { id: 'paper', x: 0, y: 0, width: 1, height: 1 });
  paper.append(el('feTurbulence', { type: 'fractalNoise', baseFrequency: '0.8', numOctaves: 2, seed: 4, result: 'n' }), el('feColorMatrix', { in: 'n', type: 'saturate', values: '0', result: 'g' }),
    el('feComponentTransfer', { in: 'g' }));
  paper.lastChild.append(el('feFuncA', { type: 'linear', slope: '0.16' }));
  defs.append(land, sea, paper);
  svg.append(defs);
  svg.append(el('rect', { x: 0, y: 40, width: 450, height: 650, fill: 'url(#land)' }));
  svg.append(el('rect', { x: 0, y: 40, width: 450, height: 650, fill: '#6b5420', filter: 'url(#paper)' }));
  const coast = 'M0 40 L170 40 L176 92 L168 108 L142 160 L118 212 L92 290 L50 372 L36 430 L12 500 L6 560 L0 600 Z';
  svg.append(el('path', { d: coast, fill: 'url(#sea)' }));
  svg.append(el('path', { d: coast.replace(/^M0 40 /, 'M170 40 ').replace(/ L0 600 Z$/, ''), fill: 'none', stroke: '#5f8fb0', 'stroke-width': 2, 'stroke-linejoin': 'round' }));
  svg.append(el('path', { d: 'M288 276 C296 320 300 350 296 384 C292 440 292 500 284 556', fill: 'none', stroke: '#6aa7d1', 'stroke-width': 3.5, opacity: 0.9 }));
  svg.append(el('ellipse', { cx: 288, cy: 250, rx: 15, ry: 26, fill: '#8fc0e0', stroke: '#5f8fb0', 'stroke-width': 1.5 }));
  svg.append(el('ellipse', { cx: 255, cy: 634, rx: 17, ry: 42, fill: '#8fc0e0', stroke: '#5f8fb0', 'stroke-width': 1.5 }));
  const text = (x, y, s, fill, size, extra = {}) => svg.append(el('text', { x, y, fill, 'font-size': size, 'font-weight': 800, 'text-anchor': 'middle', opacity: 0.8, 'letter-spacing': 1.5, stroke: '#fff', 'stroke-width': 3, 'paint-order': 'stroke', ...extra }, s));
  if (!compact) {
    text(318, 56, 'SYRIA', REGIONS.syria.color, 21);
    text(196, 168, 'GALILEE', REGIONS.galilee.color, 19);
    text(142, 424, 'SAMARIA', REGIONS.samaria.color, 18);
    text(96, 536, 'JUDEA', REGIONS.judea.color, 18);
    text(350, 438, 'DECAPOLIS', REGIONS.decapolis.color, 14, { transform: 'rotate(76 350 438)' });
    text(340, 608, 'PEREA', REGIONS.perea.color, 16);
    svg.append(el('text', { x: 62, y: 250, fill: '#2c5f8a', 'font-size': 11, 'font-style': 'italic', 'text-anchor': 'middle', transform: 'rotate(-72 62 250)' }, 'Mediterranean Sea'));
  }

  // roads and boat rides
  const roads = el('g', { 'stroke-linecap': 'round' });
  for (const [a, b, how] of EDGES) {
    const A = PLACES[a], B = PLACES[b];
    if (how === 'boat') roads.append(el('line', { x1: A.x, y1: A.y, x2: B.x, y2: B.y, stroke: '#1d3b57', 'stroke-width': 8 }));
    roads.append(el('line', { x1: A.x, y1: A.y, x2: B.x, y2: B.y, stroke: how === 'boat' ? '#fff' : '#111', 'stroke-width': how === 'boat' ? 5 : 4.5 }));
  }
  svg.append(roads);

  // journeys already completed: all of them lightly, this turn's with a white edge and the newest drawn in
  const done = el('g', { fill: 'none', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' });
  for (const r of routes) {
    if (r.path.length < 2) continue;
    if (r.now) done.append(el('polyline', { points: pts(r.path), stroke: '#fff', 'stroke-width': 11, opacity: 0.9 }));
    const line = el('polyline', { points: pts(r.path), stroke: r.color, 'stroke-width': r.now ? 7 : 5, opacity: r.now ? 1 : 0.55 });
    if (r.fresh) { const len = Math.ceil(length(r.path)) + 4; line.setAttribute('class', 'jp-draw'); line.setAttribute('style', `--len:${len}; stroke-dasharray:${len}`); }
    done.append(line);
  }
  svg.append(done);
  // the route being laid
  if (build.length > 1) {
    const hot = el('g', { 'stroke-linecap': 'round', 'stroke-linejoin': 'round', fill: 'none' });
    hot.append(el('polyline', { points: pts(build), stroke: '#ffb703', 'stroke-width': 10, opacity: 0.95 }));
    hot.append(el('polyline', { points: pts(build), stroke: '#111', 'stroke-width': 2.5, 'stroke-dasharray': '1 6' }));
    svg.append(hot);
  }

  // places (each has a roomy invisible target so a thumb can hit it)
  const endSet = new Set(ends), heldSet = new Set(held), buildSet = new Set(build);
  const fs = compact ? 9 : 12.5;
  for (const [id, p] of Object.entries(PLACES)) {
    const g = el('g', { 'data-place': id, class: 'jp-place' });
    const color = REGIONS[p.region].color;
    if (endSet.has(id)) g.append(el('circle', { cx: p.x, cy: p.y, r: 16, fill: 'rgba(255,255,255,.6)', stroke: '#111', 'stroke-width': 3, 'stroke-dasharray': '5 3' }));
    if (buildSet.has(id)) g.append(el('circle', { cx: p.x, cy: p.y, r: 12, fill: '#ffb703' }));
    if (heldSet.has(id) && !buildSet.has(id)) g.append(el('circle', { cx: p.x, cy: p.y, r: 11, fill: 'none', stroke: '#d98e04', 'stroke-width': 3 }));
    g.append(el('circle', { cx: p.x, cy: p.y, r: 7, fill: color, stroke: '#fff', 'stroke-width': 1.8 }));
    const [dx, dy, anchor] = LABEL[p.label || 'e'];
    const bold = endSet.has(id) || buildSet.has(id);
    g.append(el('text', { x: p.x + dx, y: p.y + dy, 'text-anchor': anchor, 'font-size': bold ? fs + 1.5 : fs, 'font-weight': bold ? 800 : 700, fill: '#1c1c1c', stroke: '#fff', 'stroke-width': 3.5, 'paint-order': 'stroke', 'stroke-linejoin': 'round' }, p.name));
    g.append(el('circle', { cx: p.x, cy: p.y, r: 18, fill: 'transparent', class: 'jp-hit' }));
    svg.append(g);
  }
  for (const id of bursts) {
    const p = PLACES[id];
    for (let i = 0; i < 2; i++) svg.append(el('circle', { cx: p.x, cy: p.y, r: 8, fill: 'none', stroke: '#e0a100', 'stroke-width': 4, class: 'jp-burst', style: `animation-delay:${i * 0.35}s` }));
  }
}
