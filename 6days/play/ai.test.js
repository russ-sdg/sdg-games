import test from 'node:test';
import assert from 'node:assert/strict';
import * as E from './js/engine.js';
import * as AI from './js/ai.js';

const mulberry = (a) => () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

test('computer players finish whole games with every skill, and the cards are never lost or doubled', () => {
  for (let g = 0; g < 60; g++) {
    const players = Array.from({ length: 2 + (g % 5) }, (_, i) => ({ name: 'B' + i, bot: true, skill: ['casual', 'steady', 'sharp'][(i + g) % 3] }));
    let s = E.newGame({ seed: 300 + g, players }), r = mulberry(g + 1), guard = 0;
    while (!s.over && guard++ < 3000) {
      s = AI.turn(s, r);
      const all = [...s.draw, ...s.piles.flat(), ...s.players.flatMap((q) => q.hand), ...s.stacks.flatMap((k) => k.cards), ...s.stacks.map((k) => k.em).filter((x) => x !== null)];
      assert.equal(all.length, 46); assert.equal(new Set(all).size, 46);
    }
    assert.ok(s.over, `game ${g} did not end`);
  }
});

test('a computer player closes a full day when it can, and takes a useful discard-pile card', () => {
  const em = E.DEFS.findIndex((d) => d.kind === 'em');
  let s = E.newGame({ seed: 4, players: [{ name: 'A', bot: true, skill: 'steady' }, { name: 'B', bot: true, skill: 'steady' }] });
  s.players[0].hand = [em, em + 1]; s.draw = s.draw.filter((u) => u !== em && u !== em + 1);
  s.piles = s.piles.map((p) => p.filter((u) => u !== em && u !== em + 1));
  s.piles = s.piles.map((p, i) => (p.length ? p : [s.draw.pop()]));
  const t = AI.turn(s, () => 0.5);
  assert.equal(t.last.type, 'close'); assert.equal(t.last.stack, 0); assert.equal(t.players[0].score, 1);
});
