// Journeys for Paul - game session state machine (solo, pass-and-play and in-person 'table' play).
// State is plain JSON; every transition returns a new state, which makes undo and
// saving to localStorage trivial.

import {
  MODES, RULESETS, EVANGELISTS, EV_NAMES, newSheet, clone, rollDie, options,
  anyOption, applyMove, applyPreach, maxActions, gameOver, allCalled, score, edge, city,
} from './engine.js';

export const BOT_NAMES = ['Barnabas', 'Timothy', 'Priscilla'];

// kind 'solo' : one human plus `bots` simulated opponents who only roll the die.
// kind 'pass' : `names.length` humans sharing one device.
// kind 'table': an in-person game where every player has their own phone. This device holds only
//               ONE sheet (seat `me`); the other players' rolls are announced out loud and entered
//               with announceRoll(), exactly like calling out the die in the physical game.
export function newGame({ kind, rulesId, names, bots = 1, me = 0 }) {
  const humans = kind === 'solo' ? [names[0] || 'You'] : kind === 'table' ? [names[me]] : names;
  const seats = kind === 'solo' ? 1 + bots : names.length;
  return {
    v: 1,
    kind,
    rulesId,
    names: humans,
    seatNames: kind === 'solo' ? [humans[0], ...BOT_NAMES.slice(0, bots)] : kind === 'table' ? names : humans,
    seats,
    mySeat: kind === 'table' ? me : 0,
    sheets: humans.map(() => newSheet()),
    round: 1,
    roller: 0,
    phase: 'roll', // roll | choose | act | over
    face: null,
    mode: null,
    queue: [],
    actor: null,
    role: null,
    acted: [],
    actions: 0,
    log: [],
    lastPreach: null, // {seat, ev, cityId, called, n} - drives the Scripture panel
  };
}

export const rules = (s) => RULESETS[s.rulesId];
// seats whose moves are made on this device
export const isHumanSeat = (s, seat) => (s.kind === 'table' ? seat === s.mySeat : seat < s.sheets.length);
// index into s.sheets for a human seat (a table game keeps just this player's sheet)
const idx = (s, seat) => (s.kind === 'table' ? 0 : seat);
export const sheetOf = (s, seat = s.actor) => s.sheets[idx(s, seat)];

// tag the action just recorded with the round it happened in
function stamp(s) {
  const h = s.sheets[idx(s, s.actor)].history;
  h[h.length - 1].round = s.round;
}

function push(s, text) {
  s.log.push({ round: s.round, text });
  if (s.log.length > 200) s.log.shift();
}

// Seats that will act on this roll, in table order starting with the roller.
function actingQueue(s) {
  const q = [];
  for (let i = 0; i < s.seats; i++) {
    const seat = (s.roller + i) % s.seats;
    if (isHumanSeat(s, seat)) q.push(seat);
  }
  return q;
}

function beginActing(s, mode) {
  s.mode = mode;
  s.queue = actingQueue(s);
  startActor(s);
}

function startActor(s) {
  s.actor = s.queue.shift();
  s.role = s.actor === s.roller ? 'roller' : 'other';
  s.acted = [];
  s.actions = 0;
  s.phase = 'act';
}

// The current roller rolls the die. A human who rolls "Player's Choice" gets to
// pick a mode next; a simulated opponent just picks one at random.
export function roll(state, rng = Math.random) {
  if (state.phase !== 'roll') throw new Error('not time to roll');
  if (state.kind === 'table' && state.roller !== state.mySeat) throw new Error("it is another player's roll");
  const s = clone(state);
  s.lastPreach = null;
  s.face = rollDie(rng);
  const who = s.seatNames[s.roller];
  if (s.face === 'choice') {
    if (isHumanSeat(s, s.roller)) {
      s.phase = 'choose';
      push(s, `${who} rolled Player's Choice.`);
      return s;
    }
    const mode = MODES[Math.floor(rng() * MODES.length)];
    push(s, `${who} rolled Player's Choice and picked ${mode}.`);
    beginActing(s, mode);
    return s;
  }
  push(s, `${who} rolled ${s.face}.`);
  beginActing(s, s.face);
  return s;
}

// Table play: another player rolled (or chose, after Player's Choice) and announced `mode`.
export function announceRoll(state, mode, face = mode) {
  if (state.kind !== 'table' || state.phase !== 'roll' || state.roller === state.mySeat) throw new Error('nothing to announce now');
  if (!MODES.includes(mode)) throw new Error('unknown way to travel');
  const s = clone(state);
  s.lastPreach = null;
  s.face = face;
  push(s, face === 'choice' ? `${s.seatNames[s.roller]} chose ${mode}.` : `${s.seatNames[s.roller]} rolled ${mode}.`);
  beginActing(s, mode);
  return s;
}

