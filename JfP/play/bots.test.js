import test from 'node:test';
import assert from 'node:assert/strict';
import MAP from './js/map-data.js';
import {
  EVANGELISTS, MODES, RULESETS, newSheet, applyMove, applyPreach, options, gameOver, score, rollDie, sheetAt, maxActions,
} from './js/engine.js';
import { planTurn, chooseModeFor, BOT_LEVELS } from './js/bot.js';
import {
  newGame, roll, chooseMode, move, preach, endTurn, canEndTurn, evOptions, results, isBotSeat, BOT_NAMES,
} from './js/game.js';

const ROAD = () => 0.0, CHOICE = () => 0.9;
function lcg(seed) {
  let s = seed >>> 0;
  return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 2 ** 32);
}
const apply = (sheet, a, rules) => (a.type === 'move' ? applyMove(sheet, a.ev, a.edge) : applyPreach(sheet, a.ev, rules).sheet);

// a whole game between bots only (no humans), for checking play quality
function playBots(levels, rulesId, rng) {
  const rules = RULESETS[rulesId];
  let sheets = levels.map(() => newSheet());
  let roller = 0, rolls = 0;
  while (!gameOver(sheets) && rolls < 600) {
    let mode = rollDie(rng);
    if (mode === 'choice') mode = chooseModeFor(sheets[roller], 'roller', rules, levels[roller], rng);
    sheets = sheets.map((sh, i) => {
      const role = i === roller ? 'roller' : 'other';
      const { actions } = planTurn(sh, mode, role, rules, levels[i], rng);
      return actions.reduce((s, a) => apply(s, a, rules), sh);
    });
    roller = (roller + 1) % levels.length;
    rolls++;
  }
  return { rolls, sheets, scores: sheets.map((s) => score(s).total) };
}

test('every bot plan is legal: right count, distinct evangelists, ruleset respected', () => {
  for (const level of Object.keys(BOT_LEVELS)) {
    for (const rulesId of ['fast', 'long']) {
      const rules = RULESETS[rulesId];
      const rng = lcg(level.length * 31 + rulesId.length);
      let sheet = newSheet();
      for (let step = 0; step < 150; step++) {
        const mode = MODES[Math.floor(rng() * 3)];
        const role = rng() < 0.4 ? 'roller' : 'other';
        const { actions } = planTurn(sheet, mode, role, rules, level, rng);
        assert.ok(actions.length <= maxActions(role));
        assert.equal(new Set(actions.map((a) => a.ev)).size, actions.length, 'one action per evangelist');
        let s = sheet;
        for (const a of actions) {
          const o = options(s, a.ev, mode, role, rules);                 // legal when it is played
          if (a.type === 'move') assert.ok(o.moves.some((m) => m.edge === a.edge), 'illegal move');
          else assert.ok(o.preach, 'illegal preach');
          if (a.type === 'preach' && role === 'other') assert.ok(rules.nonRollerMayPreach, 'non-roller preached in the long game');
          s = apply(s, a, rules);
        }
        sheet = s;
      }
    }
  }
});

test("a bot never makes a pointless call while an evangelist can still travel (any level)", () => {
  const rules = RULESETS.fast;
  for (const level of Object.keys(BOT_LEVELS)) {
    const rng = lcg(7);
    let s = newSheet();
    s = applyPreach(s, 'titus', rules).sheet;                 // Titus has preached on Crete: the next preach would call him
    for (let i = 0; i < 200; i++) {
      const { actions } = planTurn(s, 'road', 'roller', rules, level, rng);   // road: Titus is stuck on Crete
      assert.ok(!actions.some((a) => a.ev === 'titus' && a.type === 'preach'), `${level} called Titus early`);
    }
  }
});

test('an evangelist who can never travel again is called (the call is worth +5)', () => {
  const rules = RULESETS.fast;
  let s = newSheet();
  s.used.titus = MAP.edges.map((e) => e.id);                // Titus has nowhere left to go
  s = applyPreach(s, 'titus', rules).sheet;                 // already preached once
  const { actions } = planTurn(s, 'road', 'roller', rules, 'sharp', lcg(3));
  assert.ok(actions.some((a) => a.ev === 'titus' && a.type === 'preach'));
});

