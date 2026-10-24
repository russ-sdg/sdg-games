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
  const land = el('linearGradient', { id: 'land', x1: 0, y1: 0, x2: 1, y2: 1 });
  land.append(el('stop', { offset: '0', 'stop-color': '#b99a64' }), el('stop', { offset: '1', 'stop-color': '#8d6f42' }));
  const sea = el('linearGradient', { id: 'sea', x1: 0, y1: 0, x2: 1, y2: 0 });
  sea.append(el('stop', { offset: '0', 'stop-color': '#1b4f86' }), el('stop', { offset: '1', 'stop-color': '#2a6aa8' }));
  defs.append(land, sea);
  svg.append(defs);
  svg.append(el('rect', { x: 0, y: 40, width: 450, height: 650, fill: 'url(#land)' }));
  svg.append(el('path', { d: 'M0 40 L170 40 L176 92 L168 108 L146 160 L128 212 L100 290 L74 372 L58 430 L36 500 L24 560 L0 600 Z', fill: 'url(#sea)' }));
  svg.append(el('ellipse', { cx: 288, cy: 250, rx: 15, ry: 26, fill: '#2a6aa8' }));
  svg.append(el('path', { d: 'M288 276 C296 320 300 350 296 384 C292 440 292 500 284 556', fill: 'none', stroke: '#2a6aa8', 'stroke-width': 3, opacity: 0.75 }));
  svg.append(el('ellipse', { cx: 255, cy: 634, rx: 17, ry: 42, fill: '#2a6aa8' }));
  const text = (x, y, s, fill, size, extra = {}) => svg.append(el('text', { x, y, fill, 'font-size': size, 'font-weight': 800, 'text-anchor': 'middle', opacity: 0.55, 'letter-spacing': 1.5, ...extra }, s));
  if (!compact) {
    text(318, 56, 'SYRIA', REGIONS.syria.color, 20);
    text(196, 168, 'GALILEE', REGIONS.galilee.color, 18);
    text(142, 424, 'SAMARIA', REGIONS.samaria.color, 17);
    text(96, 536, 'JUDEA', REGIONS.judea.color, 17);
    text(350, 438, 'DECAPOLIS', REGIONS.decapolis.color, 13, { transform: 'rotate(76 350 438)' });
    text(340, 608, 'PEREA', REGIONS.perea.color, 15);
    svg.append(el('text', { x: 62, y: 250, fill: '#cfe4ff', 'font-size': 10, 'font-style': 'italic', opacity: 0.9, transform: 'rotate(-72 62 250)', 'text-anchor': 'middle' }, 'Mediterranean Sea'));
  }

  // roads and boat rides
  const roads = el('g', { 'stroke-linecap': 'round' });
  for (const [a, b, how] of EDGES) {
    const A = PLACES[a], B = PLACES[b];
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
    hot.append(el('polyline', { points: pts(build), stroke: '#ffd23f', 'stroke-width': 9, opacity: 0.95 }));
    hot.append(el('polyline', { points: pts(build), stroke: '#111', 'stroke-width': 2.5, 'stroke-dasharray': '1 6' }));
    svg.append(hot);
  }

  // places (each has a roomy invisible target so a thumb can hit it)
  const endSet = new Set(ends), heldSet = new Set(held), buildSet = new Set(build);
  const fs = compact ? 8.5 : 10.5;
  for (const [id, p] of Object.entries(PLACES)) {
    const g = el('g', { 'data-place': id, class: 'jp-place' });
    const color = REGIONS[p.region].color;
    if (endSet.has(id)) g.append(el('circle', { cx: p.x, cy: p.y, r: 15, fill: 'rgba(255,255,255,.25)', stroke: '#fff', 'stroke-width': 3, 'stroke-dasharray': '5 3' }));
    if (buildSet.has(id)) g.append(el('circle', { cx: p.x, cy: p.y, r: 11, fill: '#ffd23f' }));
    if (heldSet.has(id) && !buildSet.has(id)) g.append(el('circle', { cx: p.x, cy: p.y, r: 10.5, fill: 'none', stroke: '#ffd23f', 'stroke-width': 2.5 }));
    g.append(el('circle', { cx: p.x, cy: p.y, r: 6.5, fill: color, stroke: '#fff', 'stroke-width': 1.5 }));
    const [dx, dy, anchor] = LABEL[p.label || 'e'];
    const bold = endSet.has(id) || buildSet.has(id);
    g.append(el('text', { x: p.x + dx, y: p.y + dy, 'text-anchor': anchor, 'font-size': bold ? fs + 1.5 : fs, 'font-weight': bold ? 800 : 700, fill: '#fff', stroke: '#000', 'stroke-width': 3, 'paint-order': 'stroke', 'stroke-linejoin': 'round' }, p.name));
    g.append(el('circle', { cx: p.x, cy: p.y, r: 17, fill: 'transparent', class: 'jp-hit' }));
    svg.append(g);
  }
  for (const id of bursts) {
    const p = PLACES[id];
    for (let i = 0; i < 2; i++) svg.append(el('circle', { cx: p.x, cy: p.y, r: 8, fill: 'none', stroke: '#ffd23f', 'stroke-width': 4, class: 'jp-burst', style: `animation-delay:${i * 0.35}s` }));
  }
}
