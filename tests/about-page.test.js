// Static checks for about.html (a hand-written page).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'about.html'), 'utf8').replace(/<!--[\s\S]*?-->/g, '');

test('about.html: one h1, headings never skip a level, ids are unique and anchors have targets', () => {
  const levels = [...html.matchAll(/<h([1-6])[\s>]/g)].map((m) => Number(m[1]));
  assert.equal(levels.filter((l) => l === 1).length, 1);
  levels.reduce((prev, l) => { assert.ok(l <= prev + 1, `h${l} follows h${prev}`); return Math.max(prev, l); }, 0);
  const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
  assert.equal(new Set(ids).size, ids.length);
  for (const m of html.matchAll(/href="#([^"]+)"/g)) assert.ok(ids.includes(m[1]), `#${m[1]} has no target`);
});

test('about.html: title, description, images and local links are all real', () => {
  const title = /<title>([^<]+)<\/title>/.exec(html)[1], desc = /<meta name="description" content="([^"]+)"/.exec(html)[1];
  assert.ok(title.length >= 10 && title.length <= 70 && desc.length >= 70 && desc.length <= 165);
  for (const m of html.matchAll(/<img\b[^>]*>/g)) for (const a of ['alt', 'width', 'height']) assert.match(m[0], new RegExp(`\\s${a}="`), `img without ${a}`);
  for (const m of html.matchAll(/\s(?:src|href)="([^"]+)"/g)) {
    const u = m[1].split('#')[0].split('?')[0];
    if (!u || /^(https?:|mailto:)/.test(u)) continue;
    assert.ok(fs.existsSync(path.join(ROOT, u)), `${u} is missing`);
  }
  assert.match(html, /<link href="css\/product-page\.css\?v=\w+"/);
});
