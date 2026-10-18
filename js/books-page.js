// Builds the book cards on books.html from js/books-data.js (needs js/cards.js and it loaded first).
(function () {
  var data = window.SDGBooks, list = document.getElementById('book-list');
  if (!data || !list) return;
  var esc = SDGCards.esc;
  list.innerHTML = data.BOOKS.map(function (b, i) { return SDGCards.bookCard(b, i, data); }).join('');

  var keys = data.filterKeys(data.BOOKS), bar = document.getElementById('book-filter');
  if (!keys.length || !bar) return;
  bar.hidden = false;
  bar.innerHTML = ['All'].concat(keys).map(function (k, i) { return '<button type="button" class="pp-chip" aria-pressed="' + (i === 0) + '" data-key="' + (i ? esc(k) : '') + '">' + esc(k) + '</button>'; }).join('');
  bar.addEventListener('click', function (e) {
    var btn = e.target.closest && e.target.closest('button');
    if (!btn) return;
    [].forEach.call(bar.children, function (c) { c.setAttribute('aria-pressed', String(c === btn)); });
    [].forEach.call(list.children, function (li) { li.hidden = !data.matches(data.BOOKS[li.getAttribute('data-i')], btn.getAttribute('data-key')); });
  });
})();
