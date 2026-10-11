// Journeys for Paul - game session state machine (solo and pass-and-play).
// State is plain JSON; every transition returns a new state, which makes undo and
// saving to localStorage trivial.

import {
  MODES, RULESETS, EVANGELISTS, EV_NAMES, newSheet, clone, rollDie, options,
  anyOption, applyMove, applyPreach, maxActions, gameOver, score, edge, city,
} from './engine.js';

export const BOT_NAMES = ['Barnabas', 'Timothy', 'Priscilla'];

// kind 'solo': one human plus `bots` simulated opponents who only roll the die.
// kind 'pass': `names.length` humans sharing one device.
export function newGame({ kind, rulesId, names, bots = 1 }) {
  const humans = kind === 'solo' ? [names[0] || 'You'] : names;
  const seats = kind === 'solo' ? 1 + bots : humans.length;
  return {
    v: 1,
    kind,
    rulesId,
    names: humans,
    seatNames: kind === 'solo' ? [humans[0], ...BOT_NAMES.slice(0, bots)] : humans,
    seats,
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
  };
}

export const rules = (s) => RULESETS[s.rulesId];
export const isHumanSeat = (s, seat) => seat < s.sheets.length;
export const sheetOf = (s, seat = s.actor) => s.sheets[seat];

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
  const s = clone(state);
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
  s.sheets[s.actor] = applyMove(s.sheets[s.actor], evId, edgeId);
  const to = city(s.sheets[s.actor].evangelists[evId].city).name;
  s.acted.push(evId);
  s.actions += 1;
  push(s, `${s.seatNames[s.actor]}: ${EV_NAMES[evId]} travels ${from} → ${to}.`);
  return s;
}

export function preach(state, evId) {
  if (!evOptions(state, evId).preach) throw new Error('illegal preach');
  const s = clone(state);
  const at = city(sheetOf(s).evangelists[evId].city).name;
  const r = applyPreach(s.sheets[s.actor], evId, rules(s));
  s.sheets[s.actor] = r.sheet;
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
  if (s.queue.length) {
    startActor(s);
    return s;
  }
  // everyone has acted on this roll
  s.actor = null;
  s.role = null;
  s.face = null;
  s.mode = null;
  if (gameOver(s.sheets)) {
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
