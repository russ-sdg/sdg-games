import test from 'node:test';
import assert from 'node:assert/strict';
import { SITES, SITE_TILE, TILES, distFrom } from './js/map-data.js';
import * as E from './js/engine.js';
import * as AI from './js/ai.js';

const id = (s) => SITES.findIndex((x) => x.id === s);
const rngOf = (seed) => () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
const COLORS = ['R', 'B', 'T', 'L', 'D', 'G'];

function playGame(seed, skills, rnd) {
  let S = AI.botStarts(E.newGame({ seed, players: skills.map((skill, i) => ({ name: 'P' + i, bot: true, skill, color: COLORS[i] })) }), rnd);
  let guard = 0;
  while (!S.over) {
    if (++guard > 2000) throw new Error('game did not end');
    if (S.phase === 'roll') S = E.roll(S);
    else if (S.phase === 'move') S = E.resolve(AI.botMoves(S, rnd));
    else if (S.phase === 'pick') S = AI.botPicks(S, rnd);
  }
  return S;
}

test('expected rolls to cover a distance: 1 square takes one roll, more squares take longer, never decreasing', () => {
  assert.equal(AI.expectedRolls(0), 0); assert.equal(AI.expectedRolls(1), 1); assert.equal(AI.expectedRolls(6), 1 + 5 * 0 + (AI.expectedRolls(5) + AI.expectedRolls(4) + AI.expectedRolls(3) + AI.expectedRolls(2) + AI.expectedRolls(1)) / 6);
  for (let d = 1; d < 40; d++) assert.ok(AI.expectedRolls(d + 1) >= AI.expectedRolls(d));
  assert.ok(AI.expectedRolls(7) > 1.9 && AI.expectedRolls(7) < 3);
});
test('the planner finds the best order of sites', () => {
  const need = [id('bethany'), id('olives'), id('gethsemane')], pl = AI.planner(need);
  const here = SITE_TILE[id('bethany')];
  const best = pl.from(here, pl.full);
  assert.ok(Math.abs(best - (AI.expectedRolls(7) + AI.expectedRolls(3))) < 1e-9, 'Bethany, then up the hill, then Gethsemane');
  assert.equal(pl.from(here, 0), 0);
  assert.ok(pl.from(SITE_TILE[id('emmaus')], pl.full) > best, 'starting at Emmaus is worse');
});
test('a computer player heads for its sites: it lands on a needed site when it can, and never ends further away by choice', () => {
  const S = E.newGame({ seed: 3, players: [{ name: 'a', bot: true, skill: 'sharp', color: 'R' }, { name: 'b', bot: true, skill: 'sharp', color: 'B' }] });
  S.phase = 'move'; S.die = 6; S.rolls = 1; S.moves = {};
  S.players[0].card = 'nicodemus'; S.players[0].pos = TILES.find((t) => t.x === 480 && t.y === 622).i; S.players[0].offer = [];
  S.players[1].card = 'cleopas'; S.players[1].pos = SITE_TILE[id('upper-room')]; S.players[1].visited = [id('upper-room')]; S.players[1].offer = [];
  assert.ok([SITE_TILE[id('tomb')], SITE_TILE[id('golgotha')]].includes(AI.pickMove(S, 0, () => 0.5)), 'lands on the Tomb or Golgotha, both on its card');
  const to = AI.pickMove(S, 1, () => 0.5);
  assert.ok(distFrom(to)[SITE_TILE[id('emmaus')]] < distFrom(S.players[1].pos)[SITE_TILE[id('emmaus')]]);
});
test('setup picks: a card, and a start square of its own colour near the journey', () => {
  const S = E.newGame({ seed: 11, players: [{ name: 'a', bot: true, skill: 'sharp', color: 'T' }, { name: 'b', bot: false, color: 'B' }] });
  const c = AI.pickSetup(S, 0, () => 0.5);
  assert.ok(S.players[0].offer.includes(c.card)); assert.ok(E.startSquares(S, 0).includes(c.tile));
  const t = AI.pickStart(S, 0, 'nicodemus', () => 0.5);
  assert.ok(E.startSquares(S, 0).includes(t));
  assert.ok(distFrom(t)[SITE_TILE[id('tomb')]] <= 8, 'starts within a few rolls of the Tomb and Golgotha');
});
test('computer-only games finish, for 2 to 6 players and every skill', () => {
  for (const n of [2, 3, 4, 5, 6]) for (const skill of ['casual', 'steady', 'sharp']) {
    const S = playGame(n * 100 + skill.length, Array(n).fill(skill), rngOf(n));
    assert.ok(S.over && S.winners.length >= 1 && S.rolls < E.ROLL_LIMIT, `${n} ${skill}: ${S.endedBy} after ${S.rolls}`);
  }
});
test('skill matters: sharp players beat casual players over a batch of games', () => {
  let sharp = 0, casual = 0;
  for (let g = 0; g < 24; g++) {
    const S = playGame(500 + g, g % 2 ? ['sharp', 'casual'] : ['casual', 'sharp'], rngOf(g + 1));
    for (const p of S.players) { if (p.skill === 'sharp') sharp += E.score(p); else casual += E.score(p); }
  }
  assert.ok(sharp > casual * 1.2, `sharp ${sharp} vs casual ${casual}`);
});
