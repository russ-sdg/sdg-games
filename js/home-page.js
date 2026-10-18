// Builds the home page: the featured games, books and clothing, and the free online games.
// Needs js/product-core.js, js/cards.js, js/games-data.js, js/books-data.js and js/clothing-data.js loaded first.
(function () {
  var G = window.SDGGames, B = window.SDGBooks, C = window.SDGClothing, K = window.SDGCards;
  if (!G || !B || !C || !K) return;
  var esc = K.esc;
  var put = function (id, html) { var el = document.getElementById(id); if (el) el.innerHTML = html; };

  put('featured-games', G.GAMES.map(function (g, i) { return g.featured ? K.gameCard(g, i, G) : ''; }).join(''));
  put('featured-books', B.BOOKS.map(function (b, i) { return b.featured ? K.bookCard(b, i, B) : ''; }).join(''));
  put('featured-clothing', C.CLOTHING.map(function (s) { return s.featured ? K.shirtCard(s) : ''; }).join(''));
  put('free-games', G.GAMES.filter(function (g) { return g.online; }).map(function (g) {
    return '<li><a href="' + esc(g.online) + '"><img src="assets/games/' + g.art + '.webp" width="450" height="300" loading="lazy" alt="" /><span>' + esc(g.title) + '<small>Play free</small></span></a></li>';
  }).join(''));
})();
