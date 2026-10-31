import test from 'node:test';
import assert from 'node:assert/strict';
import MAP from './js/map-data.js';
import { EVANGELISTS, MODES } from './js/engine.js';
import {
  newGame, roll, announceRoll, setRoller, finishNow, chooseMode, move, preach, endTurn,
  canEndTurn, evOptions, results, isHumanSeat,
} from './js/game.js';

const ROAD = () => 0.0, CHOICE = () => 0.9;
function lcg(seed) {
  let s = seed >>> 0;
  return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 2 ** 32);
}
const NAMES = ['Ann', 'Ben', 'Cy'];
const phone = (me, rulesId = 'fast', names = NAMES) => newGame({ kind: 'table', rulesId, names, me });

test('a table phone holds one sheet but knows the whole table', () => {
  const g = phone(1);
  assert.equal(g.sheets.length, 1);
  assert.equal(g.seats, 3);
  assert.equal(g.mySeat, 1);
  assert.deepEqual(g.seatNames, NAMES);
  assert.deepEqual(g.names, ['Ben']);
  assert.equal(isHumanSeat(g, 1), true);
  assert.equal(isHumanSeat(g, 0), false);
  assert.equal(g.roller, 0);          // Ann rolls first
});

test("another player's roll is announced, not rolled", () => {
  let g = phone(1);
  assert.throws(() => roll(g, ROAD), /another player/);
  assert.throws(() => announceRoll(g, 'sail'));
  g = announceRoll(g, 'road');
  assert.equal(g.phase, 'act');
  assert.equal(g.mode, 'road');
  assert.equal(g.actor, 1);
  assert.equal(g.role, 'other');
  assert.match(g.log.at(-1).text, /Ann rolled road/);
  g = move(g, 'luke', 'road:Neapolis~Philippi');
  assert.equal(g.sheets[0].evangelists.luke.city, 'Neapolis');
  g = endTurn(g);
  assert.equal(g.phase, 'roll');
  assert.equal(g.roller, 1);          // now it is Ben's roll - this phone's owner
});

test('on my own roll the phone rolls the die; announcing is refused', () => {
  let g = setRoller(phone(1), 1);
  assert.throws(() => announceRoll(g, 'road'));
  g = roll(g, ROAD);
  assert.equal(g.role, 'roller');
  assert.equal(g.actor, 1);
  g = preach(g, 'titus');             // Titus is stuck on Crete by road
  assert.equal(g.sheets[0].evangelists.titus.preachedAt.Crete, 1);
});

test("Player's Choice: my roll asks me to choose; another player's is announced as the chosen mode", () => {
  let mine = roll(setRoller(phone(1), 1), CHOICE);
  assert.equal(mine.phase, 'choose');
  mine = chooseMode(mine, 'boat');
  assert.equal(mine.mode, 'boat');
  let theirs = announceRoll(phone(1), 'foot', 'choice');
  assert.equal(theirs.mode, 'foot');
  assert.match(theirs.log.at(-1).text, /Ann chose foot/);
});

test('the same rules apply to a non-roller: long game forbids preaching, fast allows a stuck evangelist', () => {
  const long = announceRoll(phone(2, 'long'), 'road');
  assert.equal(evOptions(long, 'titus').preach, false);
  const fast = announceRoll(phone(2, 'fast'), 'road');
  assert.equal(evOptions(fast, 'titus').preach, true);
  assert.equal(evOptions(fast, 'luke').preach, false);
});

test('setRoller fixes a desynchronised table, only while waiting for a roll', () => {
  let g = phone(0);
  g = setRoller(g, 2);
  assert.equal(g.roller, 2);
  assert.throws(() => setRoller(g, 3));
  assert.throws(() => setRoller(g, -1));
  assert.throws(() => setRoller(newGame({ kind: 'pass', rulesId: 'fast', names: NAMES }), 1));
  assert.throws(() => setRoller(announceRoll(phone(1), 'road'), 0));
});

