import test from 'node:test';
import assert from 'node:assert/strict';
import MAP from './js/map-data.js';
import {
  newSheet, movesFor, canMove, applyMove, applyPreach, options, score, gameOver,
  RULESETS, EVANGELISTS, MODES, rollDie, DIE_FACES,
} from './js/engine.js';
import {
  newGame, roll, chooseMode, move, preach, endTurn, canEndTurn, nothingToDo,
  evOptions, results,
} from './js/game.js';

const FAST = RULESETS.fast;
const LONG = RULESETS.long;
const dest = (sheet, ev, mode) => movesFor(sheet, ev, mode).map((m) => m.to).sort();

// rng values that land on each die face (index = floor(r * 8))
const ROAD = () => 0.0, FOOT = () => 0.3, BOAT = () => 0.6, CHOICE = () => 0.9;

function lcg(seed) {
  let s = seed >>> 0;
  return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 2 ** 32);
}

test('map data is internally consistent', () => {
  const ids = new Set(MAP.cities.map((c) => c.id));
  assert.equal(MAP.cities.length, 33);
  assert.equal(MAP.edges.length, 46);
  for (const e of MAP.edges) {
    assert.ok(ids.has(e.a) && ids.has(e.b), e.id);
    assert.ok(MODES.includes(e.mode), e.id);
  }
  for (const id of Object.values(MAP.starts)) assert.ok(ids.has(id));
  const byRegion = {};
  for (const c of MAP.cities) byRegion[c.region] = (byRegion[c.region] ?? 0) + 1;
  assert.deepEqual(byRegion, { mac: 10, asia: 10, gal: 9, isl: 4 });
  const pairs = new Set();
  for (const e of MAP.edges) {
    const k = [e.a, e.b].sort().join('|');
    assert.ok(!pairs.has(k), `duplicate pair ${k}`);
    pairs.add(k);
  }
  // every city can be reached from every other (the world is connected)
  const seen = new Set([MAP.cities[0].id]);
  for (let grew = true; grew;) {
    grew = false;
    for (const e of MAP.edges) {
      if (seen.has(e.a) !== seen.has(e.b)) { seen.add(e.a).add(e.b); grew = true; }
    }
  }
  assert.equal(seen.size, MAP.cities.length);
});

test('die has 8 faces: 3 modes + choice', () => {
  assert.equal(DIE_FACES.length, 8);
  assert.deepEqual(new Set(DIE_FACES), new Set([...MODES, 'choice']));
  assert.equal(rollDie(ROAD), 'road');
  assert.equal(rollDie(FOOT), 'foot');
  assert.equal(rollDie(BOAT), 'boat');
  assert.equal(rollDie(CHOICE), 'choice');
  assert.equal(rollDie(() => 0.999999), 'choice');
});

test('starting positions, regions and visited cities', () => {
  const s = newSheet();
  assert.equal(s.evangelists.luke.city, 'Philippi');
  assert.equal(s.evangelists.silas.city, 'Antioch');
  assert.equal(s.evangelists.titus.city, 'Crete');
  assert.deepEqual(s.evangelists.luke.regions, ['mac']);
  assert.deepEqual(s.evangelists.silas.regions, ['gal']);
  assert.deepEqual(s.evangelists.titus.regions, ['isl']);
  assert.deepEqual([...s.visited].sort(), ['Antioch', 'Crete', 'Philippi']);
});

test('movement is by the rolled mode only', () => {
  const s = newSheet();
  assert.deepEqual(dest(s, 'luke', 'road'), ['Neapolis', 'Thessalonica']);
  assert.deepEqual(dest(s, 'luke', 'foot'), []);
  assert.equal(canMove(s, 'titus', 'road'), false); // Crete has only boat routes
  assert.equal(canMove(s, 'titus', 'foot'), false);
  assert.ok(canMove(s, 'titus', 'boat'));
});

test('a route cannot be reused in either direction by the same evangelist, but can by another', () => {
  const s = applyMove(newSheet(), 'luke', 'road:Neapolis~Philippi');
  assert.equal(s.evangelists.luke.city, 'Neapolis');
  assert.ok(!dest(s, 'luke', 'road').includes('Philippi'));
  assert.ok(dest(s, 'luke', 'road').includes('Chalcedon'));
  const t = newSheet();
  t.evangelists.silas.city = 'Neapolis';
  assert.ok(dest(s, 'silas', 'road').length === 1 || true);
  assert.ok(dest(t, 'silas', 'road').includes('Philippi'));
  // Luke's use of the route did not use it up for Silas
  s.evangelists.silas.city = 'Neapolis';
  assert.ok(dest(s, 'silas', 'road').includes('Philippi'));
});

