const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../js/product-core.js');

test('launch date label is fixed English, whatever the locale', () => {
  assert.equal(C.launchLabel('2026-11-15'), 'November 15, 2026');
  assert.equal(C.launchLabel('2027-01-05'), 'January 5, 2027');
  assert.equal(C.launchLabel('nonsense'), '');
});

test('days until launch counts calendar days from the visitor\'s local date', () => {
  assert.equal(C.daysUntil('2026-11-15', new Date(2026, 9, 13, 23, 59)), 33);   // Oct 13 -> Nov 15
  assert.equal(C.daysUntil('2026-11-15', new Date(2026, 9, 13, 0, 1)), 33);      // time of day does not matter
  assert.equal(C.daysUntil('2026-11-15', new Date(2026, 10, 14, 12, 0)), 1);
  assert.equal(C.daysUntil('2026-11-15', new Date(2026, 10, 15, 12, 0)), 0);
  assert.equal(C.daysUntil('2026-11-15', new Date(2026, 10, 16, 12, 0)), -1);
  assert.equal(C.daysUntil('bad'), null);
});

test('countdown wording', () => {
  assert.equal(C.countdownText('2026-11-15', new Date(2026, 9, 13)), '33 days to go');
  assert.equal(C.countdownText('2026-11-15', new Date(2026, 10, 14)), 'tomorrow!');
  assert.equal(C.countdownText('2026-11-15', new Date(2026, 10, 15)), 'today!');
  assert.equal(C.countdownText('2026-11-15', new Date(2026, 10, 20)), 'available now');
});

test('email check is lenient but catches typos', () => {
  for (const ok of ['a@b.co', 'first.last+tag@example.com', ' me@x.org ']) assert.ok(C.isValidEmail(ok), ok);
  for (const bad of ['', 'a@b', 'a b@c.com', '@c.com', 'a@.com', null, undefined]) assert.ok(!C.isValidEmail(bad), String(bad));
});

const ACTION = 'https://sdggames.us5.list-manage.com/subscribe/post?u=abc123&id=def456&f_id=0099aa';

test('mailchimp: the embedded-form URL becomes a JSONP subscribe URL with the honeypot left empty', () => {
  const url = new URL(C.mailchimpJsonpUrl(ACTION, ' fan@example.com ', 'cb1', [123, 456]));
  assert.equal(url.origin, 'https://sdggames.us5.list-manage.com');
  assert.equal(url.pathname, '/subscribe/post-json');
  assert.equal(url.searchParams.get('u'), 'abc123');
  assert.equal(url.searchParams.get('id'), 'def456');
  assert.equal(url.searchParams.get('f_id'), '0099aa');
  assert.equal(url.searchParams.get('EMAIL'), 'fan@example.com');
  assert.equal(url.searchParams.get('tags'), '123,456');
  assert.equal(url.searchParams.get('b_abc123_def456'), '');
  assert.equal(url.searchParams.get('c'), 'cb1');
});

test('mailchimp: anything that is not a Mailchimp https subscribe URL is refused', () => {
  for (const bad of ['', 'not a url', 'http://x.us5.list-manage.com/subscribe/post?u=a&id=b', 'https://evil.example.com/subscribe/post?u=a&id=b',
    'https://x.list-manage.com.evil.com/subscribe/post?u=a&id=b', 'https://x.us5.list-manage.com/other?u=a&id=b', 'https://x.us5.list-manage.com/subscribe/post?id=b']) {
    assert.equal(C.mailchimpJsonpUrl(bad, 'a@b.co', 'cb'), null, bad);
  }
  assert.equal(new URL(C.mailchimpJsonpUrl('https://x.us5.list-manage.com/subscribe/post-json?u=a&id=b', 'a@b.co', 'cb')).pathname, '/subscribe/post-json');
});

test('mailchimp: the email is encoded safely in the URL', () => {
  const url = C.mailchimpJsonpUrl(ACTION, 'a&b=c@example.com', 'cb');
  assert.equal(new URL(url).searchParams.get('EMAIL'), 'a&b=c@example.com');
  assert.ok(!/EMAIL=a&b/.test(url));
});

test('mailchimp messages become one friendly sentence', () => {
  assert.match(C.friendlyMailchimpMessage('success', 'Almost finished...'), /^Thank you!/);
  assert.equal(C.friendlyMailchimpMessage('error', '0 - Please enter a value'), 'Please enter a value');
  assert.equal(C.friendlyMailchimpMessage('error', 'x@y.com is already subscribed to list SDG Games. <a href="https://x">Click here to update your profile.</a>'), "You're already on the list. Thank you!");
  assert.equal(C.friendlyMailchimpMessage('error', 'Too many subscribe attempts for this email address'), 'Please wait a moment and try again.');
  assert.equal(C.friendlyMailchimpMessage('error', ''), 'Sorry, that did not work. Please try again.');
  assert.ok(!/</.test(C.friendlyMailchimpMessage('error', '1 - <b>Bad</b> &amp; wrong')));
});
