// Journeys through Jerusalem: the rules, as pure functions on a plain (JSON) state, so a game can be saved and resumed.
// Everyone moves at once on their own map. One player rolls the die each round; everyone moves up to that many squares.
import { TILES, SITES, SITE_INDEX, reachable } from './map-data.js';
import { CARDS, CARD } from './cards.js';

export const V = 1;
export const END_BONUS = 5;                 // points for each site visited on a journey still under way when the game ends
export const ROLL_LIMIT = 150;              // safety stop: nobody can play for ever

// ---- randomness: a seeded generator whose position lives in the state ----------------------------------------------------------------
function next(S) { let a = (S.r = (S.r + 0x6d2b79f5) >>> 0); a = Math.imul(a ^ (a >>> 15), a | 1); a ^= a + Math.imul(a ^ (a >>> 7), a | 61); return ((a ^ (a >>> 14)) >>> 0) / 4294967296; }
export function shuffled(S, list) { const a = list.slice(); for (let i = a.length - 1; i > 0; i--) { const k = Math.floor(next(S) * (i + 1)); [a[i], a[k]] = [a[k], a[i]]; } return a; }

const clone = (S) => JSON.parse(JSON.stringify(S));
const needed = (p) => (p.card ? CARD[p.card].stops.map((s) => SITE_INDEX[s.site]) : []);
export const cardSites = (id) => CARD[id].stops.map((s) => SITE_INDEX[s.site]);

// players: [{ name, bot, skill, color }] where color is a tile colour letter, all different. Everyone is dealt two Character Cards.
export function newGame({ seed, players }) {
  const S = { v: V, r: seed >>> 0, seed, phase: 'start', rolls: 0, roller: 0, die: 0, moves: {}, deck: [], players: [], last: [], over: false, winners: [], endedBy: null };
  S.deck = shuffled(S, CARDS.map((c) => c.id));
  S.players = players.map((p) => ({ name: p.name, bot: !!p.bot, skill: p.skill || null, color: p.color, pos: -1, card: null, visited: [], done: [], offer: [] }));
  for (const p of S.players) p.offer = S.deck.splice(0, 2);
  S.roller = Math.floor(next(S) * S.players.length);
  return S;
}

// ---- setup: choose one of your two cards and a square of your colour to start on ---------------------------------------------------
export const startSquares = (S, seat) => TILES.filter((t) => t.c === S.players[seat].color).map((t) => t.i);
export function chooseStart(S0, seat, cardId, tile) {
  const S = clone(S0), p = S.players[seat];
  if (S.phase !== 'start' || !p.offer.includes(cardId)) throw new Error('not one of your two cards');
  if (!startSquares(S, seat).includes(tile)) throw new Error('start on a square that matches your token colour');
  S.deck.push(...p.offer.filter((c) => c !== cardId));
  p.card = cardId; p.pos = tile; p.offer = [];
  if (S.players.every((q) => q.card)) { S.phase = 'roll'; S.last = []; }
  return S;
}

// ---- a round ------------------------------------------------------------------------------------------------------------------------
export function roll(S0) {
  if (S0.phase !== 'roll') throw new Error('not time to roll');
  const S = clone(S0);
  S.die = 1 + Math.floor(next(S) * 6); S.rolls += 1; S.moves = {}; S.phase = 'move'; S.last = [];
  return S;
}
export const options = (S, seat) => reachable(S.players[seat].pos, S.die);

// tile: the square to finish on (1 to `die` squares away), or null to stay put
export function submitMove(S0, seat, tile) {
  if (S0.phase !== 'move' || seat in S0.moves) throw new Error('not time to move');
  if (tile !== null && !options(S0, seat).some((o) => o.tile === tile)) throw new Error('too far for that roll');
  const S = clone(S0); S.moves[seat] = tile;
  return S;
}
export const allMoved = (S) => S.phase === 'move' && S.players.every((_, i) => i in S.moves);

export function score(p) {
  const need = new Set(needed(p));
  return p.done.reduce((n, id) => n + CARD[id].pts, 0) + END_BONUS * p.visited.filter((s) => need.has(s)).length;
}
export const doneCategories = (p) => new Set(p.done.map((id) => CARD[id].cat));
export const complete = (p) => !!p.card && needed(p).every((s) => p.visited.includes(s));

// Everyone moves, circles any site they finished on, and anyone with all their sites announces the journey. Players who complete
// draw two new cards (in turn order from the roller), unless the game has just ended: all three categories done, or no cards to draw.
export function resolve(S0) {
  if (!allMoved(S0)) throw new Error('not everyone has moved');
  const S = clone(S0), ev = [], n = S.players.length;
  S.players.forEach((p, seat) => {
    const to = S.moves[seat], from = p.pos;
    p.pos = to === null ? from : to; const site = TILES[p.pos].site;   // moving fewer squares includes none: you are already there
    ev.push({ t: to === null ? 'stay' : 'move', seat, from, to: p.pos, site });
    if (site !== null && !p.visited.includes(site)) p.visited.push(site);
  });
  const order = Array.from({ length: n }, (_, k) => (S.roller + k) % n), finished = order.filter((seat) => complete(S.players[seat]));
  for (const seat of finished) { const p = S.players[seat]; p.done.push(p.card); ev.push({ t: 'complete', seat, card: p.card }); }
  const allThree = (p) => doneCategories(p).size === 3;
  if (finished.some((seat) => allThree(S.players[seat]))) S.endedBy = 'categories';
  for (const seat of finished) {
    const p = S.players[seat]; p.card = null; p.visited = [];
    if (S.endedBy) continue;
    if (!S.deck.length) { S.endedBy = 'deck'; continue; }
    p.offer = S.deck.splice(0, 2);
    if (p.offer.length === 1) { p.card = p.offer[0]; p.offer = []; ev.push({ t: 'forced', seat, card: p.card }); }   // only one card left: you play it
  }
  S.last = ev; S.moves = {};
  if (S.endedBy || S.rolls >= ROLL_LIMIT) { if (!S.endedBy) S.endedBy = 'limit'; return finish(S); }
  S.phase = S.players.some((p) => p.offer.length) ? 'pick' : 'roll';
  if (S.phase === 'roll') S.roller = (S.roller + 1) % n;
  return S;
}

// after a completed journey: keep one of the two cards drawn, the other goes to the bottom of the deck
export function chooseCard(S0, seat, cardId) {
  const S = clone(S0), p = S.players[seat];
  if (S.phase !== 'pick' || !p.offer.includes(cardId)) throw new Error('not one of your two cards');
  S.deck.push(...p.offer.filter((c) => c !== cardId));
  p.card = cardId; p.offer = []; p.visited = [];
  if (!S.players.some((q) => q.offer.length)) { S.phase = 'roll'; S.roller = (S.roller + 1) % S.players.length; }
  return S;
}

function finish(S) {
  S.over = true; S.phase = 'over';
  for (const p of S.players) p.offer = [];
  const sc = S.players.map(score), best = Math.max(...sc);
  const tied = S.players.map((_, i) => i).filter((i) => sc[i] === best), most = Math.max(...tied.map((i) => S.players[i].done.length));
  S.winners = tied.filter((i) => S.players[i].done.length === most);
  return S;
}

export const standings = (S) => S.players.map((p, seat) => ({ seat, name: p.name, score: score(p), done: p.done.length })).sort((a, b) => b.score - a.score || b.done - a.done || a.seat - b.seat);
export const siteName = (s) => SITES[s].name;
export { CARD, CARDS };
