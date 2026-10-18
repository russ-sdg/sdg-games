// Builds the book cards on books.html from js/books-data.js (needs it loaded first).
(function () {
  var data = window.SDGBooks, list = document.getElementById('book-list');
  if (!data || !list) return;
  var esc = function (t) { return String(t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };

  list.innerHTML = data.BOOKS.map(function (b) {
    var w = b.coverSize[0], h = b.coverSize[1];
    return '<li class="bk-card" data-i="' + data.BOOKS.indexOf(b) + '">' +
      '<div class="bk-card-cover">' + (data.onSale(b) ? '<span class="bk-badge">Sale</span>' : '') +
      '<img src="' + b.cover + '-480.webp" srcset="' + b.cover + '-480.webp 480w, ' + b.cover + '-820.webp 820w" sizes="(max-width: 560px) 80vw, 300px" width="' + w + '" height="' + h + '" loading="lazy" alt="' + esc(b.coverAlt) + '" /></div>' +
      '<div class="bk-card-body"><p class="bk-tag">' + esc(b.tags.join(' · ')) + (b.audio ? ' · Audiobook' : '') + '</p>' +
      '<h2><a href="' + b.slug + '/index.html">' + esc(b.title) + '</a></h2>' +
      (b.subtitle ? '<p class="bk-card-sub">' + esc(b.subtitle) + '</p>' : '') +
      '<p class="bk-card-blurb">' + esc(b.blurb) + '</p>' +
      '<ul class="bk-chips" aria-label="Formats">' + b.formats.map(function (f) { return '<li>' + esc(f.name) + ' <b>$' + esc(f.price) + '</b></li>'; }).join('') + '</ul>' +
      '<p class="bk-card-go"><span>From <strong>$' + data.lowestPrice(b) + '</strong></span><span aria-hidden="true">Read more &rarr;</span></p></div></li>';
  }).join('');

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
