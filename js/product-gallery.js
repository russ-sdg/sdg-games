// Card gallery for the product pages. Reads window.SDG_CARDS (made by the game's build-cards script) and fills:
//   [data-gallery]      a filterable grid of every card, each opening in the lightbox (js/product-page.js)
//   .pp-day[data-day]   the "six days" tiles that do not have artwork yet, using that day's first card
(function () {
  var data = window.SDG_CARDS;
  if (!data || !data.cards || !data.cards.length) return;
  var groups = {};
  data.groups.forEach(function (g) { groups[g.id] = g; });
  var isDay = function (id) { return /^day\d$/.test(id); };
  var title = function (c) { var g = groups[c.group]; return isDay(c.group) ? g.label + ' · ' + c.name : c.name; };
  var alt = function (c) { var g = groups[c.group]; return isDay(c.group) ? g.label + ' card: ' + c.name + '.' : c.name + ' card.'; };
  var srcset = function (c) { return c.widths.map(function (w) { return c.src + '-' + w + '.webp ' + w + 'w'; }).join(', '); };
  var full = function (c) { return c.src + '-' + c.widths[c.widths.length - 1] + '.webp'; };
  var esc = function (s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;'); };
  var img = function (c, sizes, lazy) {
    return '<img src="' + c.src + '-' + c.widths[0] + '.webp" srcset="' + srcset(c) + '" sizes="' + sizes + '" width="' + c.w + '" height="' + c.h + '"' +
      (lazy ? ' loading="lazy"' : '') + ' alt="' + esc(alt(c)) + '" />';
  };

  // ---- the "six days" tiles: fill any that have no artwork yet ---------------------------------------------
  document.querySelectorAll('.pp-day[data-day]').forEach(function (li) {
    var art = li.querySelector('.pp-day-art');
    if (!art || li.querySelector('.pp-zoom')) return;
    var c = data.cards.filter(function (x) { return x.group === 'day' + li.getAttribute('data-day'); })[0];
    if (!c) return;
    var n = li.getAttribute('data-day');
    art.outerHTML = '<button type="button" class="pp-zoom pp-day-art" data-zoom="' + full(c) + '" data-caption="' + esc(title(c)) + '">' +
      img(c, '(max-width: 860px) 46vw, 360px', true) + '<span class="badge-n" aria-hidden="true">' + n + '</span></button>';
  });

  // ---- gallery ---------------------------------------------------------------------------------------------------
  var host = document.querySelector('[data-gallery]');
  if (!host) return;
  host.hidden = false;
  host.querySelector('[data-gallery-title]').textContent = data.total >= data.expected ? 'Browse all ' + data.total + ' cards' : 'A closer look at the cards';
  var counts = {};
  var back = data.back && { src: data.back.src, widths: data.back.widths, w: data.back.w, h: data.back.h, group: 'back', name: 'Card back' };
  if (back) counts.back = 1;
  data.cards.forEach(function (c) { counts[c.group] = (counts[c.group] || 0) + 1; });
  var chips = host.querySelector('.pp-chips'), grid = host.querySelector('.pp-grid');
  var order = [{ id: 'all', label: 'All', n: data.total }].concat(data.groups.filter(function (g) { return counts[g.id]; })
    .map(function (g) { return { id: g.id, label: g.label, n: counts[g.id] }; }))
    .concat(back ? [{ id: 'back', label: 'Card back', n: 1 }] : []);
  chips.innerHTML = order.map(function (o, i) {
    return '<button type="button" class="pp-chip" data-filter="' + o.id + '" aria-pressed="' + (i === 0) + '">' + esc(o.label) + ' <span>' + o.n + '</span></button>';
  }).join('');
  grid.innerHTML = data.cards.concat(back ? [back] : []).map(function (c) {
    return '<li data-group="' + c.group + '"><button type="button" class="pp-zoom" data-zoom="' + full(c) + '" data-caption="' + esc(title(c)) + '">' +
      img(c, '(max-width: 560px) 46vw, (max-width: 860px) 30vw, 260px', true) + '</button><p>' + esc(title(c)) + '</p></li>';
  }).join('');
  chips.addEventListener('click', function (e) {
    var b = e.target.closest('[data-filter]');
    if (!b) return;
    var f = b.getAttribute('data-filter');
    chips.querySelectorAll('.pp-chip').forEach(function (x) { x.setAttribute('aria-pressed', x === b); });
    grid.querySelectorAll('li').forEach(function (li) { li.hidden = f !== 'all' && li.getAttribute('data-group') !== f; });
  });
})();
