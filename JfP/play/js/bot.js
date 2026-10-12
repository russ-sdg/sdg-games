// Journeys for Paul - the computer opponents' brain (pure: no DOM, no globals).
// A bot plays its own sheet by exactly the same rules as a person: it is given the sheet, the
// rolled way to travel and its role (roller / other) and returns the actions it takes.

import MAP from './map-data.js';
import {
  MODES, EVANGELISTS, options, maxActions, applyMove, applyPreach, wouldBeCalled,
  canTravelAtAll, city, edge, otherEnd,
} from './engine.js';

// noise : random wobble added to every action's value (bigger = more random play)
// look  : how much weight to give where an evangelist will be able to go next
// depth : how many hops ahead that looks (1 = just the neighbours)
// slip  : chance of ignoring its own judgement and acting at random
export const BOT_LEVELS = {
  casual: { id: 'casual', name: 'Casual', blurb: 'wanders about, makes mistakes', noise: 5, look: 0, depth: 0, slip: 0.25 },
  steady: { id: 'steady', name: 'Steady', blurb: 'sensible, sometimes short-sighted', noise: 2.2, look: 0.3, depth: 1, slip: 0 },
  sharp: { id: 'sharp', name: 'Sharp', blurb: 'plans ahead and plays to win', noise: 0.1, look: 0.9, depth: 3, slip: 0 },
};
export const DEFAULT_LEVEL = 'steady';

const EDGES_AT = {};
for (const e of MAP.edges) {
  (EDGES_AT[e.a] ??= []).push(e);
  (EDGES_AT[e.b] ??= []).push(e);
}

// What an evangelist standing in `from` could still discover over routes he has not used yet:
// cities nobody has visited and regions he has not been to, discounted by how many hops away.
function prospects(sheet, evId, from, usedExtra, depth) {
  const ev = sheet.evangelists[evId];
  const used = new Set([...sheet.used[evId], usedExtra]);
  const seenCity = new Set([from]);
  const seenRegion = new Set();
  let score = 0;
  let frontier = [from];
  for (let hop = 1; hop <= depth && frontier.length; hop++) {
    const next = [];
    for (const c of frontier) {
      for (const e of EDGES_AT[c]) {
        if (used.has(e.id)) continue;
        const to = otherEnd(e, c);
        if (seenCity.has(to)) continue;
        seenCity.add(to);
        next.push(to);
        if (!sheet.visited.includes(to)) score += 1.2 / hop;
        const r = city(to).region;
        if (!ev.regions.includes(r) && !seenRegion.has(r)) { seenRegion.add(r); score += 1.5 / hop; }
      }
    }
    frontier = next;
  }
  return score;
}

// Points a move is worth: a city nobody has visited saves the -2 penalty (+2), a region this
// evangelist has not been to is +4. `look` adds a nudge towards places with more still to see.
function valueMove(sheet, evId, edgeId, lvl) {
  const ev = sheet.evangelists[evId];
  const to = otherEnd(edge(edgeId), ev.city);
  let v = 0;
  if (!sheet.visited.includes(to)) v += 2;
  if (!ev.regions.includes(city(to).region)) v += 4;
  if (lvl.look) {
    const onward = EDGES_AT[to].filter((e) => e.id !== edgeId && !sheet.used[evId].includes(e.id)).length;
    v += lvl.look * (Math.min(onward, 3) * 0.6 + prospects(sheet, evId, to, edgeId, lvl.depth));
  }
  return v;
}

// A plain preach is +3. The preach that gets someone called is +5 but ends his travels, so it only
// pays once he is stuck anyway or there is little left to discover.
function valuePreach(sheet, evId, rules) {
  if (!wouldBeCalled(sheet, evId, rules)) return 3;
  const unvisited = MAP.cities.length - sheet.visited.length;
  const cost = canTravelAtAll(sheet, evId) ? 3 + 0.4 * unvisited : 0;
  return 5 - cost;
}

function candidates(sheet, mode, role, rules, acted) {
  const out = [];
  for (const ev of EVANGELISTS) {
    if (acted.includes(ev)) continue;
    const o = options(sheet, ev, mode, role, rules);
    for (const m of o.moves) out.push({ ev, type: 'move', edge: m.edge });
    if (o.preach) out.push({ ev, type: 'preach' });
  }
  return out;
}

function apply(sheet, a, rules) {
  return a.type === 'move' ? applyMove(sheet, a.ev, a.edge) : applyPreach(sheet, a.ev, rules).sheet;
}

// The actions a bot takes on one roll, applied in order. Returns {actions, value}.
export function planTurn(sheet, mode, role, rules, level = DEFAULT_LEVEL, rng = Math.random) {
  const lvl = BOT_LEVELS[level] ?? BOT_LEVELS[DEFAULT_LEVEL];
  const limit = maxActions(role);
  const actions = [];
  const acted = [];
  let value = 0;
  let s = sheet;
  while (actions.length < limit) {
    const cands = candidates(s, mode, role, rules, acted);
    if (!cands.length) break;
    let best = null;
    if (rng() < lvl.slip) {
      // a lapse: any legal action, whatever it is worth - but never a pointless call
      const pool = cands.filter((c) => c.type === 'move' || !wouldBeCalled(s, c.ev, rules) || !canTravelAtAll(s, c.ev));
      if (!pool.length) break;                // only a pointless call is left: pass instead
      const a = pool[Math.floor(rng() * pool.length)];
      best = { a, v: a.type === 'move' ? valueMove(s, a.ev, a.edge, lvl) : valuePreach(s, a.ev, rules) };
    } else {
      for (const a of cands) {
        const v = a.type === 'move' ? valueMove(s, a.ev, a.edge, lvl) : valuePreach(s, a.ev, rules);
        const noisy = v + (rng() - 0.5) * 2 * lvl.noise;
        if (!best || noisy > best.noisy) best = { a, v, noisy };
      }
      if (best.v < 0) break;           // e.g. a call that would waste an evangelist: rather pass
    }
    actions.push(best.a);
    acted.push(best.a.ev);
    value += best.v;
    s = apply(s, best.a, rules);
  }
  return { actions, value };
}

// A bot who rolled Player's Choice picks the way of travel that is worth most to its own sheet.
export function chooseModeFor(sheet, role, rules, level = DEFAULT_LEVEL, rng = Math.random) {
  const lvl = BOT_LEVELS[level] ?? BOT_LEVELS[DEFAULT_LEVEL];
  if (rng() < lvl.slip) return MODES[Math.floor(rng() * MODES.length)];
  let best = null;
  for (const mode of MODES) {
    const { value } = planTurn(sheet, mode, role, rules, level, rng);
    const noisy = value + (rng() - 0.5) * 2 * lvl.noise;
    if (!best || noisy > best.noisy) best = { mode, noisy };
  }
  return best.mode;
}
