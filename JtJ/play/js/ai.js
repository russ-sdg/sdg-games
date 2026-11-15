// The computer players. They plan a journey like a traveller: how many rolls will it take to reach every remaining site, in the best
// order? Skill changes how reliably they follow that plan (casual / steady / sharp).
import { TILES, distFrom, SITE_TILE } from './map-data.js';
import { CARD } from './cards.js';
import * as E from './engine.js';

// expected rolls to cover d squares exactly (a roll of d or more reaches it; smaller rolls move you part of the way)
const EXP = [0];
for (let d = 1; d < 80; d++) { let s = 0; for (let r = 1; r <= 5 && r < d; r++) s += EXP[d - r]; EXP[d] = 1 + s / 6; }
export const expectedRolls = (d) => EXP[Math.min(d, 79)];

// a planner for a set of sites still to visit: cost(tile, mask) = expected rolls to visit the sites in `mask` from `tile`, best order
export function planner(sites) {
  const k = sites.length, full = (1 << k) - 1, st = sites.map((s) => SITE_TILE[s]);
  const dd = st.map((t) => distFrom(t));
  const tail = Array.from({ length: full + 1 }, () => new Array(k).fill(0));        // tail[mask][last]: still to visit `mask`, standing on site `last`
  for (let m = 1; m <= full; m++) for (let last = 0; last < k; last++) {
    let best = Infinity;
    for (let s = 0; s < k; s++) if (m & (1 << s)) best = Math.min(best, expectedRolls(dd[last][st[s]]) + tail[m & ~(1 << s)][s]);
    tail[m][last] = best;
  }
  const from = (tile, m) => { if (!m) return 0; let best = Infinity; for (let s = 0; s < k; s++) if (m & (1 << s)) best = Math.min(best, expectedRolls(distFrom(tile)[st[s]]) + tail[m & ~(1 << s)][s]); return best; };
  return { full, from, bit: (site) => sites.indexOf(site) };
}

const NOISE = { casual: 0.9, steady: 0.5, sharp: 0 };
const noise = (skill, rnd) => (NOISE[skill] || 0) * (rnd() - 0.5) * 2;

const remaining = (p) => E.cardSites(p.card).filter((s) => !p.visited.includes(s));

// how attractive a card is from a given square: points per expected roll, nudged toward categories still to be completed
function worth(p, cardId, tile) {
  const sites = E.cardSites(cardId), pl = planner(sites), rolls = pl.from(tile, pl.full);
  const have = E.doneCategories(p), bonus = have.has(CARD[cardId].cat) ? 1 : (p.skill === 'sharp' ? 1.3 : p.skill === 'steady' ? 1.12 : 1);
  return (CARD[cardId].pts * bonus) / (rolls + 1);
}

// setup and after a journey: which card to keep (the first card wins ties)
export function pickCard(S, seat, rnd = Math.random) {
  const p = S.players[seat], tile = p.pos >= 0 ? p.pos : null;
  const score = (id) => {
    const at = tile !== null ? [tile] : TILES.filter((t) => t.c === p.color).map((t) => t.i);
    const v = Math.max(...at.map((t) => worth(p, id, t)));
    return v * (1 + noise(p.skill, rnd) * 0.25);
  };
  return p.offer.slice().sort((a, b) => score(b) - score(a))[0];
}
// setup: the square of your colour closest (in expected rolls) to finishing the chosen card
export function pickStart(S, seat, cardId, rnd = Math.random) {
  const p = S.players[seat], sites = E.cardSites(cardId), pl = planner(sites);
  const squares = E.startSquares(S, seat).map((t) => ({ t, c: pl.from(t, pl.full) + noise(p.skill, rnd) * 0.6 }));
  return squares.sort((a, b) => a.c - b.c)[0].t;
}
// setup: both together (the card and the square it is best played from)
export function pickSetup(S, seat, rnd = Math.random) {
  const p = S.players[seat];
  const rated = p.offer.map((id) => { const sq = E.startSquares(S, seat), v = Math.max(...sq.map((t) => worth(p, id, t))); return { id, v: v * (1 + noise(p.skill, rnd) * 0.25) }; });
  const card = rated.sort((a, b) => b.v - a.v)[0].id;
  return { card, tile: pickStart(S, seat, card, rnd) };
}

// a move: the square to finish on, or null to stay put. Lands on a needed site when it can; otherwise heads for the best next one.
export function pickMove(S, seat, rnd = Math.random) {
  const p = S.players[seat], need = remaining(p);
  if (!need.length) return null;
  const pl = planner(need), opts = E.options(S, seat);
  const score = (tile) => {
    const site = TILES[tile].site, left = site !== null && need.includes(site) ? pl.full & ~(1 << pl.bit(site)) : pl.full;
    return pl.from(tile, left) + noise(p.skill, rnd);
  };
  if (p.skill === 'casual' && rnd() < 0.12) return opts.length ? opts[Math.floor(rnd() * opts.length)].tile : null;     // wanders now and then
  let best = null, bc = score(p.pos) + 0.01 + noise(p.skill, rnd);                                                  // staying put counts when you are on a site you need
  for (const o of opts) { const c = score(o.tile); if (c < bc - 1e-9 || (Math.abs(c - bc) < 1e-9 && best !== null && rnd() < 0.5)) { bc = c; best = o.tile; } }
  return best;
}

// play every computer's part of the current phase (moves, or card choices); returns the new state
export function botMoves(S0, rnd = Math.random) {
  let S = S0;
  S.players.forEach((p, seat) => { if (p.bot && S.phase === 'move' && !(seat in S.moves)) S = E.submitMove(S, seat, pickMove(S, seat, rnd)); });
  return S;
}
export function botPicks(S0, rnd = Math.random) {
  let S = S0;
  S.players.forEach((p, seat) => { if (p.bot && S.phase === 'pick' && S.players[seat].offer.length) S = E.chooseCard(S, seat, pickCard(S, seat, rnd)); });
  return S;
}
export function botStarts(S0, rnd = Math.random) {
  let S = S0;
  S.players.forEach((p, seat) => { if (p.bot && S.phase === 'start' && S.players[seat].offer.length) { const c = pickSetup(S, seat, rnd); S = E.chooseStart(S, seat, c.card, c.tile); } });
  return S;
}
