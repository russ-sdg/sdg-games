import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { computeHash, stamped } from './tools/stamp.mjs';

const html = readFileSync(new URL('./index.html', import.meta.url), 'utf8');

test('index.html is stamped with the current scripts and styles (run: node tools/stamp.mjs)', () => {
  assert.equal(stamped(html), html, 'a script or play.css changed since index.html was stamped');
});

test('every module is versioned in the import map, and the entry script, stylesheet and footer agree', () => {
  const hash = computeHash();
  const map = JSON.parse(html.match(/<script type="importmap">([\s\S]*?)<\/script>/)[1]).imports;
  const files = readdirSync(new URL('./js/', import.meta.url)).filter((f) => f.endsWith('.js'));
  for (const f of files) assert.equal(map[`./js/${f}`], `./js/${f}?v=${hash}`, f);
  assert.equal(Object.keys(map).length, files.length);
  assert.ok(html.includes(`src="js/app.js?v=${hash}"`));
  assert.ok(html.includes(`href="play.css?v=${hash}"`));
  assert.ok(html.includes(`<span id="build">${hash}</span>`));
  // the import map must come before the first module script or it is ignored
  assert.ok(html.indexOf('type="importmap"') < html.indexOf('type="module"'));
});

test('the hash really depends on the code', () => {
  const a = stamped(html, 'aaaaaaaa'), b = stamped(html, 'bbbbbbbb');
  assert.notEqual(a, b);
  assert.ok(!b.includes('aaaaaaaa'));
});
