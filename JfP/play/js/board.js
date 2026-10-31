// Board drawing shared by the live game, the replay and the share image.
import MAP from './map-data.js';
import { EVANGELISTS, EV_NAMES, city, edge } from './engine.js';

export const EV_COLOR = { luke: '#1f9d45', silas: '#ef7a1a', titus: '#2f66e0' };
export const EV_LETTER = { luke: 'L', silas: 'S', titus: 'T' };
export const REGION_COLOR = { mac: '#38b44a', asia: '#9b2fd6', gal: '#f2671e', isl: '#2446e8' };
export const TRAIL_WIDTH = [20, 12, 5]; // concentric so routes used by several evangelists stay readable

export const esc = (t) => String(t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Tokens are parked on the side of a city's dot away from its label; `i` spreads the three evangelists.
export function tokenSpot(c, i) {
  const l = c.label;
  const w = c.name.length * 16;                     // rough label width at 31px Arial
  const rad = (l.rot * Math.PI) / 180;
  const lx = l.x + Math.cos(rad) * (w / 2) - Math.sin(rad) * -10;
  const ly = l.y + Math.sin(rad) * (w / 2) + Math.cos(rad) * -10;
  let dx = c.x - lx, dy = c.y - ly;
  const len = Math.hypot(dx, dy) || 1;
  dx /= len; dy /= len;
  const d = (c.big ? 44 : 38) + 4;
  return [c.x + dx * d - dy * (i - 1) * 36, c.y + dy * d + dx * (i - 1) * 36];
}

// Markup for the <svg> of one player's sheet.
//   opts.acting / opts.mode : dim the routes that are not the rolled mode
//   opts.sel / opts.moves   : selected evangelist and the moves to offer
//   opts.acted              : evangelists that have already acted this turn
//   opts.flash              : {edge?, city?, ev} - emphasise the action just replayed
export function boardSVG(sheet, opts = {}) {
  const { acting = false, mode = null, sel = null, moves = [], acted = [], flash = null } = opts;
  const parts = [];

  parts.push(`<image href="assets/basemap.webp" x="0" y="0" width="${MAP.width}" height="${MAP.height}"/>`);
  for (const c of MAP.captions) {
    parts.push(`<text class="caption" x="${c.x}" y="${c.y}" fill="${c.color}">${esc(c.text)}</text>`);
  }
  // every route, faintly; the rolled mode stands out
  for (const e of MAP.edges) {
    const dim = acting && e.mode !== mode ? ' dim' : '';
    if (e.mode === 'boat') {
      parts.push(`<path class="route boat-under${dim}" d="${e.d}"/><path class="route boat-over${dim}" d="${e.d}"/>`);
    } else {
      parts.push(`<path class="route ${e.mode}${dim}" d="${e.d}"/>`);
    }
  }
  if (flash?.edge) parts.push(`<path class="flash" d="${edge(flash.edge).d}"/>`);
  // trails: where each evangelist has been
  const byEdge = {};
  EVANGELISTS.forEach((ev, i) => sheet.used[ev].forEach((id) => (byEdge[id] ??= []).push(i)));
  for (const [id, evs] of Object.entries(byEdge)) {
    const d = edge(id).d;
    [...evs].sort((a, b) => a - b).forEach((i, n) => {
      parts.push(`<path class="trail" d="${d}" stroke="${EV_COLOR[EVANGELISTS[i]]}" stroke-width="${TRAIL_WIDTH[n]}" stroke-opacity=".9"/>`);
    });
  }
  // candidate routes for the selected evangelist
  for (const m of moves) {
    parts.push(`<path class="cand" d="${edge(m.edge).d}" stroke="${EV_COLOR[sel]}"/>`);
  }
  // cities
  for (const c of MAP.cities) {
    const seen = sheet.visited.includes(c.id);
    parts.push(`<circle class="dot${seen ? '' : ' unseen'}" cx="${c.x}" cy="${c.y}" r="${c.big ? 17 : 10}" fill="${REGION_COLOR[c.region]}"/>`);
  }
  // preaching rings (called = doubled)
  EVANGELISTS.forEach((ev, i) => {
    const e = sheet.evangelists[ev];
    for (const [cid, n] of Object.entries(e.preachedAt)) {
      const c = city(cid);
      const r = (c.big ? 17 : 10) + 8 + i * 6;
      parts.push(`<circle class="ring" cx="${c.x}" cy="${c.y}" r="${r}" stroke="${EV_COLOR[ev]}" ${n > 1 ? 'stroke-width="8"' : ''}/>`);
      if (e.called && e.city === cid) parts.push(`<circle class="ring" cx="${c.x}" cy="${c.y}" r="${r + 7}" stroke="${EV_COLOR[ev]}"/>`);
    }
  });
  if (flash?.city) {
    const c = city(flash.city);
    parts.push(`<circle class="flash-dot" cx="${c.x}" cy="${c.y}" r="${c.big ? 36 : 30}"/>`);
  }
  for (const c of MAP.cities) {
    const l = c.label;
    parts.push(`<text class="city-label" x="${l.x}" y="${l.y}" transform="rotate(${l.rot} ${l.x} ${l.y})">${esc(c.name)}</text>`);
  }
  // evangelist tokens
  EVANGELISTS.forEach((ev, i) => {
    const e = sheet.evangelists[ev];
    const c = city(e.city);
    const [x, y] = tokenSpot(c, i);
    const done = (acting && acted.includes(ev)) || e.called;
    parts.push(`<g class="token${sel === ev ? ' sel' : ''}${done ? ' done' : ''}" data-ev="${ev}" transform="translate(${x} ${y})" tabindex="0" role="button" aria-label="${EV_NAMES[ev]} in ${esc(c.name)}">
      <circle r="19" fill="${EV_COLOR[ev]}"/><text>${EV_LETTER[ev]}</text></g>`);
  });
  // clickable destinations
  for (const m of moves) {
    const c = city(m.to);
    parts.push(`<path class="hitpath" d="${edge(m.edge).d}" data-move="${m.edge}"/>`);
    parts.push(`<g class="dest" data-move="${m.edge}" tabindex="0" role="button" aria-label="Move ${EV_NAMES[sel]} to ${esc(c.name)}">
      <circle class="hit" cx="${c.x}" cy="${c.y}" r="38"/><circle class="pulse" cx="${c.x}" cy="${c.y}" r="${c.big ? 30 : 24}" stroke="${EV_COLOR[sel]}"/></g>`);
  }
  return `<svg viewBox="0 0 ${MAP.width} ${MAP.height}" role="img" aria-label="Map of Greece and Asia Minor with the cities Paul visited">${parts.join('')}</svg>`;
}

export function legendHTML() {
  return `
    ${Object.entries(MAP.regions).map(([k, n]) => `<span class="key"><span class="chip" style="background:${REGION_COLOR[k]}"></span>${esc(n)}</span>`).join('')}
    <span class="key"><span class="chip hollow" style="background:#ccc"></span>not yet visited (&minus;2 at the end)</span>
    <span class="key">ring = preached &middot; double ring = called as pastor</span>`;
}