test('Player\'s Choice: a bot picks a legal mode that lets it do something', () => {
  const rules = RULESETS.fast;
  const sheet = newSheet();
  for (const level of Object.keys(BOT_LEVELS)) {
    const mode = chooseModeFor(sheet, 'roller', rules, level, lcg(11));
    assert.ok(MODES.includes(mode));
  }
  // Sharp avoids the useless mode for a sheet where footpaths lead nowhere for anyone
  const s = newSheet();
  for (const ev of EVANGELISTS) s.used[ev] = MAP.edges.filter((e) => e.mode === 'foot').map((e) => e.id);
  assert.notEqual(chooseModeFor(s, 'other', rules, 'sharp', lcg(5)), 'foot');
});

test('skill levels are ordered: a sharp bot beats a steady one, which beats a casual one', () => {
  for (const rulesId of ['fast', 'long']) {
    const wins = { casual: 0, steady: 0, sharp: 0 };
    const total = { casual: 0, steady: 0, sharp: 0 };
    const N = 90;
    for (let i = 1; i <= N; i++) {
      const order = [['casual', 'steady', 'sharp'], ['steady', 'sharp', 'casual'], ['sharp', 'casual', 'steady']][i % 3];
      const r = playBots(order, rulesId, lcg(i * 7919));
      const best = Math.max(...r.scores);
      r.scores.forEach((x, k) => { total[order[k]] += x; if (x === best) wins[order[k]]++; });
    }
    assert.ok(wins.sharp > wins.steady && wins.steady > wins.casual - 5, `${rulesId} wins ${JSON.stringify(wins)}`);
    assert.ok(total.sharp > total.steady && total.steady > total.casual, `${rulesId} totals ${JSON.stringify(total)}`);
  }
});

test('bot games are sensible lengths and finish', () => {
  for (const rulesId of ['fast', 'long']) {
    const r = playBots(['steady', 'steady', 'steady'], rulesId, lcg(42));
    assert.ok(r.rolls > 15 && r.rolls < 600, `${rulesId}: ${r.rolls} rolls`);
  }
});

// ---- bots inside a solo game --------------------------------------------------

test('solo with bots: each bot keeps its own sheet and plays every roll', () => {
  let g = newGame({ kind: 'solo', rulesId: 'fast', names: ['Me'], bots: 2 });
  assert.equal(g.sheets.length, 3);
  assert.equal(g.seats, 3);
  assert.deepEqual(g.seatNames, ['Me', ...BOT_NAMES.slice(0, 2)]);
  assert.deepEqual(g.names, g.seatNames);
  assert.ok(isBotSeat(g, 1) && isBotSeat(g, 2) && !isBotSeat(g, 0));
  g = roll(g, ROAD);                                          // my roll: bots act on it too
  assert.equal(g.role, 'roller');
  assert.ok(g.sheets[1].history.length > 0 && g.sheets[2].history.length > 0, 'bots moved');
  assert.equal(g.sheets[0].history.length, 0, 'but not on my sheet');
  assert.deepEqual(Object.keys(g.lastBot).sort(), ['1', '2']);
  assert.ok(g.log.some((l) => l.text.startsWith(`${BOT_NAMES[0]}:`)));
  g = move(g, 'luke', 'road:Neapolis~Philippi');
  g = endTurn(g);
  assert.equal(g.roller, 1);
  assert.equal(g.phase, 'roll');
});

test('a bot who rolls: the die is rolled for it and it plays as the roller (up to 3 actions)', () => {
  let g = newGame({ kind: 'solo', rulesId: 'fast', names: ['Me'], bots: 1 });
  g = roll(g, ROAD); g = move(g, 'luke', 'road:Neapolis~Philippi'); g = endTurn(g);   // my turn done
  assert.equal(g.roller, 1);
  const before = g.sheets[1].history.length;
  g = roll(g, ROAD);                                          // Barnabas rolls
  assert.equal(g.role, 'other');                              // I act as a non-roller
  const made = g.sheets[1].history.length - before;
  assert.ok(made >= 1 && made <= 3, `bot made ${made} actions as roller`);
});

