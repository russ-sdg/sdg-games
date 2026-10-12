import test from 'node:test';
import assert from 'node:assert/strict';
import MAP from './js/map-data.js';
import { EVANGELISTS, MODES, RULESETS, newSheet, applyMove, applyPreach, sheetAt, score } from './js/engine.js';
import { newGame, roll, chooseMode, move, preach, endTurn, canEndTurn, evOptions } from './js/game.js';
import { snippetFor, TRANSLATION } from './js/scripture.js';
import DATA from './js/scripture-data.js';
import { shareMessage, nativeShareData, SHARE_URL } from './js/share.js';

const ROAD = () => 0.0;
function lcg(seed) {
  let s = seed >>> 0;
  return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 2 ** 32);
}

test('every action is recorded in order, and tagged with its round', () => {
  let g = newGame({ kind: 'pass', rulesId: 'fast', names: ['A', 'B'] });
  g = roll(g, ROAD);
  g = move(g, 'luke', 'road:Neapolis~Philippi');
  g = preach(g, 'titus');
  const h = g.sheets[0].history;
  assert.deepEqual(h.map((x) => [x.k, x.ev]), [['move', 'luke'], ['preach', 'titus']]);
  assert.deepEqual(h[0], { k: 'move', ev: 'luke', from: 'Philippi', to: 'Neapolis', edge: 'road:Neapolis~Philippi', round: 1 });
  assert.deepEqual(h[1], { k: 'preach', ev: 'titus', city: 'Crete', called: false, round: 1 });
  assert.equal(g.sheets[1].history.length, 0); // the other player's sheet is separate
});

test('sheetAt(0) is the starting sheet and sheetAt(n) rebuilds a partial journey', () => {
  const fresh = newSheet();
  assert.deepEqual(sheetAt([], 0, RULESETS.fast), fresh);
  let s = applyMove(newSheet(), 'luke', 'road:Neapolis~Philippi');
  s = applyPreach(s, 'titus', RULESETS.fast).sheet;
  const mid = sheetAt(s.history, 1, RULESETS.fast);
  assert.equal(mid.evangelists.luke.city, 'Neapolis');
  assert.deepEqual(mid.evangelists.titus.preachedAt, {});
  assert.deepEqual(sheetAt(s.history, 2, RULESETS.fast), s);
});

test('replaying the recorded history reproduces every final board exactly (random games)', () => {
  for (const rulesId of ['fast', 'long']) {
    for (let seed = 1; seed <= 25; seed++) {
      const rng = lcg(seed * 104729);
      let g = newGame({ kind: 'pass', rulesId, names: ['A', 'B', 'C'] });
      let guard = 0;
      while (g.phase !== 'over') {
        assert.ok(++guard < 20000);
        if (g.phase === 'roll') { g = roll(g, rng); continue; }
        if (g.phase === 'choose') { g = chooseMode(g, MODES[Math.floor(rng() * 3)]); continue; }
        const acts = [];
        for (const ev of EVANGELISTS) {
          const o = evOptions(g, ev);
          o.moves.forEach((m) => acts.push(() => move(g, ev, m.edge)));
          if (o.preach) acts.push(() => preach(g, ev));
        }
        g = canEndTurn(g) && (!acts.length || rng() < 0.3) ? endTurn(g) : acts[Math.floor(rng() * acts.length)]();
      }
      const rules = RULESETS[rulesId];
      for (const sheet of g.sheets) {
        const rebuilt = sheetAt(sheet.history, sheet.history.length, rules);
        assert.deepEqual(rebuilt.evangelists, sheet.evangelists);
        assert.deepEqual(rebuilt.used, sheet.used);
        assert.deepEqual([...rebuilt.visited].sort(), [...sheet.visited].sort());
        assert.equal(score(rebuilt).total, score(sheet).total);
      }
    }
  }
});

