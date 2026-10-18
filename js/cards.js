// HTML for the cards on the games, books and home pages (pure string builders, so tests can run them in Node).
// Each builder takes the item, its index in the list, and the data module (SDGGames or SDGBooks) that has the helpers.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SDGCards = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  function gameCard(g, i, D, now) {
    const soon = D.upcoming(g, now), note = soon ? 'Coming soon' : g.badge;
    const price = soon ? `Launching ${esc(D.launchLabel(g.launch))}`
      : (g.was ? `<s><span class="pp-sr">Was </span>$${esc(g.was)}</s> ` : '') + `<strong>${esc(D.priceText(g))}</strong>`;
    return `<li class="gm-card" data-i="${i}">` +
      `<div class="gm-art">${note ? `<span class="gm-badge">${esc(note)}</span>` : ''}` +
      `<img src="assets/games/${g.art}.webp" width="450" height="300" loading="lazy" alt="${esc(g.artAlt)}" /></div>` +
      `<div class="gm-body"><p class="gm-tag">${esc(g.tags.join(' · '))}</p>` +
      `<h2><a href="${esc(D.href(g))}">${esc(g.title)}</a></h2>` +
      `<p class="gm-blurb">${esc(g.blurb)}</p>` +
      (g.facts.length ? `<ul class="gm-chips" aria-label="Game facts">${g.facts.map((f) => `<li>${esc(f)}</li>`).join('')}</ul>` : '') +
      `<p class="gm-go"><span class="gm-price${soon ? ' is-soon' : ''}">${price}</span>` +
      `<span class="gm-more" aria-hidden="true">${g.url ? 'Play now' : 'Learn more'} &rarr;</span></p>` +
      (g.online && !g.url ? `<p class="gm-online"><a href="${esc(g.online)}">Play free online</a></p>` : '') + '</div></li>';
  }

  function bookCard(b, i, D) {
    const [w, h] = b.coverSize;
    return `<li class="bk-card" data-i="${i}">` +
      `<div class="bk-card-cover">${D.onSale(b) ? '<span class="bk-badge">Sale</span>' : ''}` +
      `<img src="${b.cover}-480.webp" srcset="${b.cover}-480.webp 480w, ${b.cover}-820.webp 820w" sizes="(max-width: 560px) 80vw, 300px" width="${w}" height="${h}" loading="lazy" alt="${esc(b.coverAlt)}" /></div>` +
      `<div class="bk-card-body"><p class="bk-tag">${esc(b.tags.join(' · '))}${b.audio ? ' · Audiobook' : ''}</p>` +
      `<h2><a href="${b.slug}/index.html">${esc(b.title)}</a></h2>` +
      (b.subtitle ? `<p class="bk-card-sub">${esc(b.subtitle)}</p>` : '') +
      `<p class="bk-card-blurb">${esc(b.blurb)}</p>` +
      `<ul class="bk-chips" aria-label="Formats">${b.formats.map((f) => `<li>${esc(f.name)} <b>$${esc(f.price)}</b></li>`).join('')}</ul>` +
      `<p class="bk-card-go"><span>From <strong>$${D.lowestPrice(b)}</strong></span><span aria-hidden="true">Read more &rarr;</span></p></div></li>`;
  }

  // a clothing item from the Printify shop (see js/clothing-data.js)
  function shirtCard(s) {
    return '<li class="gm-card is-shirt">' +
      `<div class="gm-art"><img src="assets/home/${s.art}.webp" width="${s.artSize[0]}" height="${s.artSize[1]}" loading="lazy" alt="${esc(s.artAlt)}" /></div>` +
      `<div class="gm-body"><p class="gm-tag">Clothing</p><h2><a href="${esc(s.url)}">${esc(s.title)}</a></h2>` +
      `<p class="gm-blurb">${esc(s.blurb)}</p>` +
      '<p class="gm-go"><span class="gm-price"></span><span class="gm-more" aria-hidden="true">Shop &rarr;</span></p></div></li>';
  }

  return { esc, gameCard, bookCard, shirtCard };
});
