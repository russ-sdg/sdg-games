// Journeys with Jesus: the rules, as pure functions on a plain (JSON-safe) state object. No DOM, no randomness during play
// except the reshuffle (which uses the game's seed), so a saved game resumes exactly.
//
// A turn has phases:  recite -> draw -> play -> topup -> (next player's recite)
//   recite  optionally say a verse from a Place Card in your hand from memory; get a Scripture Memory Token if you do
//   draw    take three cards from the four face-up piles and the face-down pile, in any mix
//   play    lay down any completed journeys (and extend them to complete more); replaced journeys come in at once
//   topup   if you hold fewer than 7 Place Cards, draw until you do
import { PLACES, NEIGHBORS, simplePaths } from './board-data.js';
import { PLACE_CARDS, WILD_CARDS, JOURNEY_CARDS } from './deck-data.js';

export const HAND = 7, DRAWS = 3, UP_PILES = 4, IN_PLAY = 4, TOKEN_POINTS = 5, MAX_ROUNDS = 80;
const clone = (s) => structuredClone(s);

// ---- the deck -----------------------------------------------------------------------------------------------------
// Every physical card is an instance with a number (uid); `deckDefs(expansion)[uid]` says what it is.
const defsCache = {};
export function deckDefs(expansion) {
  const key = expansion ? 'x' : 'b';
  if (defsCache[key]) return defsCache[key];
  const defs = [];
  const add = (list, make) => {
    for (const c of list) {
      const n = c.exp ? (expansion ? c.copies : 0) : c.copies;
      for (let i = 0; i < n; i++) defs.push(make(c));
    }
  };
  // a picture used by both the game and the expansion appears twice in the gallery data (base copies, expansion copies)
  add(PLACE_CARDS, (c) => ({ kind: 'place', place: c.place, img: c.img, id: c.id }));
  add(WILD_CARDS, (c) => ({ kind: 'wild', region: c.region, img: c.img, id: c.id }));
  return (defsCache[key] = defs);
}
export const journeyDefs = (expansion) => JOURNEY_CARDS.filter((j) => expansion || !j.exp);
export const journeyById = Object.fromEntries(JOURNEY_CARDS.map((j) => [j.id, j]));
export const placeName = (id) => PLACES[id].name;
export const cardLabel = (d) => (d.kind === 'place' ? PLACES[d.place].name : d.region === 'israel' ? 'Israel Wild Card' : `${regionName(d.region)} Wild Card`);
const regionName = (r) => r.charAt(0).toUpperCase() + r.slice(1);

