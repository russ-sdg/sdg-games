// Pure helpers for the product pages (no DOM). Loaded in the browser as window.SDGCore and by the
// tests in Node with require().
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SDGCore = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  const parseDate = (iso) => {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
    return m ? { y: +m[1], m: +m[2], d: +m[3] } : null;
  };

  // "2026-11-15" -> "November 15, 2026" (fixed English names, so it never depends on the visitor's locale)
  function launchLabel(iso) {
    const p = parseDate(iso);
    return p ? `${MONTHS[p.m - 1]} ${p.d}, ${p.y}` : '';
  }

  // Whole calendar days from `now` (the visitor's local date) until the launch date; negative once it has passed.
  function daysUntil(iso, now = new Date()) {
    const p = parseDate(iso);
    if (!p) return null;
    const launch = Date.UTC(p.y, p.m - 1, p.d);
    const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
    return Math.round((launch - today) / 86400000);
  }

  function countdownText(iso, now = new Date()) {
    const n = daysUntil(iso, now);
    if (n === null) return '';
    if (n > 1) return `${n} days to go`;
    if (n === 1) return 'tomorrow!';
    if (n === 0) return 'today!';
    return 'available now';
  }

  const isValidEmail = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(s || '').trim());

  // Mailchimp's "embedded form" action URL looks like
  //   https://<account>.us5.list-manage.com/subscribe/post?u=<hash>&id=<audience>&f_id=<form>
  // Its JSONP twin (.../subscribe/post-json) lets a page subscribe someone without leaving the page.
  // Returns null for anything that is not a Mailchimp https URL.
  function mailchimpJsonpUrl(action, email, callbackName, tags) {
    let u;
    try { u = new URL(action); } catch { return null; }
    if (u.protocol !== 'https:' || !/(^|\.)list-manage\.com$/.test(u.hostname)) return null;
    const uid = u.searchParams.get('u');
    const id = u.searchParams.get('id');
    if (!uid || !id || !/^\/subscribe\/post(-json)?$/.test(u.pathname)) return null;
    const q = new URLSearchParams({ u: uid, id });
    const fid = u.searchParams.get('f_id');
    if (fid) q.set('f_id', fid);
    q.set('EMAIL', String(email).trim());
    if (tags && tags.length) q.set('tags', tags.join(','));
    q.set(`b_${uid}_${id}`, '');          // Mailchimp's bot honeypot: must stay empty
    q.set('c', callbackName);
    return `${u.origin}/subscribe/post-json?${q}`;
  }

  // Mailchimp's JSON answers carry HTML and a leading "0 - " on errors; turn that into one friendly sentence.
  function friendlyMailchimpMessage(result, msg) {
    const plain = String(msg || '').replace(/<[^>]*>/g, ' ').replace(/&amp;/g, '&').replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"')
      .replace(/^\s*\d+\s*-\s*/, '').replace(/\s+/g, ' ').trim();
    if (result === 'success') {
      // double opt-in audiences answer "Almost finished... confirm your email"; single opt-in ones just say thanks
      return /almost finished|confirm/i.test(plain)
        ? 'Thank you! Check your inbox and tap the confirmation link to finish signing up.'
        : "Thank you! You're on the list.";
    }
    if (/already subscribed/i.test(plain)) return "You're already on the list. Thank you!";
    if (/too many|recent signup|try again/i.test(plain)) return 'Please wait a moment and try again.';
    return plain || 'Sorry, that did not work. Please try again.';
  }

  return { launchLabel, daysUntil, countdownText, isValidEmail, mailchimpJsonpUrl, friendlyMailchimpMessage };
});