// Table play: the table disagrees about whose roll it is (a missed tap) - put this device right.
export function setRoller(state, seat) {
  if (state.kind !== 'table' || state.phase !== 'roll') throw new Error('cannot change the roller now');
  if (!Number.isInteger(seat) || seat < 0 || seat >= state.seats) throw new Error('no such player');
  const s = clone(state);
  s.roller = seat;
  return s;
}

// Table play: this device cannot know what the others' sheets look like, so the table ends the game
// by agreement ("someone has all three called" / "nobody can move") and each phone is told.
export function finishNow(state) {
  if (state.kind !== 'table' || state.phase === 'over') throw new Error('cannot end the game');
  const s = clone(state);
  s.phase = 'over'; s.actor = null; s.role = null; s.face = null; s.mode = null; s.queue = [];
  push(s, 'The table ended the game.');
  return s;
}

export function chooseMode(state, mode) {
  if (state.phase !== 'choose' || !MODES.includes(mode)) throw new Error('cannot choose a mode now');
  const s = clone(state);
  push(s, `${s.seatNames[s.roller]} chose ${mode}.`);
  beginActing(s, mode);
  return s;
}

export function evOptions(state, evId) {
  if (state.phase !== 'act') return { moves: [], preach: false };
  if (state.acted.includes(evId) || state.actions >= maxActions(state.role)) return { moves: [], preach: false };
  return options(sheetOf(state), evId, state.mode, state.role, rules(state));
}

// Nothing left that this actor is allowed to do on this roll.
export function nothingToDo(state) {
  if (state.actions >= maxActions(state.role)) return true;
  return !anyOption(sheetOf(state), state.mode, state.role, rules(state), state.acted);
}

// May the actor end their turn now? (Not before acting, unless they truly cannot.)
export function canEndTurn(state) {
  return state.phase === 'act' && (state.actions > 0 || nothingToDo(state));
}

export function move(state, evId, edgeId) {
  const opt = evOptions(state, evId);
  if (!opt.moves.some((m) => m.edge === edgeId)) throw new Error('illegal move');
  const s = clone(state);
  const from = city(sheetOf(s).evangelists[evId].city).name;
  s.sheets[idx(s, s.actor)] = applyMove(s.sheets[idx(s, s.actor)], evId, edgeId);
  stamp(s);
  const to = city(s.sheets[idx(s, s.actor)].evangelists[evId].city).name;
  s.acted.push(evId);
  s.actions += 1;
  push(s, `${s.seatNames[s.actor]}: ${EV_NAMES[evId]} travels ${from} → ${to}.`);
  return s;
}

export function preach(state, evId) {
  if (!evOptions(state, evId).preach) throw new Error('illegal preach');
  const s = clone(state);
  const at = city(sheetOf(s).evangelists[evId].city).name;
  const r = applyPreach(s.sheets[idx(s, s.actor)], evId, rules(s));
  s.sheets[idx(s, s.actor)] = r.sheet;
  stamp(s);
  s.lastPreach = { seat: s.actor, ev: evId, cityId: city(r.sheet.evangelists[evId].city).id, called: r.called, n: (s.lastPreach?.n ?? 0) + 1 };
  s.acted.push(evId);
  s.actions += 1;
  push(s, r.called
    ? `${s.seatNames[s.actor]}: ${EV_NAMES[evId]} is CALLED as pastor in ${at}!`
    : `${s.seatNames[s.actor]}: ${EV_NAMES[evId]} preaches in ${at}.`);
  return s;
}

export function endTurn(state) {
  if (!canEndTurn(state)) throw new Error('cannot end turn yet');
  const s = clone(state);
  if (s.actions === 0) push(s, `${s.seatNames[s.actor]} passes.`);
  s.lastPreach = null;
  if (s.queue.length) {
    startActor(s);
    return s;
  }
  // everyone has acted on this roll
  s.actor = null;
  s.role = null;
  s.face = null;
  s.mode = null;
  // a table device only sees its own sheet: it can end the game when this player has all three called;
  // "nobody can move" is for the table to call (finishNow)
  if (s.kind === 'table' ? allCalled(s.sheets[0]) : gameOver(s.sheets)) {
    s.phase = 'over';
    push(s, 'The journeys are complete.');
    return s;
  }
  s.roller = (s.roller + 1) % s.seats;
  if (s.roller === 0) s.round += 1;
  s.phase = 'roll';
  return s;
}

export function results(state) {
  return state.sheets.map((sheet, i) => ({ name: state.names[i], sheet, ...score(sheet) }))
    .sort((a, b) => b.total - a.total);
}

export { EVANGELISTS, EV_NAMES, edge };
