// Builds the game cards on games.html from js/games-data.js (needs js/product-core.js, js/cards.js and it loaded first).
(function () {
  var data = window.SDGGames, list = document.getElementById('game-list');
  if (!data || !list) return;
  var esc = SDGCards.esc;
  list.innerHTML = data.GAMES.map(function (g, i) { return SDGCards.gameCard(g, i, data); }).join('');

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
