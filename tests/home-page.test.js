// index.html shows the featured games, books and clothing (built from the data files) and the free online games.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const G = require('../js/games-data.js');
const B = require('../js/books-data.js');
const { CLOTHING } = require('../js/clothing-data.js');
const K = require('../js/cards.js');

const ROOT = path.join(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const html = read('index.html').replace(/<!--[\s\S]*?-->/g, '');
const listLinks = (id) => {                                   // links in the no-JavaScript list that JavaScript replaces
  const m = new RegExp(`<ul[^>]*id="${id}">([\\s\\S]*?)</ul>`).exec(html);
  return [...m[1].matchAll(/<a href="([^"]+)">/g)].map((x) => x[1]);
};

const featuredGames = G.GAMES.filter((g) => g.featured), featuredBooks = B.BOOKS.filter((b) => b.featured), featuredClothing = CLOTHING.filter((c) => c.featured);

test('featured games, books and clothing are shown in equal numbers', () => {
  assert.ok(featuredGames.length >= 1);
  assert.equal(featuredBooks.length, featuredGames.length, 'featured books and games should be the same number');
  assert.equal(featuredClothing.length, featuredGames.length, 'featured clothing and games should be the same number');
});

test('index.html: the no-JavaScript lists match the featured items and the free online games', () => {
  assert.deepEqual(listLinks('featured-games'), featuredGames.map(G.href));
  assert.deepEqual(listLinks('featured-books'), featuredBooks.map((b) => `${b.slug}/index.html`));
  assert.deepEqual(listLinks('featured-clothing'), featuredClothing.map((c) => c.url));
  assert.deepEqual(listLinks('free-games'), G.GAMES.filter((g) => g.online).map((g) => g.online));
});

test('clothing: pictures exist and links go to the shop', () => {
  for (const c of CLOTHING) {
    assert.ok(fs.existsSync(path.join(ROOT, `assets/home/${c.art}.webp`)), `${c.art}.webp is missing`);
    assert.match(c.url, /^https:\/\/sdg-soft-wear\.printify\.me\//);
    assert.ok(c.title && c.blurb && c.artAlt);
  }
});

test('index.html: one h1, a description, the hero photo, and scripts in dependency order', () => {
  assert.equal((html.match(/<h1[\s>]/g) || []).length, 1);
  const desc = /<meta name="description" content="([^"]+)"/.exec(html)[1];
  assert.ok(desc.length >= 70 && desc.length <= 165, `description is ${desc.length} chars`);
  for (const w of [800, 1200]) assert.ok(fs.existsSync(path.join(ROOT, `assets/home/family-${w}.webp`)), `family-${w}.webp is missing`);
  const order = ['product-core', 'cards', 'games-data', 'books-data', 'clothing-data', 'home-page'].map((s) => html.indexOf(`js/${s}.js`));
  assert.ok(order.every((x, i) => x > 0 && (i === 0 || x > order[i - 1])), `scripts out of order: ${order}`);
  assert.match(html, /<script src="js\/product-page\.js\?v=\w+"/);
  const mc = /mailchimpUrl:\s*'([^']*)'/.exec(html);
  assert.ok(mc && require('../js/product-core.js').mailchimpJsonpUrl(mc[1], 'a@b.co', 'cb'), 'mailchimpUrl is not a Mailchimp subscribe URL');
});

test('cards: text is escaped, coming-soon games show the launch date, and launched ones the price', () => {
  const g = { slug: 'x', title: 'A <b>&"game"', tags: ['Card game'], art: 'x', artAlt: 'alt', price: '19.99', blurb: 'b', facts: [], launch: '2026-11-15' };
  const before = K.gameCard(g, 0, G, new Date(2026, 9, 18)), after = K.gameCard(g, 0, G, new Date(2026, 10, 15));
  assert.ok(before.includes('Coming soon') && before.includes('Launching November 15, 2026') && !before.includes('$19.99'));
  assert.ok(!after.includes('Coming soon') && after.includes('$19.99'));
  assert.ok(before.includes('A &lt;b&gt;&amp;&quot;game&quot;') && !before.includes('<b>&'));
  assert.ok(K.shirtCard(CLOTHING[0]).includes(CLOTHING[0].url));
  assert.ok(K.bookCard(B.BOOKS[0], 0, B).includes(`${B.BOOKS[0].slug}/index.html`));
});
