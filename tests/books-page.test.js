// books.html is built from js/books-data.js; these checks keep every entry in step with its product page.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { BOOKS, FILTER_AFTER, lowestPrice, onSale, filterKeys, matches } = require('../js/books-data.js');

const ROOT = path.join(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const page = (b) => read(`${b.slug}/index.html`);
const ld = (b) => JSON.parse(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(page(b))[1]);
const webpSize = (file) => {        // [width, height] of a lossy WebP (VP8)
  const buf = fs.readFileSync(path.join(ROOT, file));
  assert.equal(buf.toString('ascii', 8, 12), 'WEBP');
  assert.equal(buf.toString('ascii', 12, 16), 'VP8 ', `${file} is not a lossy WebP`);
  return [buf.readUInt16LE(26) & 0x3fff, buf.readUInt16LE(28) & 0x3fff];
};

test('books are listed once each, with the fields the cards need', () => {
  assert.ok(BOOKS.length >= 1);
  assert.equal(new Set(BOOKS.map((b) => b.slug)).size, BOOKS.length, 'duplicate slug');
  for (const b of BOOKS) {
    assert.ok(b.title && b.blurb && b.coverAlt, `${b.slug}: title, blurb and coverAlt are required`);
    assert.ok(b.blurb.length <= 160, `${b.slug}: blurb is long for a card`);
    assert.ok(b.tags.length >= 1 && b.formats.length >= 1);
    for (const f of b.formats) assert.match(f.price, /^\d+\.\d\d$/, `${b.slug}: price ${f.price}`);
  }
});

for (const b of BOOKS) {
  test(`${b.slug}: product page, cover files and prices exist and agree`, () => {
    assert.ok(fs.existsSync(path.join(ROOT, b.slug, 'index.html')), 'no product page');
    const [w480, h480] = webpSize(`${b.cover}-480.webp`);
    assert.deepEqual([w480, h480], b.coverSize, 'coverSize does not match the 480px cover');
    assert.ok(fs.existsSync(path.join(ROOT, `${b.cover}-820.webp`)), 'no 820px cover');
    const offers = ld(b).offers.map((o) => `${o.name} ${o.price}`).sort();
    assert.deepEqual(b.formats.map((f) => `${f.name} ${f.price}`).sort(), offers, 'formats differ from the product page');
    assert.equal(b.audio, offers.some((o) => /^Audiobook /.test(o)), 'audio flag differs from the product page');
    const html = page(b).replace(/<!--[\s\S]*?-->/g, '');
    for (const f of b.formats.filter((x) => x.was)) assert.ok(html.includes(`<s><span class="pp-sr">Was </span>$${f.was}</s>`), `${f.name}: list price ${f.was} not on the page`);
  });
}

test('books.html: the no-JavaScript list links every book, and the shared scripts are loaded', () => {
  const html = read('books.html').replace(/<!--[\s\S]*?-->/g, '');
  const links = [...html.matchAll(/<li><a href="([^"]+)\/index\.html">/g)].map((m) => m[1]);
  assert.deepEqual(links, BOOKS.map((b) => b.slug));
  assert.equal((html.match(/<h1[\s>]/g) || []).length, 1);
  assert.match(html, /<script src="js\/books-data\.js\?v=\w+"/);
  assert.match(html, /<script src="js\/books-page\.js\?v=\w+"/);
  const title = /<title>([^<]+)<\/title>/.exec(html)[1], desc = /<meta name="description" content="([^"]+)"/.exec(html)[1];
  assert.ok(title.length <= 70 && desc.length >= 70 && desc.length <= 165);
});

test('helpers: lowest price, sale badge and filter buttons', () => {
  const b = { formats: [{ price: '7.50', was: '9.99' }, { price: '5.00' }], tags: ['A'], audio: false };
  assert.equal(lowestPrice(b), '5.00');
  assert.ok(onSale(b) && !onSale({ formats: [{ price: '1.00' }] }));
  assert.deepEqual(filterKeys(BOOKS.slice(0, 1)), [], 'no filters for a short list');
  const many = Array.from({ length: FILTER_AFTER + 1 }, (_, i) => ({ tags: [i % 2 ? 'Nonfiction' : 'Fiction'], audio: i === 0 }));
  assert.deepEqual(filterKeys(many), ['Fiction', 'Nonfiction', 'Audiobook']);
  assert.ok(matches(many[0], 'Audiobook') && !matches(many[1], 'Audiobook') && matches(many[1], 'Nonfiction') && matches(many[1], ''));
});
