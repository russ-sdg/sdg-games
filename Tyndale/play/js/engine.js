// Tyndale: rules engine (pure functions on plain state; no DOM). The app is the referee: it keeps Tyndale's position,
// scorecard and shipments, answers the Bishop's Agents' questions truthfully, and ends the game.
import { POINTS, COLS, SIZE, LONDON } from './board-data.js';

export const PUBS = ['N', 'P', 'H', 'O'];
export const PUB_NAMES = { N: 'The New Testament', P: 'The Pentateuch', H: 'The Historical Books', O: 'The Old Testament' };
export const NEAR = 3;                                       // "near" (for the Secret Supporter's location card): within this many steps

const clone = (s) => structuredClone(s);
export const pt = Object.fromEntries(POINTS.map((p) => [p.id, p]));
export const colOf = (id) => COLS.indexOf(id[0]);
export const rowOf = (id) => Number(id.slice(1)) - 1;
export const idAt = (c, r) => (c >= 0 && c < SIZE && r >= 0 && r < SIZE ? COLS[c] + (r + 1) : null);
export const dist = (a, b) => Math.abs(colOf(a) - colOf(b)) + Math.abs(rowOf(a) - rowOf(b));
export const neighbors = (id) => [idAt(colOf(id) + 1, rowOf(id)), idAt(colOf(id) - 1, rowOf(id)), idAt(colOf(id), rowOf(id) + 1), idAt(colOf(id), rowOf(id) - 1)].filter(Boolean);
export const isPrintingCentre = (id) => !!pt[id].centre && id !== LONDON;
export const isCoastal = (id) => pt[id].coast !== null;
export const centres = POINTS.filter((p) => p.centre && p.id !== LONDON).map((p) => p.id);
export const coastal = POINTS.filter((p) => p.coast !== null).map((p) => p.id);

