// Journeys with Jesus: building a journey by hand, one card at a time. Pure functions (no DOM): the page keeps a `build`
// and calls these as you tap cards or cities; when the route reaches the far end, `toPlay(build)` is handed to the engine.
//
// A build is { jid, mode, reuse, seq, target }:
//   mode 'fresh'   a new line: the first card must be one end of the journey, then each card must be a place joined to the
//                  last by a road or boat ride, until the other end is reached
//   mode 'extend'  cards on top of the end of the line you already laid this turn; `reuse` is the part of that line from
//                  one end of the journey to the end of the line, and `target` is the other end of the journey
//   seq            the cards laid in this build so far: [{ place, uid, kind }] (kind exact | region | israel | token)
import { PLACES, NEIGHBORS } from './board-data.js';
import * as E from './engine.js';

// What happens when you tap a journey card: 'inside' (it is wholly inside what you laid this turn: take it, no cards),
// or a new build (extend the last line if one end of the journey is on it, else a fresh line).
export function begin(state, jid) {
  const j = E.journeyById[jid], chains = state.chains || [];
  const run = E.insideRun(chains, j);
  if (run) return { inside: { journey: jid, extends: true, path: run, from: run.length, assign: [] } };
  const chain = chains[chains.length - 1];
  if (chain) {
    for (const [x, y] of [[j.a, j.b], [j.b, j.a]]) {
      const i = chain.indexOf(x);
      if (i >= 0 && !chain.includes(y)) return { build: { jid, mode: 'extend', reuse: chain.slice(i), seq: [], target: y } };
    }
  }
  return { build: { jid, mode: 'fresh', reuse: [], seq: [], target: null } };
}
// Give up the extension and start a separate line from one end of the journey.
export const startFresh = (build) => ({ jid: build.jid, mode: 'fresh', reuse: [], seq: [], target: null });

export const placesIn = (build) => [...build.reuse, ...build.seq.map((c) => c.place)];
export const lastPlace = (build) => (build.seq.length ? build.seq[build.seq.length - 1].place : build.reuse.length ? build.reuse[build.reuse.length - 1] : null);
// The route so far (for drawing): the reused places, then the new ones.
export const routeSoFar = (build) => placesIn(build);

// Can this place be next? Returns { ok: true } or { ok: false, why }.
export function canPlace(build, place) {
  const j = E.journeyById[build.jid], name = PLACES[place].name;
  if (placesIn(build).includes(place)) return { ok: false, why: `${name} is already on the route.` };
  const last = lastPlace(build);
  if (last === null) {
    return place === j.a || place === j.b ? { ok: true } : { ok: false, why: `Start at ${PLACES[j.a].name} or ${PLACES[j.b].name}, one end of the journey.` };
  }
  if (!NEIGHBORS[last].includes(place)) return { ok: false, why: `${name} is not joined to ${PLACES[last].name} by a road or boat ride.` };
  return { ok: true };
}

// The cards in your hand that could stand for `place` (not already used in this build), best choice first: an exact card,
// then a Region Wild Card for that region, then the Israel card, and finally a Scripture Memory Token.
export function cardsFor(state, build, place) {
  const p = E.me(state), defs = E.deckDefs(state.expansion), used = new Set(build.seq.map((c) => c.uid).filter((u) => u !== null));
  const tokensUsed = build.seq.filter((c) => c.kind === 'token').length;
  const out = [];
  const pick = (kind, test) => { const uid = p.hand.find((u) => !used.has(u) && test(defs[u])); if (uid !== undefined) out.push({ place, uid, kind }); };
  pick('exact', (d) => d.kind === 'place' && d.place === place);
  pick('region', (d) => d.kind === 'wild' && d.region !== 'israel' && d.region === PLACES[place].region);
  pick('israel', (d) => d.kind === 'wild' && d.region === 'israel');
  if (p.tokens - tokensUsed > 0) out.push({ place, uid: null, kind: 'token' });
  return out;
}

// Every place that could be next right now (for naming a Wild Card, and for hints about what is legal).
export const legalPlaces = (build) => Object.keys(PLACES).filter((id) => canPlace(build, id).ok);

// Lay one card. Returns { build, done } or throws a message.
export function add(build, card) {
  const check = canPlace(build, card.place);
  if (!check.ok) throw new Error(check.why);
  const j = E.journeyById[build.jid];
  const seq = [...build.seq, card];
  let target = build.target;
  if (build.mode === 'fresh' && build.seq.length === 0) target = card.place === j.a ? j.b : j.a;
  const next = { ...build, seq, target };
  return { build: next, done: card.place === target };
}

// Take the last card back (and, in a fresh build, the start with it when it is the only one).
export function undo(build) {
  const seq = build.seq.slice(0, -1);
  return { ...build, seq, target: build.mode === 'fresh' && seq.length === 0 ? null : build.target };
}

// The finished route, ready for the engine.
export function toPlay(build) {
  return { journey: build.jid, extends: build.mode === 'extend', path: placesIn(build), from: build.reuse.length, assign: build.seq.map((c) => ({ place: c.place, uid: c.uid, kind: c.kind })) };
}
export const points = (build) => E.journeyById[build.jid].points;
