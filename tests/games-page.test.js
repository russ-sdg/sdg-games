// games.html is built from js/games-data.js; these checks keep every entry in step with its product page.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { GAMES, FILTER_AFTER, href, priceText, upcoming, filterKeys, matches } = require('../js/games-data.js');

const ROOT = path.join(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const exists = (rel) => fs.existsSync(path.join(ROOT, rel));
const text = (slug) => read(`${slug}/index.html`).replace(/<!--[\s\S]*?-->/g, '').replace(/<script[\s\S]*?<\/script>/g, '').replace(/<[^>]+>/g, ' ');
const webpSize = (file) => {        // [width, height] of a lossy WebP (VP8)
  const buf = fs.readFileSync(path.join(ROOT, file));
  assert.equal(buf.toString('ascii', 8, 12), 'WEBP');
  assert.equal(buf.toString('ascii', 12, 16), 'VP8 ', `${file} is not a lossy WebP`);
  return [buf.readUInt16LE(26) & 0x3fff, buf.readUInt16LE(28) & 0x3fff];
};

test('games are listed once each, with the fields the cards need', () => {
  assert.equal(new Set(GAMES.map((g) => g.slug)).size, GAMES.length, 'duplicate slug');
  for (const g of GAMES) {
    assert.ok(g.title && g.blurb && g.artAlt && g.tags.length, `${g.slug}: title, blurb, artAlt and tags are required`);
    assert.ok(g.blurb.length <= 150, `${g.slug}: blurb is long for a card`);
    assert.match(g.price, /^(Free|\d+\.\d\d)$/, `${g.slug}: price ${g.price}`);
    if (g.was) assert.match(g.was, /^\d+\.\d\d$/);
    if (g.launch) assert.match(g.launch, /^\d{4}-\d{2}-\d{2}$/);
  }
});

for (const g of GAMES) {
  test(`${g.slug}: card art, product page, price and online link are real`, () => {
    assert.deepEqual(webpSize(`assets/games/${g.art}.webp`), [450, 300], 'card art must be 450 x 300');
    if (g.url) assert.match(g.url, /^https:\/\//);
    else {
      assert.ok(exists(`${g.slug}/index.html`), 'no product page');
      const t = text(g.slug);
      // Older product pages show no price of their own (it is on the Shopify button), so only pages that state one are checked
      if (g.price !== 'Free' && /\$\d+\.\d\d/.test(t)) assert.ok(t.includes(`$${g.price}`), `$${g.price} is not on the product page`);
      if (g.was) assert.ok(t.includes(`$${g.was}`), `list price $${g.was} is not on the product page`);
    }
    if (g.launch && !g.url) {                                  // the card and the product page must agree on the launch day
      const page = read(`${g.slug}/index.html`), core = require('../js/product-core.js');
      assert.ok(page.includes(`launch: '${g.launch}'`), `the product page's launch date is not ${g.launch}`);
      assert.ok(page.includes(core.launchLabel(g.launch)) && !page.replaceAll(core.launchLabel(g.launch), '').match(/November \d+, 2026/), 'a different launch date is written on the page');
    }
    if (g.online && !/^https?:/.test(g.online)) assert.ok(exists(`${g.online}index.html`), `no online version at ${g.online}`);
  });
}

test('games.html: the no-JavaScript list links every game, in order, and the shared scripts are loaded', () => {
  const html = read('games.html').replace(/<!--[\s\S]*?-->/g, '');
  const links = [...html.matchAll(/<li><a href="([^"]+)">/g)].map((m) => m[1]);
  assert.deepEqual(links, GAMES.map(href));
  assert.equal((html.match(/<h1[\s>]/g) || []).length, 1);
  for (const s of ['product-core', 'games-data', 'games-page']) assert.match(html, new RegExp(`<script src="js/${s}\\.js\\?v=\\w+"`));
  const title = /<title>([^<]+)<\/title>/.exec(html)[1], desc = /<meta name="description" content="([^"]+)"/.exec(html)[1];
  assert.ok(title.length <= 70 && desc.length >= 70 && desc.length <= 165);
});

test('helpers: price text, upcoming launches and filter buttons', () => {
  assert.equal(priceText({ price: 'Free' }), 'Free');
  assert.equal(priceText({ price: '9.99' }), '$9.99');
  const g = { launch: '2026-11-15' };
  assert.ok(upcoming(g, new Date(2026, 9, 18)));
  assert.ok(!upcoming(g, new Date(2026, 10, 15)), 'on launch day the card shows the price');
  assert.ok(!upcoming({}, new Date(2026, 9, 18)));
  assert.deepEqual(filterKeys(GAMES.slice(0, FILTER_AFTER)), [], 'no filters for a short list');
  const keys = filterKeys(GAMES);
  assert.ok(keys.includes('Card game') && keys.includes('Play online'));
  const online = GAMES.find((x) => x.slug === 'Tyndale'), card = GAMES.find((x) => x.slug === 'fruity');
  assert.ok(matches(online, 'Play online') && matches(online, 'Board game') && !matches(card, 'Play online') && matches(card, ''));
});
