// Static checks for the redesigned product pages (add a page to PAGES when it moves to the new design).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const PAGES = ['6days/index.html', 'JfP/index.html', 'roman-catacombs/index.html', 'Tyndale/index.html'];

const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const stripComments = (h) => h.replace(/<!--[\s\S]*?-->/g, '');
// local file for a URL found in a page (relative to the page, or absolute on sdggames.fun); null for other hosts
function localPath(page, url) {
  url = url.split('#')[0].split('?')[0];
  if (!url || /^(mailto:|tel:|data:|javascript:)/.test(url)) return null;
  if (/^https?:\/\//.test(url)) { const m = /^https:\/\/sdggames\.fun(\/.*)$/.exec(url); return m ? path.join(ROOT, m[1]) : null; }
  return url.startsWith('/') ? path.join(ROOT, url) : path.join(ROOT, path.dirname(page), url);
}

for (const page of PAGES) {
  const html = stripComments(read(page));

  test(`${page}: one h1, and headings never skip a level`, () => {
    const levels = [...html.matchAll(/<h([1-6])[\s>]/g)].map((m) => Number(m[1]));
    assert.equal(levels.filter((l) => l === 1).length, 1, 'exactly one h1');
    levels.reduce((prev, l) => { assert.ok(l <= prev + 1, `h${l} follows h${prev}`); return Math.max(prev, l); }, 0);
  });

  test(`${page}: ids are unique and every #anchor has a target`, () => {
    const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
    assert.equal(new Set(ids).size, ids.length, `duplicate ids: ${ids.filter((x, i) => ids.indexOf(x) !== i)}`);
    for (const m of html.matchAll(/href="#([^"]+)"/g)) assert.ok(ids.includes(m[1]), `#${m[1]} has no target`);
  });

  test(`${page}: every image has alt text, width and height`, () => {
    for (const m of html.matchAll(/<img\b[^>]*>/g)) {
      assert.match(m[0], /\salt="/, `no alt: ${m[0].slice(0, 80)}`);
      assert.match(m[0], /\swidth="/, `no width: ${m[0].slice(0, 80)}`);
      assert.match(m[0], /\sheight="/, `no height: ${m[0].slice(0, 80)}`);
    }
  });

  test(`${page}: every file the page references exists`, () => {
    const urls = [];
    for (const m of html.matchAll(/\s(?:src|href|data-zoom|imagesrcset|srcset)="([^"]+)"/g)) {
      const v = m[1];
      if (/\ssrcset=|imagesrcset/.test(m[0])) v.split(',').forEach((s) => urls.push(s.trim().split(/\s+/)[0])); else urls.push(v);
    }
    for (const m of html.matchAll(/<meta[^>]+(?:og:image|twitter:image)"[^>]*content="([^"]+)"/g)) urls.push(m[1]);
    let checked = 0;
    for (const u of urls) {
      const p = localPath(page, u);
      if (!p) continue;
      assert.ok(fs.existsSync(p), `${u} -> ${path.relative(ROOT, p)} is missing`);
      checked++;
    }
    assert.ok(checked > 15, `only ${checked} local files checked`);
  });

  test(`${page}: structured data is valid JSON for a Product`, () => {
    const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
    assert.equal(blocks.length, 1);
    const data = JSON.parse(blocks[0][1]);
    assert.equal(data['@type'], 'Product');
    assert.ok(data.name && data.description && data.image.length);
  });

  test(`${page}: title and description are present and a sensible length`, () => {
    const title = /<title>([^<]+)<\/title>/.exec(html)[1];
    const desc = /<meta name="description" content="([^"]+)"/.exec(html)[1];
    assert.ok(title.length >= 10 && title.length <= 70, `title is ${title.length} chars`);
    assert.ok(desc.length >= 70 && desc.length <= 165, `description is ${desc.length} chars`);
    assert.ok(/rel="canonical"/.test(html));
  });

  test(`${page}: every email field has a label, and forms have a status area`, () => {
    for (const m of html.matchAll(/<input[^>]*type="email"[^>]*id="([^"]+)"/g)) assert.match(html, new RegExp(`<label[^>]*for="${m[1]}"`), `no label for ${m[1]}`);
    const forms = [...html.matchAll(/<form\b[\s\S]*?<\/form>/g)];
    assert.ok(forms.length >= 1 || !/pp-signup/.test(html));
    for (const f of forms) assert.match(f[0], /role="status"/);
  });

  test(`${page}: if Mailchimp is connected, the address is a valid Mailchimp form URL`, () => {
    const m = /mailchimpUrl:\s*'([^']*)'/.exec(html);
    const url = m && m[1];
    if (!url) return;                                         // not connected yet: the page shows an "opening soon" message
    const jsonp = require('../js/product-core.js').mailchimpJsonpUrl(url, 'a@b.co', 'cb');
    assert.ok(jsonp, 'mailchimpUrl is not a Mailchimp https subscribe URL with u and id');
    const q = new URL(jsonp).searchParams;
    assert.ok(q.has(`b_${q.get('u')}_${q.get('id')}`), 'honeypot field name');
  });

  test(`${page}: one price everywhere, a real launch date, and cache-busted shared assets`, () => {
    const prices = new Set([...html.matchAll(/\$\d+\.\d\d/g)].map((m) => m[0]));
    const jsonPrice = /"price"\s*:\s*"?(\d+\.\d\d)/.exec(html);
    assert.ok(prices.size <= 1, `different prices on the page: ${[...prices]}`);
    if (jsonPrice) assert.equal('$' + jsonPrice[1], [...prices][0]);
    const lm = /launch:\s*'(\d{4}-\d{2}-\d{2})'/.exec(html);      // pages already on sale have no launch date
    assert.match(html, /<link href="\.\.\/css\/product-page\.css\?v=\w+"/);
    assert.match(html, /<script src="\.\.\/js\/product-page\.js\?v=\w+"/);
    if (!lm) return;
    assert.ok(!Number.isNaN(Date.parse(lm[1])));
    // launch date, as shown to people, must be the configured one
    const label = require('../js/product-core.js').launchLabel(lm[1]);
    assert.ok(html.includes(label), `page text does not mention ${label}`);
  });
}