test("a bot's Player's Choice is made by the bot", () => {
  let g = newGame({ kind: 'solo', rulesId: 'fast', names: ['Me'], bots: 1 });
  g = roll(g, ROAD); g = move(g, 'luke', 'road:Neapolis~Philippi'); g = endTurn(g);
  g = roll(g, CHOICE);                                        // Barnabas rolls Player's Choice
  assert.equal(g.phase, 'act');                               // no waiting for me to choose
  assert.ok(MODES.includes(g.mode));
  assert.match(g.log.find((l) => /Player's Choice and picked/.test(l.text)).text, new RegExp(BOT_NAMES[0]));
});

test('standings: everyone is ranked, I am flagged, and the replay of each bot sheet matches', () => {
  const rng = lcg(5);
  let g = newGame({ kind: 'solo', rulesId: 'long', names: ['Me'], bots: 3, botLevel: 'sharp' });
  for (let guard = 0; g.phase !== 'over'; guard++) {
    assert.ok(guard < 20000);
    if (g.phase === 'roll') { g = roll(g, rng); continue; }
    if (g.phase === 'choose') { g = chooseMode(g, MODES[Math.floor(rng() * 3)], rng); continue; }
    const acts = [];
    for (const ev of EVANGELISTS) {
      const o = evOptions(g, ev);
      o.moves.forEach((m) => acts.push(() => move(g, ev, m.edge)));
      if (o.preach) acts.push(() => preach(g, ev));
    }
    g = canEndTurn(g) && (!acts.length || rng() < 0.3) ? endTurn(g) : acts[Math.floor(rng() * acts.length)]();
  }
  const res = results(g);
  assert.equal(res.length, 4);
  assert.equal(res.filter((r) => r.mine).length, 1);
  assert.equal(res.filter((r) => r.bot).length, 3);
  for (let i = 1; i < res.length; i++) assert.ok(res[i - 1].total >= res[i].total);
  for (const sheet of g.sheets) {
    const rebuilt = sheetAt(sheet.history, sheet.history.length, RULESETS.long);
    assert.deepEqual(rebuilt.evangelists, sheet.evangelists);
  }
});

test('randomised solo games with bots always finish, whatever the level, rules and table size', () => {
  for (const level of Object.keys(BOT_LEVELS)) {
    for (const rulesId of ['fast', 'long']) {
      for (let bots = 0; bots <= 3; bots++) {
        const rng = lcg(level.length * 101 + bots * 13 + rulesId.length);
        let g = newGame({ kind: 'solo', rulesId, names: ['Me'], bots, botLevel: level });
        for (let guard = 0; g.phase !== 'over'; guard++) {
          assert.ok(guard < 20000, `${level}/${rulesId}/${bots} did not finish`);
          if (g.phase === 'roll') { g = roll(g, rng); continue; }
          if (g.phase === 'choose') { g = chooseMode(g, MODES[Math.floor(rng() * 3)], rng); continue; }
          const acts = [];
          for (const ev of EVANGELISTS) {
            const o = evOptions(g, ev);
            o.moves.forEach((m) => acts.push(() => move(g, ev, m.edge)));
            if (o.preach) acts.push(() => preach(g, ev));
          }
          g = canEndTurn(g) && (!acts.length || rng() < 0.3) ? endTurn(g) : acts[Math.floor(rng() * acts.length)]();
        }
        assert.equal(results(g).length, 1 + bots);
      }
    }
  }
});

test('games saved before bots existed (no bot sheets) still play', () => {
  let g = newGame({ kind: 'solo', rulesId: 'fast', names: ['Me'], bots: 2 });
  g = { ...g, sheets: [g.sheets[0]], names: ['Me'], lastBot: undefined, botLevel: undefined };   // how an old save looks
  assert.equal(isBotSeat(g, 1), false);
  g = roll(g, ROAD);
  g = move(g, 'luke', 'road:Neapolis~Philippi');
  g = endTurn(g);                                             // seat 1 is a roller with no sheet: just rolls
  g = roll(g, ROAD);
  assert.equal(g.role, 'other');
  assert.equal(results(g).length, 1);
});

test('the same seed gives the same bot game', () => {
  const a = playBots(['steady', 'sharp', 'casual'], 'fast', lcg(99));
  const b = playBots(['steady', 'sharp', 'casual'], 'fast', lcg(99));
  assert.deepEqual(a.scores, b.scores);
  assert.equal(a.rolls, b.rolls);
});