// ---- seeded shuffling ----------------------------------------------------------------------------------------------
export function rng(seed) {                     // mulberry32
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function shuffled(list, seed) {
  const r = rng(seed), a = [...list];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

// ---- new game ------------------------------------------------------------------------------------------------------
export function newGame({ seed = 1, players, expansion = false } = {}) {
  if (!players || players.length < 2 || players.length > 4) throw new Error('2 to 4 players');
  const defs = deckDefs(expansion);
  const draw = shuffled(defs.map((_, i) => i), seed);
  const s = {
    v: 1, seed, expansion, reshuffles: 0, round: 1, turn: 0, phase: 'recite', drawn: 0, topup: 0, recited: null, chain: null,
    passes: 0, over: false, endedBy: null, picks: [], topupFrom: 0, chains: [], turnRoutes: [], recent: [],
    players: players.map((p) => ({ name: p.name, bot: !!p.bot, skill: p.skill || null, hand: [], tokens: 0, journeys: [], routes: [] })),
    draw, up: [], discard: [],
    jdeck: shuffled(journeyDefs(expansion).map((j) => j.id), seed + 1), inplay: [], log: [],
  };
  for (const p of s.players) for (let i = 0; i < HAND; i++) p.hand.push(s.draw.pop());
  for (let i = 0; i < UP_PILES; i++) s.up.push(s.draw.pop());
  for (let i = 0; i < IN_PLAY; i++) s.inplay.push(s.jdeck.pop());
  return s;
}

export const me = (s) => s.players[s.turn];
const say = (s, text) => { s.log.push({ round: s.round, who: s.turn, text }); if (s.log.length > 60) s.log.shift(); };

// ---- piles -----------------------------------------------------------------------------------------------------------
// The face-down pile runs out: the played Place Cards are shuffled and become the new face-down pile.
function ensureDraw(s) {
  if (s.draw.length === 0 && s.discard.length > 0) {
    s.reshuffles += 1;
    s.draw = shuffled(s.discard, s.seed + 100 + s.reshuffles);
    s.discard = [];
  }
}
function fillGaps(s) {
  for (let i = 0; i < UP_PILES; i++) if (s.up[i] === null || s.up[i] === undefined) { ensureDraw(s); s.up[i] = s.draw.length ? s.draw.pop() : null; }
}
export function cardsToDraw(s) { return s.draw.length + s.discard.length + s.up.filter((u) => u !== null).length; }
export const canTake = (s, from) => (from === 'down' ? s.draw.length + s.discard.length > 0 : s.up[from] !== null && s.up[from] !== undefined);

// ---- the turn --------------------------------------------------------------------------------------------------------
// Say a Scripture from memory (or decline): `ok` true earns a Scripture Memory Token.
export function recite(s0, ok, uid = null) {
  if (s0.phase !== 'recite') throw new Error('illegal: not the recite phase');
  const s = clone(s0);
  if (ok) { me(s).tokens += 1; say(s, 'recited a Scripture from memory and earned a token'); } else if (uid !== null) say(s, 'tried to recite a Scripture but missed it');
  s.recited = ok ? true : uid !== null ? false : null;
  s.phase = 'draw'; s.drawn = 0;
  skipIfNothingToDraw(s);
  return s;
}
export const skipRecite = (s) => recite(s, false, null);

function skipIfNothingToDraw(s) {
  if (s.phase === 'draw' && cardsToDraw(s) === 0) { s.phase = 'play'; s.drawn = 0; }
}

// Take one card: from a face-up pile (0-3) or the face-down pile ('down').
export function take(s0, from) {
  if (s0.phase !== 'draw' && s0.phase !== 'topup') throw new Error('illegal: not drawing');
  if (!canTake(s0, from)) throw new Error('illegal: that pile is empty');
  const s = clone(s0), p = me(s);
  if (from === 'down') { ensureDraw(s); p.hand.push(s.draw.pop()); } else { p.hand.push(s.up[from]); s.up[from] = null; }
  s.drawn += 1; s.turnActed = true;
  s.picks = [...(s.picks || []), { uid: p.hand[p.hand.length - 1], from: from === 'down' ? 'down' : 'up' }];
  fillGaps(s);                         // a gap in the face-up piles is filled at once, so the next card you take can be the new one
  const want = s.phase === 'draw' ? DRAWS : s.topup;
  if (s.drawn >= want || cardsToDraw(s) === 0) {
    const mine = s.picks.slice(s.phase === 'draw' ? 0 : s.topupFrom), defs = deckDefs(s.expansion);
    const faceUp = mine.filter((x) => x.from === 'up').map((x) => cardLabel(defs[x.uid])), down = mine.length - faceUp.length;
    const parts = [...faceUp, ...(down ? [`${down} face-down card${down > 1 ? 's' : ''}`] : [])];
    say(s, `${s.phase === 'draw' ? 'drew' : 'drew up to a full hand:'} ${parts.join(', ') || 'nothing'}`);
    if (s.phase === 'draw') { s.phase = 'play'; s.drawn = 0; s.chains = []; } else nextTurn(s);
  }
  return s;
}

// Finish laying down journeys: draw back up to 7 Place Cards (if you hold fewer), then it is the next player's turn.
export function endPlay(s0) {
  if (s0.phase !== 'play') throw new Error('illegal: not the play phase');
  const s = clone(s0);
  const need = Math.max(0, HAND - me(s).hand.length);
  if (need > 0 && cardsToDraw(s) > 0) { s.phase = 'topup'; s.topup = need; s.drawn = 0; s.topupFrom = (s.picks || []).length; } else nextTurn(s);
  return s;
}

function nextTurn(s) {
  const acted = s.turnActed;           // set by play()/take(); a turn where nothing could happen counts toward a stall
  s.recent = (s.turnRoutes || []).map((r) => ({ ...r }));       // what this player completed, shown to the next player
  s.chains = []; s.turnRoutes = []; s.recited = null; s.drawn = 0; s.topup = 0; s.turnActed = false; s.picks = []; s.topupFrom = 0;
  refillJourneys(s);
  s.passes = acted ? 0 : s.passes + 1;
  if (s.passes >= s.players.length) return finish(s, 'stalled');
  s.turn = (s.turn + 1) % s.players.length;
  if (s.turn === 0) s.round += 1;
  if (s.round > MAX_ROUNDS) return finish(s, 'rounds');
  s.phase = 'recite';
}
// Journeys completed during a turn leave their places empty until that turn is over; then the new ones are turned up.
function refillJourneys(s) {
  for (let i = 0; i < s.inplay.length; i++) if (s.inplay[i] === null && s.jdeck.length) s.inplay[i] = s.jdeck.pop();
  s.inplay = s.inplay.filter((j) => j !== null);
}
export const journeysLeft = (s) => s.inplay.filter((j) => j !== null).length + s.jdeck.length;
function finish(s, why) { s.over = true; s.phase = 'over'; s.endedBy = why; }

// ---- journeys --------------------------------------------------------------------------------------------------------
// What is in a hand: exact place cards, region wilds, national wilds, and Scripture Memory Tokens (wild for any place).
export function inventoryOf(defs, hand, tokens) {
  const inv = { exact: {}, region: {}, israel: [], tokens };
  for (const uid of hand) {
    const d = defs[uid];
    if (d.kind === 'place') (inv.exact[d.place] ||= []).push(uid);
    else if (d.region === 'israel') inv.israel.push(uid);
    else (inv.region[d.region] ||= []).push(uid);
  }
  return inv;
}
function inventory(s, p) { return inventoryOf(deckDefs(s.expansion), p.hand, p.tokens); }
// How many of these places can NOT be covered (0 means the journey could be laid). Same order of preference as cover().
export function missing(nodes, inv) {
  const used = {}, rest = [];
  for (const place of nodes) { if ((inv.exact[place] || []).length - (used[place] || 0) > 0) used[place] = (used[place] || 0) + 1; else rest.push(place); }
  const regionUsed = {}; let left = 0;
  for (const place of rest) { const r = PLACES[place].region; if ((regionUsed[r] || 0) < (inv.region[r] || []).length) regionUsed[r] = (regionUsed[r] || 0) + 1; else left += 1; }
  return Math.max(0, left - inv.israel.length - inv.tokens);
}

// Can these places (each needing a card) be covered from the inventory? Exact cards first, then region wilds, then the
// national wild, then tokens last (a token is worth 5 points if you keep it). Returns the cards to use, or null.
function cover(nodes, inv) {
  const used = {}, plan = [];
  const exactLeft = (id) => (inv.exact[id] || []).length - (used[id] || 0);
  const need = [];
  for (const place of nodes) {
    if (exactLeft(place) > 0) { used[place] = (used[place] || 0) + 1; plan.push({ place, uid: inv.exact[place][used[place] - 1], kind: 'exact' }); } else need.push(place);
  }
  const regionUsed = {};
  const rest = [];
  for (const place of need) {
    const r = PLACES[place].region, pool = inv.region[r] || [];
    if ((regionUsed[r] || 0) < pool.length) { plan.push({ place, uid: pool[regionUsed[r] || 0], kind: 'region' }); regionUsed[r] = (regionUsed[r] || 0) + 1; } else rest.push(place);
  }
  let israel = 0, tokens = 0;
  for (const place of rest) {
    if (israel < inv.israel.length) { plan.push({ place, uid: inv.israel[israel], kind: 'israel' }); israel += 1; }
    else if (tokens < inv.tokens) { plan.push({ place, uid: null, kind: 'token' }); tokens += 1; } else return null;
  }
  return nodes.map((n) => plan.find((a) => a.place === n));           // in the order of the route
}

const rank = (p) => p.tokensUsed * 100 + p.wildsUsed * 10 + p.path.length;

function planFor(inv, journey, path, from) {
  // `from`: how many places at the front of `path` are already laid (an extension reuses those cards)
  const newNodes = path.slice(from);
  const assign = cover(newNodes, inv);
  if (!assign) return null;
  const tokensUsed = assign.filter((a) => a.kind === 'token').length;
  return { journey: journey.id, points: journey.points, path, from, assign, tokensUsed, wildsUsed: assign.filter((a) => a.kind !== 'exact' && a.kind !== 'token').length };
}

// Everything the current player can lay down right now. A fresh journey: any route along the board between the two
// places, a card for every place. An extension (once a journey is laid): more cards on top of the end of what you laid
// until another in-play journey is complete, reusing the cards already laid from any point, in order.
export function plays(s, { limit = 6 } = {}) {
  if (s.phase !== 'play') return [];
  const p = me(s), inv = inventory(s, p), out = [];
  for (const jid of s.inplay) {
    if (jid === null) continue;
    const j = journeyById[jid];
    const fresh = [];
    for (const path of simplePaths(j.a, j.b)) { const pl = planFor(inv, j, path, 0); if (pl) fresh.push({ ...pl, extends: false }); }
    fresh.sort((a, b) => rank(a) - rank(b));
    out.push(...fresh.slice(0, limit));
    const chains = s.chains || [];
    if (chains.length) {
      const seq = chains[chains.length - 1], ext = [];
      for (const [x, y] of [[j.a, j.b], [j.b, j.a]]) {
        // a journey wholly inside what is laid (a run of it, in either direction) is complete with no more cards
        if (x === j.a) { const run = insideRun(chains, j); if (run) ext.push({ journey: j.id, points: j.points, path: run, from: run.length, assign: [], tokensUsed: 0, wildsUsed: 0, extends: true, start: 0 }); }
        if (seq.includes(y)) continue;
        // or more cards on top of the end, reusing the cards laid from `x` on, in order
        for (let i = 0; i < seq.length; i++) {
          if (seq[i] !== x) continue;
          const tail = seq.slice(i), last = seq[seq.length - 1], tailSet = new Set(tail);
          for (const path of simplePaths(last, y)) {
            if (path.length < 2 || path.slice(1).some((n) => tailSet.has(n))) continue;
            const full = tail.concat(path.slice(1));
            const pl = planFor(inv, j, full, tail.length);
            if (pl) ext.push({ ...pl, extends: true, start: i });
          }
        }
      }
      ext.sort((a, b) => rank(a) - rank(b));
      out.push(...ext.slice(0, limit));
    }
  }
  return out;
}

// A journey that sits wholly inside something already laid this turn (a run of one of the chains, either way round).
export function insideRun(chains, j) {
  for (const seq of chains) {
    for (let i = 0; i < seq.length; i++) {
      for (let k = i + 1; k < seq.length; k++) {
        const x = seq[i], y = seq[k];
        if ((x === j.a && y === j.b) || (x === j.b && y === j.a)) return seq.slice(i, k + 1);
      }
    }
  }
  return null;
}

// Lay down a journey you built: `built` = { journey, extends, path, from, assign }.
//   fresh   (extends false): `path` runs from one end of the journey to the other, `assign` has a card for every place.
//   extend  (extends true, from < path.length): `path` starts with the places already laid (the last `from` places of
//           the last chain you laid), then the new places; `assign` has a card for each new place only.
//   inside  (extends true, from = path.length): the journey is wholly inside what you laid this turn; no cards.
// A card in `assign` is { place, uid, kind } with kind exact | region | israel | token (uid null for a token).
export function play(s0, built) {
  if (s0.phase !== 'play') throw new Error('illegal: not the play phase');
  const s = clone(s0), p = me(s);
  const jid = built.journey, j = journeyById[jid];
  if (!j || !s.inplay.includes(jid)) throw new Error('illegal: that journey is not in play');
  const path = built.path, from = built.from || 0, assign = built.assign || [], chains = s.chains || [];
  if (!Array.isArray(path) || path.length < 2 || new Set(path).size !== path.length) throw new Error('illegal: not a route');
  for (let i = 0; i + 1 < path.length; i++) if (!PLACES[path[i]] || !(NEIGHBORS[path[i]] || []).includes(path[i + 1])) throw new Error('illegal: no road or boat between those places');
  const ends = [path[0], path[path.length - 1]];
  if (!((ends[0] === j.a && ends[1] === j.b) || (ends[0] === j.b && ends[1] === j.a))) throw new Error('illegal: the route does not join the two places on the card');
  const inside = !!built.extends && from === path.length;
  if (!built.extends && from !== 0) throw new Error('illegal: a new journey has no cards laid yet');
  if (inside) {
    const reversed = [...path].reverse().join(), ok = chains.some((c) => { const t = c.join(','); return `,${t},`.includes(`,${path.join(',')},`) || `,${t},`.includes(`,${reversed},`); });
    if (!ok || assign.length) throw new Error('illegal: that journey is not inside what you laid');
  } else if (built.extends) {
    const chain = chains[chains.length - 1];
    if (!chain || from < 1 || from >= path.length || chain.slice(chain.length - from).join() !== path.slice(0, from).join()) throw new Error('illegal: an extension continues from the end of what you laid');
  }
  const need = path.slice(inside ? path.length : from);
  if (assign.length !== need.length || assign.some((a, i) => a.place !== need[i])) throw new Error('illegal: a card is needed for every new place');
  const defs = deckDefs(s.expansion), seen = new Set(); let tokens = 0;
  for (const a of assign) {
    if (a.kind === 'token') { tokens += 1; continue; }
    const d = defs[a.uid];
    if (seen.has(a.uid) || !p.hand.includes(a.uid) || !d) throw new Error('illegal: that card is not in your hand');
    seen.add(a.uid);
    const okCard = (a.kind === 'exact' && d.kind === 'place' && d.place === a.place) || (a.kind === 'region' && d.kind === 'wild' && d.region !== 'israel' && d.region === PLACES[a.place].region)
      || (a.kind === 'israel' && d.kind === 'wild' && d.region === 'israel');
    if (!okCard) throw new Error('illegal: that card cannot stand for ' + PLACES[a.place].name);
  }
  if (tokens > p.tokens) throw new Error('illegal: you have no token to use');
  for (const a of assign) {
    if (a.kind === 'token') { p.tokens -= 1; continue; }
    p.hand.splice(p.hand.indexOf(a.uid), 1);
    s.discard.push(a.uid);
  }
  const at = s.inplay.indexOf(jid);
  p.journeys.push(jid);
  (p.routes ||= []).push({ journey: jid, path: path.slice() });
  s.inplay[at] = null;                         // the new journey is turned up when this turn is over
  if (!built.extends) s.chains = [...chains, path.slice()];
  else if (!inside) s.chains = [...chains.slice(0, -1), chains[chains.length - 1].concat(path.slice(from))];
  (s.turnRoutes ||= []).push({ who: s.turn, journey: jid, path: path.slice(), slot: at, how: !built.extends ? 'fresh' : inside ? 'inside' : 'extend' });
  s.turnActed = true;
  say(s, `${built.extends ? (inside ? 'also completed' : 'extended to complete') : 'completed'} ${PLACES[j.a].name} to ${PLACES[j.b].name} (${j.points} points)`);
  if (s.inplay.every((x) => x === null) && s.jdeck.length === 0) finish(s, 'journeys');
  return s;
}

// ---- scoring ---------------------------------------------------------------------------------------------------------
export function score(p) {
  const journeys = p.journeys.reduce((n, id) => n + journeyById[id].points, 0);
  return { journeys, tokens: p.tokens * TOKEN_POINTS, total: journeys + p.tokens * TOKEN_POINTS };
}
export const standings = (s) => s.players.map((p, i) => ({ i, name: p.name, ...score(p) })).sort((a, b) => b.total - a.total);
export function winners(s) {
  const st = standings(s);
  return st.filter((x) => x.total === st[0].total).map((x) => x.i);
}