test('lastPreach drives the Scripture toast: set on preach, cleared on end of turn and on roll', () => {
  let g = newGame({ kind: 'pass', rulesId: 'fast', names: ['A', 'B'] });
  assert.equal(g.lastPreach, null);
  g = roll(g, ROAD);
  g = preach(g, 'titus');
  assert.deepEqual({ ...g.lastPreach, n: 0 }, { seat: 0, ev: 'titus', cityId: 'Crete', called: false, n: 0 });
  g = endTurn(g);
  assert.equal(g.lastPreach, null);
  // a call is flagged: B preaches with Titus as a non-roller, then again as the roller
  let h = newGame({ kind: 'pass', rulesId: 'fast', names: ['A', 'B'] });
  h = roll(h, ROAD);
  h = preach(h, 'titus'); h = endTurn(h);            // A
  h = preach(h, 'titus');                            // B, non-roller (fast game)
  assert.equal(h.lastPreach.called, false);
  h = endTurn(h);
  h = roll(h, ROAD);                                 // B rolls
  h = preach(h, 'titus');
  assert.equal(h.lastPreach.called, true);
  assert.equal(h.lastPreach.cityId, 'Crete');
  assert.equal(h.roller, 1);
  h = endTurn(h);                                    // hand over to A: B's verse must not linger
  assert.equal(h.lastPreach, null);
});

test('scripture: every city has a snippet; cities outside the NT say so', () => {
  assert.match(TRANSLATION, /World English Bible/);
  const named = new Set(Object.keys(DATA.cities));
  for (const id of named) assert.ok(MAP.cities.some((c) => c.id === id), `passage for unknown city ${id}`);
  for (const c of MAP.cities) {
    const v = snippetFor(c.id);
    assert.ok(v.ref && v.text.length > 20 && v.heading.includes(c.name), c.id);
    assert.equal(Boolean(v.note), !named.has(c.id), `${c.id}: note only for cities not named in the NT`);
    const called = snippetFor(c.id, true);
    assert.match(called.heading, /Called as pastor/);
    assert.equal(called.ref, '1 Peter 5:2');
  }
  assert.deepEqual([...MAP.cities.map((c) => c.id).filter((id) => !named.has(id))].sort(),
    ['Ambracia', 'Apamea', 'Chalcedon', 'Delphi', 'Mount-Olympus', 'Pessinus', 'Sparta']);
});

test('scripture text is clean: no markup, no dangling punctuation', () => {
  const all = [...Object.values(DATA.cities), ...DATA.fallback, DATA.called];
  for (const v of all) {
    assert.ok(!/[<>{}]/.test(v.text), v.ref);
    assert.ok(!/[,;:]$/.test(v.text), `${v.ref} ends mid-sentence`);
    assert.ok(!/\s{2,}/.test(v.text), v.ref);
  }
});

test('the native share payload contains the link exactly once', () => {
  const data = nativeShareData({ name: 'card.png' }, 58);
  assert.equal(data.text, `I scored 58 points in Journeys for Paul! ${SHARE_URL}`);
  assert.equal(data.text.split(SHARE_URL).length - 1, 1);
  assert.ok(!('url' in data), 'a separate url field duplicates the link when apps join text and url');
  assert.equal(shareMessage(-14).includes('-14'), true);
});

test('solo with no simulated opponents: you roll every turn and the game still completes', () => {
  let g = newGame({ kind: 'solo', rulesId: 'fast', names: ['Me'], bots: 0 });
  assert.equal(g.seats, 1);
  assert.deepEqual(g.seatNames, ['Me']);
  g = roll(g, ROAD);
  assert.equal(g.role, 'roller');
  g = move(g, 'luke', 'road:Neapolis~Philippi');
  g = endTurn(g);
  assert.equal(g.phase, 'roll');
  assert.equal(g.roller, 0);                    // I roll again
  assert.equal(g.round, 2);
  for (let seed = 1; seed <= 20; seed++) {      // random full games end
    const rng = lcg(seed * 31);
    let h = newGame({ kind: 'solo', rulesId: seed % 2 ? 'fast' : 'long', names: ['Me'], bots: 0 });
    for (let guard = 0; h.phase !== 'over'; guard++) {
      assert.ok(guard < 20000, 'did not finish');
      if (h.phase === 'roll') { h = roll(h, rng); continue; }
      if (h.phase === 'choose') { h = chooseMode(h, MODES[Math.floor(rng() * 3)]); continue; }
      const acts = [];
      for (const ev of EVANGELISTS) {
        const o = evOptions(h, ev);
        o.moves.forEach((m) => acts.push(() => move(h, ev, m.edge)));
        if (o.preach) acts.push(() => preach(h, ev));
      }
      h = canEndTurn(h) && (!acts.length || rng() < 0.3) ? endTurn(h) : acts[Math.floor(rng() * acts.length)]();
    }
  }
});
