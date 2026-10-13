import test from 'node:test';
import assert from 'node:assert/strict';
import { shareMessage, nativeShareData, SHARE_URL, describe } from './js/share.js';
import { newState, MODES } from './js/engine.js';

test('the share message carries the link exactly once, and the native share data does not repeat it as a url', () => {
  const m = shareMessage(42);
  assert.equal(m.split(SHARE_URL).length - 1, 1);
  assert.ok(m.includes('42'));
  const d = nativeShareData({ name: 'x.png' }, 42);
  assert.equal('url' in d, false);
  assert.equal(d.text, m);
});

test('the share link points at the game', () => assert.match(SHARE_URL, /^https:\/\/sdggames\.fun\/roman-catacombs\/play\/$/));

test('the image caption names the mode', () => {
  assert.equal(describe(newState()), 'Scorecard');
  const s = newState({ mode: MODES.solo, seed: 1 }); s.round = 21;
  assert.equal(describe(s), 'Solo · 21 of 21 rounds');
});
