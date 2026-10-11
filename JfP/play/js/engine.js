// Journeys for Paul - rules engine. Pure functions over plain JSON-serialisable
// data (no DOM, no globals) so the same code can drive solo, pass-and-play and,
// later, networked play.

import MAP from './map-data.js';

export const MODES = ['road', 'foot', 'boat'];
export const MODE_NAMES = { road: 'Roman Road', foot: 'Footpath', boat: 'Boat' };
export const EVANGELISTS = ['luke', 'silas', 'titus'];
export const EV_NAMES = { luke: 'Luke', silas: 'Silas', titus: 'Titus' };

// The 8-sided die: three travel modes plus "Player's Choice".
export const DIE_FACES = ['road', 'road', 'foot', 'foot', 'boat', 'boat', 'choice', 'choice'];

export const RULESETS = {
  fast: {
    id: 'fast',
    name: 'Fast game',
    // Other players may have a stuck evangelist preach, not only move.
    nonRollerMayPreach: true,
    // An evangelist is called as pastor on a repeat preach in the same city,
    // even if he has only visited one region.
    calledNeedsTwoRegions: false,
  },
  long: {
    id: 'long',
    name: 'Long game',
    nonRollerMayPreach: false,
    calledNeedsTwoRegions: true,
  },
};

export const SCORING = { region: 4, preach: 3, called: 5, unvisited: -2 };

const CITY = Object.fromEntries(MAP.cities.map((c) => [c.id, c]));
const EDGE = Object.fromEntries(MAP.edges.map((e) => [e.id, e]));
const EDGES_AT = {};
for (const e of MAP.edges) {
  (EDGES_AT[e.a] ??= []).push(e);
  (EDGES_AT[e.b] ??= []).push(e);
}

export const city = (id) => CITY[id];
export const edge = (id) => EDGE[id];
export const otherEnd = (e, from) => (e.a === from ? e.b : e.a);

export function rollDie(rng = Math.random) {
  return DIE_FACES[Math.floor(rng() * DIE_FACES.length)];
}

// ---- sheets ----------------------------------------------------------------
// A sheet is one player's map/scoring sheet.
//   evangelists[id] = { city, regions[], preachedAt{city:count}, called, path[] }
//   used[id]        = edge ids that evangelist has already travelled
//   visited[]       = every city any of this player's evangelists has reached

export function newSheet() {
  const evangelists = {};
  const visited = [];
  for (const id of EVANGELISTS) {
    const start = MAP.starts[id];
    evangelists[id] = {
      city: start,
      regions: [CITY[start].region],
      preachedAt: {},
      called: false,
      path: [start],
    };
    if (!visited.includes(start)) visited.push(start);
  }
  return { evangelists, used: { luke: [], silas: [], titus: [] }, visited };
}

export const clone = (x) => structuredClone(x);

export function movesFor(sheet, evId, mode) {
  const ev = sheet.evangelists[evId];
  if (ev.called) return [];
  return (EDGES_AT[ev.city] ?? [])
    .filter((e) => e.mode === mode && !sheet.used[evId].includes(e.id))
    // a route between two cities may not be reused, in either direction
    .map((e) => ({ edge: e.id, to: otherEnd(e, ev.city) }));
}

export const canMove = (sheet, evId, mode) => movesFor(sheet, evId, mode).length > 0;
export const canTravelAtAll = (sheet, evId) => MODES.some((m) => canMove(sheet, evId, m));

export function applyMove(sheet, evId, edgeId) {
  const s = clone(sheet);
  const ev = s.evangelists[evId];
  const e = EDGE[edgeId];
  const to = otherEnd(e, ev.city);
  ev.city = to;
  ev.path.push(to);
  s.used[evId].push(edgeId);
  const region = CITY[to].region;
  if (!ev.regions.includes(region)) ev.regions.push(region);
  if (!s.visited.includes(to)) s.visited.push(to);
  return s;
}

// Would preaching now call this evangelist as a pastor?
export function wouldBeCalled(sheet, evId, rules) {
  const ev = sheet.evangelists[evId];
  const before = ev.preachedAt[ev.city] ?? 0;
  return before >= 1 && (!rules.calledNeedsTwoRegions || ev.regions.length >= 2);
}

export function applyPreach(sheet, evId, rules) {
  const s = clone(sheet);
  const ev = s.evangelists[evId];
  const called = wouldBeCalled(sheet, evId, rules);
  ev.preachedAt[ev.city] = (ev.preachedAt[ev.city] ?? 0) + 1;
  if (called) ev.called = true;
  return { sheet: s, called };
}

// What can this evangelist do with the rolled mode?
//   role 'roller': move, or preach if he cannot move.
//   role 'other' : move; preach (only if he cannot move) when the ruleset allows.
export function options(sheet, evId, mode, role, rules) {
  const ev = sheet.evangelists[evId];
  if (ev.called) return { moves: [], preach: false };
  const moves = movesFor(sheet, evId, mode);
  const preach = moves.length === 0 && (role === 'roller' || rules.nonRollerMayPreach);
  return { moves, preach };
}

export const maxActions = (role) => (role === 'roller' ? 3 : 1);

export function anyOption(sheet, mode, role, rules, acted = []) {
  return EVANGELISTS.some((id) => {
    if (acted.includes(id)) return false;
    const o = options(sheet, id, mode, role, rules);
    return o.moves.length > 0 || o.preach;
  });
}

// ---- end of game & scoring -------------------------------------------------

export const allCalled = (sheet) => EVANGELISTS.every((id) => sheet.evangelists[id].called);
export const canTravelAny = (sheet) => EVANGELISTS.some((id) => canTravelAtAll(sheet, id));

export function gameOver(sheets) {
  return sheets.some(allCalled) || !sheets.some(canTravelAny);
}

export function score(sheet) {
  const perEvangelist = {};
  let regionPts = 0;
  let preaches = 0;
  let called = 0;
  for (const id of EVANGELISTS) {
    const ev = sheet.evangelists[id];
    const regions = ev.regions.length;
    const total = Object.values(ev.preachedAt).reduce((a, b) => a + b, 0);
    // the preach that gets an evangelist called is not scored as a second preach
    const counted = total - (ev.called ? 1 : 0);
    perEvangelist[id] = { regions, preaches: counted, called: ev.called };
    regionPts += regions * SCORING.region;
    preaches += counted;
    if (ev.called) called += 1;
  }
  const unvisited = MAP.cities.filter((c) => !sheet.visited.includes(c.id)).length;
  const parts = {
    regions: regionPts,
    preaching: preaches * SCORING.preach,
    called: called * SCORING.called,
    unvisited: unvisited * SCORING.unvisited,
  };
  return {
    perEvangelist, preaches, called, unvisited, parts,
    total: parts.regions + parts.preaching + parts.called + parts.unvisited,
  };
}
