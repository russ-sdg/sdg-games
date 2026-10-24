// Tyndale at a shared table: draws the board (the picture, with the game's grid over it) for the host and Agent pages.
// Nothing here knows the rules; the pages say what to show and which spots can be tapped.
import * as E from './engine.js';
import { PX, LONDON } from './board-data.js';

const NS = 'http://www.w3.org/2000/svg';
const x = (id) => PX[E.colOf(id)], y = (id) => PX[E.rowOf(id)];
export const ALL_SPOTS = Array.from({ length: 121 }, (_, i) => E.idAt(Math.floor(i / 11), i % 11));
const mk = (tag, attrs = {}, text) => { const n = document.createElementNS(NS, tag); for (const k in attrs) n.setAttribute(k, attrs[k]); if (text !== undefined) n.textContent = text; return n; };
const halo = { stroke: '#fff', 'stroke-width': 3, 'paint-order': 'stroke' };

// o = {
//   marks   [{ pos, bible: 'N'|'P'|'H'|'O'|'rumors'|'nothing', color, tag, title }]   what has been found (ringed in the finder's colour)
//   pawns   [{ pos, color, label, big, title }]
//   trails  [{ path, color, dash }]
//   tyndale { pos, path: [..planned steps] } | null      only on the phone that may know where he is
//   ships   [{ pub, from, dist, left, fresh }]            shipments still sailing (Tyndale's phone)
//   hints   [{ pos, color }]                              things left behind by Tyndale (his phone)
//   taps    [{ pos, act, label, pulse }]                  spots that can be tapped (data-act / data-pos on the circle)
//   ring    [{ pos, color }]                              a spot picked but not yet confirmed
// }
export function drawBoard(svg, o = {}) {
  svg.replaceChildren();
  svg.setAttribute('viewBox', '0 0 800 800');
  svg.appendChild(mk('image', { href: '../../assets/tyndale/board.webp', x: 0, y: 0, width: 800, height: 800 }));
  for (const c of E.coastal) {                               // how many moves a shipment from each Coastal City needs
    const d = E.pt[c].coast;
    svg.appendChild(mk('text', { x: x(c) + 17, y: y(c) - 17, 'font-size': 15, 'font-weight': 800, fill: '#0a7a2f', ...halo, 'pointer-events': 'none' }, d >= 11 ? '>10' : d));
  }
  for (const t of o.trails || []) {
    if (t.path.length < 2) continue;
    svg.appendChild(mk('polyline', { points: t.path.map((q) => `${x(q)},${y(q)}`).join(' '), fill: 'none', stroke: t.color, 'stroke-width': 4, 'stroke-linejoin': 'round', 'stroke-linecap': 'round', 'stroke-dasharray': t.dash || '', opacity: 0.85, 'pointer-events': 'none' }));
  }
  for (const h of o.hints || []) {
    const g = mk('g', { 'pointer-events': 'none', opacity: 0.85 });
    g.appendChild(mk('circle', { cx: x(h.pos), cy: y(h.pos), r: 12, fill: 'rgba(240,195,106,.55)', stroke: '#8a5a00', 'stroke-width': 2, 'stroke-dasharray': '3 2' }));
    g.appendChild(mk('text', { x: x(h.pos), y: y(h.pos) + 1, 'font-size': 14, 'font-weight': 800, fill: '#5a3b00' }, h.pub));
    svg.appendChild(g);
  }
  for (const f of o.marks || []) {
    const col = f.color || '#6c757d', g = mk('g', { 'pointer-events': 'none' });
    if (f.title) g.appendChild(mk('title', {}, f.title));
    const ring = (r, cls) => g.appendChild(mk('circle', { cx: x(f.pos), cy: y(f.pos), r, class: cls, style: `stroke:${col};stroke-width:3.5` }));
    if (E.PUBS.includes(f.bible)) { ring(17, 'mk-pub'); g.appendChild(mk('text', { x: x(f.pos), y: y(f.pos) + 1, 'font-size': 20, 'font-weight': 800, fill: '#1b1b2e' }, f.bible)); }
    else if (f.bible === 'rumors') { ring(15, 'mk-rumor'); g.appendChild(mk('text', { x: x(f.pos), y: y(f.pos) + 1, 'font-size': 17, 'font-weight': 800, fill: '#a3262e' }, 'R')); }
    else { ring(11, 'mk-none'); g.appendChild(mk('text', { x: x(f.pos), y: y(f.pos) + 1, 'font-size': 16, 'font-weight': 700, fill: col }, '×')); }
    if (f.tag) g.appendChild(mk('text', { x: x(f.pos) + 15, y: y(f.pos) - 15, 'font-size': 11, 'font-weight': 700, fill: '#1b1b2e', ...halo }, f.tag));
    svg.appendChild(g);
  }
  const lx = x(LONDON), ly = y(LONDON);
  for (const q of o.ships || []) {
    if (q.arrived) continue;
    const f = q.dist > 0 ? (q.dist - q.left) / q.dist : 1, gx = x(q.from) + (lx - x(q.from)) * f, gy = y(q.from) + (ly - y(q.from)) * f;
    const g = mk('g', { 'pointer-events': 'none', opacity: 0.6 });
    g.appendChild(mk('line', { x1: x(q.from), y1: y(q.from), x2: lx, y2: ly, stroke: '#2a6f97', 'stroke-width': 3, 'stroke-dasharray': '2 8', 'stroke-linecap': 'round' }));
    g.appendChild(mk('circle', { cx: gx, cy: gy, r: 15, fill: 'rgba(200,225,245,.75)', stroke: '#2a6f97', 'stroke-width': 3, 'stroke-dasharray': '4 3' }));
    g.appendChild(mk('text', { x: gx, y: gy + 1, 'font-size': 17, 'font-weight': 800, fill: '#1d4e6e' }, q.pub));
    g.appendChild(mk('text', { x: gx + 17, y: gy + 20, 'font-size': 12, 'font-weight': 800, fill: '#1d4e6e', ...halo }, String(q.left)));
    svg.appendChild(g);
  }
  for (const p of o.pawns || []) {
    if (!p.pos) continue;
    const g = mk('g', { 'pointer-events': 'none' });
    g.appendChild(mk('circle', { cx: x(p.pos), cy: y(p.pos), r: p.big ? 18 : 14, fill: p.color, stroke: '#fff', 'stroke-width': 3.5 }));
    g.appendChild(mk('text', { x: x(p.pos), y: y(p.pos) + 1, 'font-size': 15, 'font-weight': 800, fill: '#fff' }, p.label));
    if (p.title) g.appendChild(mk('title', {}, p.title));
    svg.appendChild(g);
  }
  for (const r of o.ring || []) svg.appendChild(mk('circle', { cx: x(r.pos), cy: y(r.pos), r: 27, fill: 'none', stroke: r.color || '#a3262e', 'stroke-width': 5, 'pointer-events': 'none' }));
  if (o.tyndale) {
    const t = o.tyndale;
    if (t.path && t.path.length) {
      const pts = [t.pos, ...t.path];
      svg.appendChild(mk('polyline', { points: pts.map((p) => `${x(p)},${y(p)}`).join(' '), fill: 'none', stroke: '#f0c36a', 'stroke-width': 7, 'stroke-linejoin': 'round', 'stroke-linecap': 'round', 'pointer-events': 'none' }));
      t.path.forEach((p, i) => { svg.appendChild(mk('circle', { cx: x(p), cy: y(p), r: 11, fill: '#232a5c', stroke: '#f0c36a', 'stroke-width': 3, 'pointer-events': 'none' })); svg.appendChild(mk('text', { x: x(p), y: y(p) + 1, 'font-size': 13, 'font-weight': 800, fill: '#fff' }, String(i + 1))); });
    }
    const g = mk('g', { 'pointer-events': 'none' });
    g.appendChild(mk('circle', { cx: x(t.pos), cy: y(t.pos), r: 19, fill: '#a3262e', stroke: '#f0c36a', 'stroke-width': 4 }));
    g.appendChild(mk('text', { x: x(t.pos), y: y(t.pos) + 1, 'font-size': 18, 'font-weight': 800, fill: '#fff' }, 'T'));
    svg.appendChild(g);
  }
  for (const t of o.taps || []) {
    svg.appendChild(mk('circle', { cx: x(t.pos), cy: y(t.pos), r: 24, class: t.pulse ? 'tgt pulse' : 'hit', 'data-act': t.act, 'data-pos': t.pos, role: 'button', tabindex: 0, 'aria-label': t.label || t.pos }));
  }
}
export const spotName = (id) => { const p = E.pt[id]; return p.centre ? `${id} (${p.centre})` : id; };