test('the game ends when MY three are called, tells the table', () => {
  let g = phone(1);
  g.sheets[0].evangelists.luke.called = true;
  g.sheets[0].evangelists.silas.called = true;
  g.sheets[0].evangelists.titus.preachedAt.Crete = 1;     // next preach calls him (fast game)
  g = announceRoll(g, 'road');
  g = preach(g, 'titus');
  assert.equal(g.lastPreach.called, true);
  g = endTurn(g);
  assert.equal(g.phase, 'over');
  assert.equal(results(g).length, 1);                      // just this phone's own result
  assert.equal(results(g)[0].called, 3);
});

test('being stuck does not end a table game on its own', () => {
  let g = phone(1, 'long');                                // (in the fast game a stuck player could still preach)
  for (const ev of EVANGELISTS) g.sheets[0].used[ev] = MAP.edges.map((e) => e.id);   // nothing left to travel
  g = announceRoll(g, 'road');
  assert.equal(canEndTurn(g), true);                       // nothing to do: this player passes...
  g = endTurn(g);
  assert.equal(g.phase, 'roll');                           // ...but the others may still be moving
  assert.equal(g.roller, 1);
});

test('finishNow ends a table game from any phase, but only table games', () => {
  assert.equal(finishNow(phone(0)).phase, 'over');
  assert.equal(finishNow(announceRoll(phone(1), 'road')).phase, 'over');
  assert.throws(() => finishNow(finishNow(phone(0))));
  assert.throws(() => finishNow(newGame({ kind: 'solo', rulesId: 'fast', names: ['Me'], bots: 1 })));
});

// Several phones at one table. Each phone is an independent game state that only learns about other
// players through what is announced: the roller's phone rolls, everyone else types in the mode.
test('phones at one table stay in step through a whole game (fuzz)', () => {
  for (const rulesId of ['fast', 'long']) {
    for (let seed = 1; seed <= 20; seed++) {
      const rng = lcg(seed * 7727);
      const names = ['A', 'B', 'C', 'D'].slice(0, 2 + (seed % 3));
      let phones = names.map((_, me) => phone(me, rulesId, names));
      for (let rolls = 0; rolls < 400 && phones.every((p) => p.phase !== 'over'); rolls++) {
        const roller = phones[0].roller;
        assert.ok(phones.every((p) => p.roller === roller && p.round === phones[0].round && p.phase === 'roll'), 'phones disagree about the roll');
        // the roller's phone rolls and, on Player's Choice, picks; the others are told the mode
        let r = roll(phones[roller], rng);
        if (r.phase === 'choose') r = chooseMode(r, MODES[Math.floor(rng() * 3)]);
        const mode = r.mode;
        phones = phones.map((p, i) => (i === roller ? r : announceRoll(p, mode)));
        // everyone moves on their own phone
        phones = phones.map((p) => {
          let g = p;
          for (let guard = 0; guard < 10 && g.phase === 'act'; guard++) {
            const acts = [];
            for (const ev of EVANGELISTS) {
              const o = evOptions(g, ev);
              o.moves.forEach((m) => acts.push(() => move(g, ev, m.edge)));
              if (o.preach) acts.push(() => preach(g, ev));
            }
            if (canEndTurn(g) && (!acts.length || rng() < 0.3)) g = endTurn(g);
            else g = acts[Math.floor(rng() * acts.length)]();
          }
          assert.notEqual(g.phase, 'act', 'turn did not finish');
          return g;
        });
        // a phone whose player has all three called has ended; the table tells the others
        if (phones.some((p) => p.phase === 'over')) phones = phones.map((p) => (p.phase === 'over' ? p : finishNow(p)));
      }
      phones = phones.map((p) => (p.phase === 'over' ? p : finishNow(p)));    // 400 rolls is plenty: call it
      for (const p of phones) {
        const [r] = results(p);
        assert.ok(Number.isFinite(r.total));
        assert.equal(p.sheets.length, 1);
      }
    }
  }
});
