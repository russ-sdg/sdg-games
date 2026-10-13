// Behaviour shared by the SDG Games product pages. Needs js/product-core.js first.
// Per-page settings come from window.SDG_PRODUCT (see 6days/index.html):
//   launch        'YYYY-MM-DD' launch date (shown, and counted down to)
//   mailchimpUrl  the "embedded form" action URL from Mailchimp (empty = signup shows a preview message)
//   mailchimpTags optional Mailchimp tag ids to put on new subscribers (e.g. one per game)
//   productId     Shopify product id; setting it switches the page from "notify me" to "buy now"
//   buttonText    text of the Shopify buy button
(function () {
  var core = window.SDGCore;
  var cfg = window.SDG_PRODUCT || {};
  var root = document.querySelector('.pp');
  if (!core || !root) return;

  // ---- launch date and countdown -----------------------------------------------
  document.querySelectorAll('[data-launch-date]').forEach(function (el) { el.textContent = core.launchLabel(cfg.launch); });
  document.querySelectorAll('[data-countdown]').forEach(function (el) { el.textContent = core.countdownText(cfg.launch); });

  // ---- tabs: highlight the section being read ------------------------------------
  var links = [].slice.call(document.querySelectorAll('.pp-tabs nav a[href^="#"]'));
  if ('IntersectionObserver' in window && links.length) {
    var byId = {};
    links.forEach(function (a) { byId[a.getAttribute('href').slice(1)] = a; });
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        links.forEach(function (a) { a.removeAttribute('aria-current'); });
        var a = byId[e.target.id];
        if (a) {
          a.setAttribute('aria-current', 'true');
          var nav = a.parentNode;                      // keep the active tab in view on phones
          if (nav.scrollWidth > nav.clientWidth) nav.scrollLeft = a.offsetLeft - nav.clientWidth / 2 + a.clientWidth / 2;
        }
      });
    }, { rootMargin: '-40% 0px -55% 0px' });
    Object.keys(byId).forEach(function (id) { var s = document.getElementById(id); if (s) io.observe(s); });
  }

  // ---- lightbox for card art ---------------------------------------------------------
  var zoomers = [].slice.call(document.querySelectorAll('[data-zoom]'));
  if (zoomers.length && typeof HTMLDialogElement === 'function') {
    var dlg = document.createElement('dialog');
    dlg.className = 'pp-lightbox';
    dlg.setAttribute('aria-label', 'Card viewer');
    dlg.innerHTML = '<figure><img alt=""><figcaption></figcaption></figure><div class="bar"><button type="button" data-d="-1">&larr; Previous</button><button type="button" data-d="1">Next &rarr;</button><button type="button" data-d="0">Close</button></div>';
    document.body.appendChild(dlg);
    var img = dlg.querySelector('img'), cap = dlg.querySelector('figcaption'), cur = 0;
    var show = function (i) {
      cur = (i + zoomers.length) % zoomers.length;
      img.src = zoomers[cur].getAttribute('data-zoom');
      img.alt = cap.textContent = zoomers[cur].getAttribute('data-caption') || '';
    };
    zoomers.forEach(function (z, i) { z.addEventListener('click', function () { show(i); dlg.showModal(); }); });
    dlg.addEventListener('click', function (e) {
      var d = e.target.getAttribute && e.target.getAttribute('data-d');
      if (d === '0' || e.target === dlg) dlg.close();
      else if (d) show(cur + Number(d));
    });
    dlg.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowLeft') show(cur - 1);
      if (e.key === 'ArrowRight') show(cur + 1);
    });
  }

  // ---- "notify me" signup -> Mailchimp -------------------------------------------------------
  var seq = 0;
  document.querySelectorAll('form.pp-signup').forEach(function (form) {
    var input = form.querySelector('input[type=email]');
    var msg = form.querySelector('.pp-signup-msg');
    var btn = form.querySelector('button');
    var say = function (text, ok) { msg.textContent = text; msg.className = 'pp-signup-msg ' + (ok ? 'is-ok' : 'is-err'); };
    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var email = input.value.trim();
      if (form.querySelector('.pp-honey').value) return say('Thank you!', true);        // a bot filled the hidden field
      if (!core.isValidEmail(email)) return say('Please enter a valid email address.', false);
      if (!cfg.mailchimpUrl) {            // Mailchimp not connected yet: be honest and point people somewhere useful
        msg.className = 'pp-signup-msg is-ok';
        msg.innerHTML = 'Email signup is opening very soon. For now, follow <a href="https://blog.sdggames.fun/" style="color:inherit;text-decoration:underline">our news</a> for the launch announcement.';
        return;
      }
      var cb = 'sdgMailchimp' + (++seq);
      var url = core.mailchimpJsonpUrl(cfg.mailchimpUrl, email, cb, cfg.mailchimpTags);
      if (!url) return say('The signup is not set up correctly yet. Please try again later.', false);
      btn.disabled = true;
      say('Signing you up…', true);
      var script = document.createElement('script');
      var done = false;
      var finish = function () { done = true; btn.disabled = false; clearTimeout(timer); delete window[cb]; script.remove(); };
      // if the JSON reply never arrives (blocked script, slow network), fall back to Mailchimp's own page in a new tab
      var fallback = function () {
        if (done) return;
        finish();
        var f = document.createElement('form');
        f.method = 'POST'; f.target = '_blank'; f.action = cfg.mailchimpUrl.replace('/post-json', '/post');
        var e = document.createElement('input'); e.type = 'hidden'; e.name = 'EMAIL'; e.value = email; f.appendChild(e);
        document.body.appendChild(f); f.submit(); f.remove();
        say('Opening Mailchimp to finish your signup…', true);
      };
      var timer = setTimeout(fallback, 9000);
      window[cb] = function (data) {
        if (done) return;
        finish();
        var ok = data && data.result === 'success';
        say(core.friendlyMailchimpMessage(data && data.result, data && data.msg), ok);
        if (ok) form.reset();
      };
      script.onerror = fallback;
      script.src = url;
      document.head.appendChild(script);
    });
  });

  // ---- launch day: swap "notify me" for the Shopify buy button -----------------------------------
  if (cfg.productId) {
    root.classList.add('pp-live');
    document.querySelectorAll('[data-state=soon]').forEach(function (el) { el.hidden = true; });
    document.querySelectorAll('[data-state=live]').forEach(function (el) { el.hidden = false; });
    var load = function () {
      if (window.ShopifyBuy && window.ShopifyBuy.UI) return init();
      var s = document.createElement('script');
      s.async = true;
      s.src = 'https://sdks.shopifycdn.com/buy-button/latest/buy-button-storefront.min.js';
      s.onload = init;
      document.head.appendChild(s);
    };
    var init = function () {
      var client = window.ShopifyBuy.buildClient({ domain: 'bd30ce-2.myshopify.com', storefrontAccessToken: '7bf5f03bf3c7ba399d3ef67f8250c103' });
      window.ShopifyBuy.UI.onReady(client).then(function (ui) {
        document.querySelectorAll('.pp-shopify').forEach(function (node) {
          ui.createComponent('product', {
            id: cfg.productId, node: node, moneyFormat: '%24%7B%7Bamount%7D%7D',
            options: { product: {
              styles: { product: { '@media (min-width: 601px)': { 'max-width': '100%', 'margin-left': '0', 'margin-bottom': '0' } },
                button: { 'font-family': 'Avant Garde, sans-serif', 'font-size': '16px', 'padding': '15px 28px', 'background-color': '#323ef9', 'border-radius': '6px',
                  ':hover': { 'background-color': '#2d38e0' }, ':focus': { 'background-color': '#2d38e0' } } },
              contents: { img: false, title: false, price: false },
              text: { button: cfg.buttonText || 'Buy now' } } },
          });
        });
      });
    };
    load();
  }
})();
