// Builds the game cards on games.html from js/games-data.js (needs js/product-core.js and it loaded first).
(function () {
  var data = window.SDGGames, list = document.getElementById('game-list');
  if (!data || !list) return;
  var esc = function (t) { return String(t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };

  list.innerHTML = data.GAMES.map(function (g, i) {
    var soon = data.upcoming(g), note = soon ? 'Launching ' + data.launchLabel(g.launch) : g.badge;
    return '<li class="gm-card" data-i="' + i + '">' +
      '<div class="gm-art">' + (note ? '<span class="gm-badge">' + esc(note) + '</span>' : '') +
      '<img src="assets/games/' + g.art + '.webp" width="450" height="300" loading="lazy" alt="' + esc(g.artAlt) + '" /></div>' +
      '<div class="gm-body"><p class="gm-tag">' + esc(g.tags.join(' · ')) + '</p>' +
      '<h2><a href="' + esc(data.href(g)) + '">' + esc(g.title) + '</a></h2>' +
      '<p class="gm-blurb">' + esc(g.blurb) + '</p>' +
      (g.facts.length ? '<ul class="gm-chips" aria-label="Game facts">' + g.facts.map(function (f) { return '<li>' + esc(f) + '</li>'; }).join('') + '</ul>' : '') +
      '<p class="gm-go"><span class="gm-price">' + (soon ? '' : (g.was ? '<s><span class="pp-sr">Was </span>$' + esc(g.was) + '</s> ' : '') + '<strong>' + esc(data.priceText(g)) + '</strong>') + '</span>' +
      '<span class="gm-more" aria-hidden="true">' + (g.url ? 'Play now' : 'Learn more') + ' &rarr;</span></p>' +
      (g.online && !g.url ? '<p class="gm-online"><a href="' + esc(g.online) + '">Play free online</a></p>' : '') + '</div></li>';
  }).join('');

  var keys = data.filterKeys(data.GAMES), bar = document.getElementById('game-filter');
  if (!keys.length || !bar) return;
  bar.hidden = false;
  bar.innerHTML = ['All'].concat(keys).map(function (k, i) { return '<button type="button" class="pp-chip" aria-pressed="' + (i === 0) + '" data-key="' + (i ? esc(k) : '') + '">' + esc(k) + '</button>'; }).join('');
  bar.addEventListener('click', function (e) {
    var btn = e.target.closest && e.target.closest('button');
    if (!btn) return;
    [].forEach.call(bar.children, function (c) { c.setAttribute('aria-pressed', String(c === btn)); });
    [].forEach.call(list.children, function (li) { li.hidden = !data.matches(data.GAMES[li.getAttribute('data-i')], btn.getAttribute('data-key')); });
  });
})();