// ---- seeded randomness stored in the state (so a saved game continues the same way) -------------------------------
export function hash01(seed, n) {
  let t = (seed ^ Math.imul(n + 0x9e3779b9, 0x85ebca6b)) >>> 0;
  t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
export function draw(s) { s.rc += 1; return hash01(s.seed, s.rc); }
export const rollDie = (s) => 1 + Math.floor(draw(s) * 3);       // the die has values 1, 2 and 3

// ---- new game --------------------------------------------------------------------------------------------------------
// seats: [{name, human}], each controls pawns (4 pawns for 1-4 agent seats, 5 for 5). Seat ids are their index.
export function pawnsPerSeat(nSeats) {
  const total = nSeats >= 5 ? 5 : 4, base = Math.floor(total / nSeats), extra = total % nSeats;
  return Array.from({ length: nSeats }, (_, i) => base + (i < extra ? 1 : 0));
}
export function newGame({ seats, seed = 1, supporter = null }) {
  const per = pawnsPerSeat(seats.length);
  const pawns = [];
  seats.forEach((_, i) => { for (let k = 0; k < per[i]; k++) pawns.push({ id: pawns.length, seat: i, pos: null, out: false }); });
  const s = {
    seed, rc: 0, round: 0, phase: 'place',                   // place -> (tyndale start) -> agents/tyndale turns -> over
    seats: seats.map((x, i) => ({ id: i, name: x.name, human: !!x.human, out: false })),
    pawns,
    supporter,                                               // seat id of the Secret Supporter, or null (only with 5+ players in all)
    t: {                                                     // Tyndale's secret state
      pos: null, translated: 0, published: -1, shipped: -1,  // indexes into PUBS
      bonus: [], visited: [], marks: {}, trail: [],
    },
    shipments: [],                                           // {pub, from, dist, left, fresh}
    delivered: [],                                           // {pub, round, from}
    carry: {},                                               // pawn id -> pub letter carried by the Secret Supporter
    reports: {},                                             // seat -> {n, nothing}: what each Agent has reported, as the others saw it
    found: {},                                               // pooled findings of the Agents: pos -> {loc, bible, round, by}
    private: {},                                             // the Secret Supporter's own findings, not shared
    obs: [], pobs: [],                                       // every shared / private finding in order: {round, pos, loc, bible}
    moved: [],                                               // pawn ids that have moved this round
    pending: null,                                           // {pawnId, roll}: a roll that has been made but not yet used
    accusation: null,                                        // {after: 'N', open: true} while an accusation may be made
    log: [], over: false, winner: null, endReason: null,
  };
  return s;
}
export const hasSupporter = (nSeats) => nSeats >= 4;          // Tyndale + 4 or more Agent players = 5+ players
const note = (s, text, pub = true) => { s.log.push({ round: s.round, text, pub }); if (s.log.length > 200) s.log.shift(); };

export const pawnAt = (s, id) => s.pawns.find((p) => p.pos === id && !p.out);
export const seatOfPawn = (s, pawnId) => s.pawns[pawnId].seat;
export const livePawns = (s) => s.pawns.filter((p) => !p.out);
export const isSupporterPawn = (s, pawnId) => s.supporter !== null && s.pawns[pawnId].seat === s.supporter;
export const pubLetter = (s) => (s.t.published >= 0 ? PUBS[s.t.published] : null);

// ---- placing the pawns ---------------------------------------------------------------------------------------------------
export function placePawn(state, pawnId, pos) {
  if (state.phase !== 'place') throw new Error('pawns are already placed');
  if (!pt[pos]) throw new Error('no such location');
  if (pawnAt(state, pos)) throw new Error('that location is taken');
  const s = clone(state);
  s.pawns[pawnId].pos = pos;
  return s;
}
export const allPlaced = (s) => s.pawns.every((p) => p.out || p.pos !== null);

// ---- Tyndale ----------------------------------------------------------------------------------------------------------------
function publishAndShip(s, pos, startOfGame) {
  const t = s.t, name = pt[pos].centre;
  const events = [];
  if (isPrintingCentre(pos)) {
    if (!t.visited.includes(pos)) {
      if (t.published < t.translated) {                      // a translation is waiting to be printed
        t.published = t.translated; t.bonus.push(PUBS[t.published]);
        events.push(`published ${PUB_NAMES[PUBS[t.published]]} in ${name}`);
      }
      t.visited.push(pos);
    }
  }
  if (isCoastal(pos) && t.published > t.shipped) {            // a publication waits to be shipped
    t.shipped = t.published;
    const d = pt[pos].coast;
    s.shipments.push({ pub: PUBS[t.shipped], from: pos, dist: d, left: d, fresh: true });
    events.push(`shipped ${PUB_NAMES[PUBS[t.shipped]]} from ${pos} (${d >= 11 ? '11+' : d} moves)`);
    if (t.translated < 3) { t.translated = t.shipped + 1; events.push(`translated ${PUB_NAMES[PUBS[t.translated]]}`); }
  }
  return events;
}

export function startTyndale(state, pos) {
  if (state.phase !== 'place' || !allPlaced(state)) throw new Error('place the pawns first');
  if (pawnAt(state, pos)) throw new Error('an Agent is there');
  if (!pt[pos]) throw new Error('no such location');
  const s = clone(state), t = s.t;
  t.pos = pos; t.trail.push(pos);
  const ev = publishAndShip(s, pos, true);
  if (t.published >= 0) t.marks[pos] = pubLetter(s);
  ev.forEach((e) => note(s, `Tyndale ${e}.`, false));
  s.shipments.forEach((x) => { x.fresh = false; });            // the starting shipment is crossed off from his first turn
  s.phase = 'tyndale'; s.round = 1; s.moved = [];            // round 1 begins with Tyndale's first move
  return s;
}

// How far may Tyndale go this turn with this path? path = the spots he steps onto, in order.
export function checkTyndalePath(s, path) {
  const t = s.t;
  if (!path.length) return { ok: false, reason: 'move at least one step' };
  let at = t.pos;
  for (const p of path) { if (!neighbors(at).includes(p)) return { ok: false, reason: 'steps must be to an adjacent spot' }; at = p; }
  const base = pt[path[0]].kind === 'blue' ? 2 : 1;           // a blue first spot allows a second move
  const needBonus = Math.max(0, path.length - base);
  if (needBonus > t.bonus.length) return { ok: false, reason: 'not enough moves', needBonus };
  if (pawnAt(s, at)) return { ok: false, reason: 'you cannot finish where an Agent stands' };
  return { ok: true, needBonus, base };
}
// The spots Tyndale may step to next from a partial path (for the UI), and whether he may stop here.
export function tyndaleNext(s, path) {
  const here = path.length ? path[path.length - 1] : s.t.pos;
  const n = path.length;
  const base = n === 0 ? 1 : (pt[path[0]].kind === 'blue' ? 2 : 1);
  const canStep = n < base + s.t.bonus.length;
  return { steps: canStep ? neighbors(here) : [], canStop: n >= 1 && !pawnAt(s, here) };
}

export function tyndaleMove(state, path) {
  if (state.phase !== 'tyndale') throw new Error('not Tyndale\'s turn');
  const chk = checkTyndalePath(state, path);
  if (!chk.ok) throw new Error(chk.reason);
  const s = clone(state), t = s.t;
  for (let i = 0; i < chk.needBonus; i++) t.bonus.shift();   // strike through that many bonus-move letters
  t.pos = path[path.length - 1]; t.trail.push(...path);
  const ev = publishAndShip(s, t.pos, false);
  if (t.published >= 0) path.forEach((p) => { t.marks[p] = pubLetter(s); });
  ev.forEach((e) => note(s, `Tyndale ${e}.`, false));
  // cross off the next number of every shipment sent on an earlier turn
  for (const sh of s.shipments) {
    if (sh.arrived) continue;
    if (sh.fresh) { sh.fresh = false; continue; }
    sh.left -= 1;
    if (sh.left <= 0) {
      sh.arrived = true; s.delivered.push({ pub: sh.pub, round: s.round, from: sh.from });
      note(s, `${PUB_NAMES[sh.pub]} has arrived in London!`);
      s.accusation = { after: sh.pub, open: s.supporter !== null };
      if (sh.pub === 'O') return finish(s, 'tyndale', 'delivered');
    }
  }
  s.phase = 'agents';
  return s;
}

// ---- the Agents -----------------------------------------------------------------------------------------------------------
// The spots a pawn can end on after exactly n steps (it may pass through others, but not finish on another pawn).
export function pawnTargets(s, pawnId, n) {
  let cur = new Set([s.pawns[pawnId].pos]);
  for (let i = 0; i < n; i++) { const nx = new Set(); cur.forEach((p) => neighbors(p).forEach((q) => nx.add(q))); cur = nx; }
  const ok = [...cur].filter((p) => { const o = pawnAt(s, p); return !o || o.id === pawnId; });
  return ok.length ? ok : [s.pawns[pawnId].pos];             // boxed in by other pawns: it stays put
}

// What Tyndale's cards say about a location (two cards): where he is, and what he has left there.
export function answerAt(s, pos, asSupporter) {
  const t = s.t;
  let loc;
  if (!asSupporter) loc = t.pos === pos ? 'here' : 'not';
  else loc = t.pos === pos ? 'here' : dist(t.pos, pos) <= NEAR ? 'near' : 'far';
  let bible;
  if (t.marks[pos]) bible = t.marks[pos];
  else if (neighbors(pos).some((n) => t.marks[n])) bible = 'rumors';
  else bible = 'nothing';
  return { loc, bible };
}

// The next pawn that has not moved this round (seats in order, then their pawns), or null when the Agents are done.
export function nextActor(s) {
  for (const seat of s.seats) {
    if (seat.out) continue;
    const p = s.pawns.find((x) => x.seat === seat.id && !x.out && !s.moved.includes(x.id));
    if (p) return { seat: seat.id, pawnId: p.id };
  }
  return null;
}
export function rollFor(state, pawnId) {
  if (state.phase !== 'agents') throw new Error('not the Agents\' turn');
  if (state.pending) return state;
  const s = clone(state);
  s.pending = { pawnId, roll: rollDie(s) };
  return s;
}

export function agentMove(state, pawnId, roll, pos, opts = {}) {
  if (state.phase !== 'agents') throw new Error('not the Agents\' turn');
  if (!pawnTargets(state, pawnId, roll).includes(pos)) throw new Error('illegal move');
  const s = clone(state), pawn = s.pawns[pawnId];
  pawn.pos = pos; s.pending = null; s.moved.push(pawnId);
  const sup = isSupporterPawn(s, pawnId);
  const ans = answerAt(s, pos, sup);
  const rec = { loc: ans.loc, bible: ans.bible, round: s.round, by: pawn.seat };
  const result = { pawnId, pos, ...ans, captured: false };
  if (!sup && ans.loc === 'here') { note(s, `${s.seats[pawn.seat].name} has captured "that notorious heretic Tyndale"!`); return Object.assign(finish(s, 'agents', 'captured'), { result }); }
  // what is shared: everyone's findings go into the pool, except the Secret Supporter's, which are private unless they choose to share
  const share = sup ? (opts.share ? !!opts.share(ans) : false) : true;
  if (share && sup) rec.loc = 'not';                         // the Supporter only ever says "Nothing to Report": near/far stays private
  if (share) { s.found[pos] = rec; s.obs.push({ round: s.round, pos, loc: rec.loc, bible: ans.bible }); } else { s.private[pos] = rec; s.pobs.push({ round: s.round, pos, loc: ans.loc, bible: ans.bible }); }
  const rp = s.reports[pawn.seat] || (s.reports[pawn.seat] = { n: 0, nothing: 0 });
  rp.n += 1; if (!share || ans.bible === 'nothing') rp.nothing += 1;   // withholding is reported as "Nothing to Report" 
  // the Secret Supporter picks up a publication that has not reached London, and ships it from the next Coastal City
  if (sup) {
    const letter = ans.bible && PUBS.includes(ans.bible) ? ans.bible : null;
    if (letter && !s.delivered.some((d) => d.pub === letter)) s.carry[pawnId] = letter;
    const c = s.carry[pawnId];
    if (c && isCoastal(pos) && PUBS.indexOf(c) > s.t.shipped) {
      s.t.shipped = PUBS.indexOf(c);
      const d = pt[pos].coast;
      s.shipments.push({ pub: c, from: pos, dist: d, left: d, fresh: false, by: pawn.seat });
      note(s, `Tyndale's shipment of ${PUB_NAMES[c]} is on its way (carried to ${pos}).`, false);
      if (s.t.translated < 3) s.t.translated = s.t.shipped + 1;
      delete s.carry[pawnId];
    }
  }
  return Object.assign(s, { lastResult: result });
}

// Advance to the next player's turn / the next round. Called by the app after a seat has moved all its pawns.
export function endAgentTurns(state) {
  if (state.phase !== 'agents') throw new Error('not the Agents\' turn');
  const s = clone(state);
  s.round += 1; s.phase = 'tyndale'; s.moved = []; s.pending = null;
  return s;
}

// ---- accusing the Secret Supporter ------------------------------------------------------------------------------------------
// votes: {seatId: true/false} from every Agent player still in the game. A majority charges the accused.
export function accuse(state, accuser, accused, votes) {
  if (!state.accusation || !state.accusation.open) throw new Error('no accusation can be made now');
  const s = clone(state), seats = s.seats.filter((x) => !x.out);
  const yes = seats.filter((x) => votes[x.id]).length;
  s.accusation = { ...s.accusation, open: false };
  const charged = yes * 2 > seats.length;
  const res = { charged, yes, of: seats.length, supporter: false, out: null };
  note(s, `${s.seats[accuser].name} accuses ${s.seats[accused].name} of being the Secret Supporter. ${charged ? 'The Agents vote to charge them.' : 'The vote fails.'}`);
  if (charged) {
    const out = s.supporter === accused ? accused : accuser;
    res.supporter = s.supporter === accused; res.out = out;
    s.seats[out].out = true; s.pawns.filter((p) => p.seat === out).forEach((p) => { p.out = true; delete s.carry[p.id]; });
    note(s, res.supporter ? `${s.seats[out].name} was the Secret Supporter and is out of the game!` : `${s.seats[out].name} was not the Secret Supporter and is out of the game.`);
    if (!s.seats.some((x) => !x.out && x.id !== s.supporter)) return Object.assign(finish(s, 'tyndale', 'no-hunters'), { accusationResult: res });
  }
  return Object.assign(s, { accusationResult: res });
}
export function logPublic(state, text) { const s = clone(state); note(s, text, true); return s; }
export const closeAccusation = (state) => { const s = clone(state); if (s.accusation) s.accusation.open = false; return s; };

function finish(s, winner, reason) {
  s.over = true; s.phase = 'over'; s.winner = winner; s.endReason = reason;
  return s;
}

// ---- results -----------------------------------------------------------------------------------------------------------------
export function summary(s) {
  return {
    winner: s.winner, reason: s.endReason, turns: s.round,
    delivered: s.delivered.map((d) => ({ ...d, name: PUB_NAMES[d.pub] })),
    shippedNotArrived: s.shipments.filter((x) => !x.arrived).map((x) => ({ pub: x.pub, name: PUB_NAMES[x.pub], left: x.left })),
    undelivered: PUBS.filter((p) => !s.delivered.some((d) => d.pub === p)).map((p) => PUB_NAMES[p]),
    trail: s.t.trail,
  };
}
