import test from 'node:test';
import assert from 'node:assert/strict';
import * as E from './js/engine.js';
import * as AI from './js/ai.js';

const mulberry = (a) => () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const bots = (n, skill) => Array.from({ length: n }, (_, i) => ({ name: 'B' + i, bot: true, skill: skill || ['casual', 'steady', 'sharp'][i % 3] }));

test('computer-only games always finish, at every size, with and without the expansion', () => {
  for (const exp of [false, true]) {
    for (let n = 2; n <= 4; n++) {
      for (let g = 0; g < 4; g++) {
        let s = E.newGame({ seed: 50 + g, players: bots(n), expansion: exp });
        const r = mulberry(g);
        let steps = 0;
        while (!s.over) { s = AI.step(s, r); assert.ok(++steps < 5000, 'a game must not run forever'); }
        assert.ok(['journeys', 'stalled', 'rounds'].includes(s.endedBy));
        const total = s.players.reduce((a, p) => a + E.score(p).journeys, 0);
        const played = s.players.reduce((a, p) => a + p.journeys.length, 0);
        assert.ok(played <= (exp ? 23 : 13) && total >= 0);
        if (s.endedBy === 'journeys') assert.equal(played, exp ? 23 : 13, 'every journey was completed');
      }
    }
  }
});

test('every card is somewhere at all times: hands, piles, played, or still to be drawn (nothing is lost or duplicated)', () => {
  let s = E.newGame({ seed: 9, players: bots(3), expansion: true });
  const r = mulberry(4);
  for (let i = 0; i < 400 && !s.over; i++) {
    s = AI.step(s, r);
    const all = [...s.draw, ...s.up.filter((u) => u !== null), ...s.discard, ...s.players.flatMap((p) => p.hand)];
    assert.equal(new Set(all).size, all.length, 'no card is in two places');
    assert.ok(all.length <= 85);
  }
});

test('journey cards are not lost: in play + deck + won always add up', () => {
  let s = E.newGame({ seed: 12, players: bots(2), expansion: false });
  const r = mulberry(8);
  while (!s.over) {
    s = AI.step(s, r);
    assert.equal(s.inplay.length + s.jdeck.length + s.players.reduce((a, p) => a + p.journeys.length, 0), 13);
  }
});

test('a computer lays down a journey it can complete, and keeps tokens it does not need', () => {
  let s = E.newGame({ seed: 3, players: bots(2, 'steady') });
  s.turn = 0; s.phase = 'play';
  s.inplay = ['capernaum-to-bethsaida'];
  const defs = E.deckDefs(false);
  const uidFor = (place) => [...s.draw, ...s.up, ...s.players[1].hand].find((u) => u !== null && defs[u].place === place);
  const cap = uidFor('capernaum'), bet = uidFor('bethsaida');
  s.players[0].hand = [cap, bet]; s.players[1].hand = s.players[1].hand.filter((u) => u !== cap && u !== bet);
  s.draw = s.draw.filter((u) => u !== cap && u !== bet); s.up = s.up.map((u) => (u === cap || u === bet ? s.draw.pop() : u));
  s.players[0].tokens = 1;
  const o = AI.choosePlay(s);
  assert.equal(o.journey, 'capernaum-to-bethsaida');
  assert.equal(o.tokensUsed, 0);
});

test('a computer takes a card that helps over one that does not', () => {
  let s = E.newGame({ seed: 3, players: bots(2, 'sharp') });
  s.phase = 'draw'; s.turn = 0; s.drawn = 0;
  s.inplay = ['jerusalem-to-bethlehem'];
  const defs = E.deckDefs(false);
  const pool = [...s.draw, ...s.up, ...s.players[0].hand, ...s.players[1].hand];
  const pick = (place) => pool.find((u) => defs[u].place === place);
  const jer = pick('jerusalem'), tyre = pick('tyre');
  s.players[0].hand = [pick('bethlehem')];
  s.draw = s.draw.filter((u) => ![jer, tyre, ...s.players[0].hand].includes(u));
  s.players[1].hand = s.players[1].hand.filter((u) => ![jer, tyre, ...s.players[0].hand].includes(u));
  s.up = [tyre, jer, s.draw.pop(), s.draw.pop()];
  assert.equal(AI.chooseTake(s, () => 0.5), 1);
});