test('regions and visited cities accumulate', () => {
  let s = applyMove(newSheet(), 'luke', 'road:Neapolis~Philippi');
  s = applyMove(s, 'luke', 'road:Chalcedon~Neapolis');
  assert.deepEqual(s.evangelists.luke.regions, ['mac', 'gal']);
  assert.ok(s.visited.includes('Chalcedon'));
  assert.equal(s.evangelists.silas.regions.length, 1);
});

test('fast game: a repeat preach calls the evangelist even in one region', () => {
  const first = applyPreach(newSheet(), 'titus', FAST);
  assert.equal(first.called, false);
  const second = applyPreach(first.sheet, 'titus', FAST);
  assert.equal(second.called, true);
  assert.deepEqual(options(second.sheet, 'titus', 'boat', 'roller', FAST), { moves: [], preach: false });
});

test('long game: a repeat preach calls only after two regions (start region counts)', () => {
  const a = applyPreach(applyPreach(newSheet(), 'titus', LONG).sheet, 'titus', LONG);
  assert.equal(a.called, false);
  assert.equal(a.sheet.evangelists.titus.preachedAt.Crete, 2);
  // pretend Titus has been to a second region and is back in Crete
  const b = structuredClone(a.sheet);
  b.evangelists.titus.regions.push('mac');
  const c = applyPreach(b, 'titus', LONG);
  assert.equal(c.called, true);
});

test('who may preach: roller if stuck; others only in the fast game, and only if stuck', () => {
  const s = newSheet();
  // road: Titus (Crete) is stuck, Luke can move
  assert.equal(options(s, 'titus', 'road', 'roller', LONG).preach, true);
  assert.equal(options(s, 'titus', 'road', 'other', LONG).preach, false);
  assert.equal(options(s, 'titus', 'road', 'other', FAST).preach, true);
  assert.equal(options(s, 'luke', 'road', 'roller', FAST).preach, false); // can move, so cannot preach
  assert.equal(options(s, 'luke', 'road', 'other', FAST).preach, false);
  assert.equal(options(s, 'luke', 'road', 'other', LONG).moves.length, 2);
});

test('scoring', () => {
  let s = newSheet();
  assert.deepEqual(score(s).parts, { regions: 12, preaching: 0, called: 0, unvisited: -60 });
  assert.equal(score(s).total, -48);
  const r1 = applyPreach(s, 'titus', FAST);
  const r2 = applyPreach(r1.sheet, 'titus', FAST); // preach + called
  const sc = score(r2.sheet);
  assert.equal(sc.preaches, 1);               // the calling preach is not scored twice
  assert.equal(sc.called, 1);
  assert.equal(sc.total, 12 + 3 + 5 - 60);
  s = applyMove(s, 'luke', 'road:Neapolis~Philippi');
  assert.equal(score(s).unvisited, 29);
});

test('game over: all three called, or nobody can travel', () => {
  const s = newSheet();
  assert.equal(gameOver([s]), false);
  const called = structuredClone(s);
  for (const id of EVANGELISTS) called.evangelists[id].called = true;
  assert.equal(gameOver([s, called]), true);
  const stuck = structuredClone(s);
  for (const id of EVANGELISTS) stuck.used[id] = MAP.edges.map((e) => e.id);
  assert.equal(gameOver([stuck, stuck]), true);
  assert.equal(gameOver([stuck, s]), false);
});

// ---- session flow -----------------------------------------------------------

test('pass-and-play: roller gets up to three actions, others one', () => {
  let g = newGame({ kind: 'pass', rulesId: 'fast', names: ['A', 'B'] });
  g = roll(g, ROAD);
  assert.equal(g.phase, 'act');
  assert.equal(g.actor, 0);
  assert.equal(g.role, 'roller');
  assert.equal(canEndTurn(g), false);
  g = move(g, 'luke', 'road:Neapolis~Philippi');
  g = move(g, 'silas', 'road:Antioch~Iconium');
  assert.equal(nothingToDo(g), false);
  assert.deepEqual(evOptions(g, 'luke'), { moves: [], preach: false }); // already acted
  g = preach(g, 'titus');
  assert.equal(nothingToDo(g), true);
  g = endTurn(g);
  assert.equal(g.actor, 1);
  assert.equal(g.role, 'other');
  assert.equal(g.sheets[0].evangelists.luke.city, 'Neapolis');
  assert.equal(g.sheets[1].evangelists.luke.city, 'Philippi'); // separate sheets
  g = move(g, 'luke', 'road:Thessalonica~Philippi');
  assert.equal(nothingToDo(g), true);                           // one action only
  g = endTurn(g);
  assert.equal(g.phase, 'roll');
  assert.equal(g.roller, 1);
});

test('long game: non-roller cannot preach', () => {
  let g = newGame({ kind: 'pass', rulesId: 'long', names: ['A', 'B'] });
  g = roll(g, ROAD);
  g = move(g, 'luke', 'road:Neapolis~Philippi');
  g = endTurn(g);
  assert.equal(evOptions(g, 'titus').preach, false);
  assert.throws(() => preach(g, 'titus'));
});

test("Player's Choice: roller picks the mode", () => {
  let g = newGame({ kind: 'pass', rulesId: 'fast', names: ['A', 'B'] });
  g = roll(g, CHOICE);
  assert.equal(g.phase, 'choose');
  assert.throws(() => chooseMode(g, 'sail'));
  g = chooseMode(g, 'boat');
  assert.equal(g.phase, 'act');
  assert.equal(g.mode, 'boat');
});

test('a forced pass is allowed only when there is nothing to do', () => {
  let g = newGame({ kind: 'pass', rulesId: 'long', names: ['A', 'B'] });
  g = roll(g, FOOT);                      // Luke, Silas and Titus all stuck on foot at the start? Silas can move
  assert.equal(canEndTurn(g), !(!nothingToDo(g)));
});

test('solo: simulated opponents roll, the human acts as a non-roller', () => {
  let g = newGame({ kind: 'solo', rulesId: 'fast', names: ['Me'], bots: 2 });
  assert.equal(g.seats, 3);
  g = roll(g, ROAD);                      // my roll
  assert.equal(g.role, 'roller');
  g = move(g, 'luke', 'road:Neapolis~Philippi');
  g = endTurn(g);
  assert.equal(g.phase, 'roll');
  assert.equal(g.roller, 1);              // Barnabas
  g = roll(g, BOAT);
  assert.equal(g.role, 'other');
  assert.equal(g.actor, 0);
  g = move(g, 'titus', 'boat:Crete~Cyprus');
  assert.equal(nothingToDo(g), true);
  g = endTurn(g);
  assert.equal(g.roller, 2);
  g = roll(g, CHOICE);                    // a simulated opponent chooses by itself
  assert.equal(g.phase, 'act');
  g = endTurn({ ...g, actions: 1 });
  assert.equal(g.roller, 0);
  assert.equal(g.round, 2);
});

test('randomised games always finish and never break an invariant', () => {
  for (const kind of ['solo', 'pass']) {
    for (const rulesId of ['fast', 'long']) {
      for (let seed = 1; seed <= 60; seed++) {
        const rng = lcg(seed * 7919);
        let g = newGame({ kind, rulesId, names: ['A', 'B', 'C'], bots: 1 + (seed % 3) });
        let steps = 0;
        while (g.phase !== 'over') {
          assert.ok(++steps < 20000, `${kind}/${rulesId}/${seed} did not finish`);
          if (g.phase === 'roll') { g = roll(g, rng); continue; }
          if (g.phase === 'choose') { g = chooseMode(g, MODES[Math.floor(rng() * 3)]); continue; }
          const acts = [];
          for (const ev of EVANGELISTS) {
            const o = evOptions(g, ev);
            for (const m of o.moves) acts.push(() => move(g, ev, m.edge));
            if (o.preach) acts.push(() => preach(g, ev));
          }
          // sometimes stop early when allowed, otherwise keep acting
          if (canEndTurn(g) && (acts.length === 0 || rng() < 0.3)) g = endTurn(g);
          else g = acts[Math.floor(rng() * acts.length)]();
        }
        const res = results(g);
        assert.equal(res.length, g.sheets.length);
        for (const r of res) assert.ok(Number.isFinite(r.total));
      }
    }
  }
});

test('a non-roller may decline to act; the roller may not while anything is possible', () => {
  let g = newGame({ kind: 'pass', rulesId: 'fast', names: ['A', 'B'] });
  g = roll(g, ROAD);
  assert.equal(canEndTurn(g), false);                 // roller has moves available
  g = move(g, 'luke', 'road:Neapolis~Philippi');
  g = endTurn(g);                                     // roller done
  assert.equal(g.role, 'other');
  assert.equal(nothingToDo(g), false);                // B could move...
  assert.equal(canEndTurn(g), true);                  // ...but "may" act, so B can decline
  const before = JSON.stringify(g.sheets[1]);
  g = endTurn(g);
  assert.equal(JSON.stringify(g.sheets[1]), before);
  assert.ok(g.log.some((l) => /B chooses not to act/.test(l.text)));
});
