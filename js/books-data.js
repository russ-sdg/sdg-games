// The list of books shown on books.html. To add a book: build its product page (copy a folder such as FPtF/), run
// Books/tools/build-book-art.py for its cover, and add one entry below. tests/books-page.test.js checks the entry
// against the product page. Books appear in this order.
//   slug      folder of the product page (books.html links to <slug>/index.html)
//   cover     image path without size or extension: <cover>-480.webp and <cover>-820.webp must exist
//   tags      what kind of book it is; becomes the filter buttons once there are more than FILTER_AFTER books
//   formats   name and price (as on the product page); `was` is the struck-through list price, if any
//   audio     true if an audiobook is sold
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SDGBooks = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const BOOKS = [
    {
      slug: 'tyndale_book', title: 'Tyndale', subtitle: 'A Man After God’s Own Word', tags: ['Historical fiction'], audio: true,
      cover: 'assets/books/tyndale/cover', coverSize: [480, 807], coverAlt: 'Cover of Tyndale: A Man After God’s Own Word',
      blurb: 'Pursued by spies, betrayed by a friend and hunted by Church and Crown, William Tyndale risks everything to put the Bible in English.',
      formats: [{ name: 'Paperback', price: '7.50', was: '9.99' }, { name: 'E-Book', price: '5.00', was: '7.00' }, { name: 'Audiobook', price: '5.00' }],
    },
    {
      slug: 'FPtF', title: 'From Persecution to Freedom', subtitle: 'Particular Baptists Steadfast in Conviction, Sustained by God', tags: ['Historical fiction'], audio: true,
      cover: 'assets/books/fptf/cover', coverSize: [480, 768], coverAlt: 'Cover of From Persecution to Freedom',
      blurb: 'Benjamin Coxe and his son Nehemiah stand firm through persecution, all the way to the Confession of 1689.',
      formats: [{ name: 'Paperback', price: '7.50', was: '9.99' }, { name: 'E-Book', price: '5.00', was: '7.00' }, { name: 'Audiobook', price: '5.00' }],
    },
    {
      slug: 'WICRBC', title: 'What is a Confessional Reformed Baptist Church?', subtitle: '', tags: ['Nonfiction'], audio: false,
      cover: 'assets/books/wicrbc/cover', coverSize: [480, 724], coverAlt: 'Cover of What is a Confessional Reformed Baptist Church?',
      blurb: 'A layman’s plain-language answer to “what does that mean?”, built from the base out.',
      formats: [{ name: 'Paperback', price: '7.00', was: '9.99' }, { name: 'E-Book', price: '2.99' }],
    },
  ];
  const FILTER_AFTER = 6;

  const lowestPrice = (b) => b.formats.map((f) => Number(f.price)).reduce((a, c) => Math.min(a, c)).toFixed(2);
  const onSale = (b) => b.formats.some((f) => f.was);
  // filter buttons: every tag, plus "Audiobook" when any book has one; none until the list is long enough to need them
  function filterKeys(books) {
    if (books.length <= FILTER_AFTER) return [];
    const keys = [];
    books.forEach((b) => b.tags.forEach((t) => { if (!keys.includes(t)) keys.push(t); }));
    if (books.some((b) => b.audio)) keys.push('Audiobook');
    return keys;
  }
  const matches = (b, key) => !key || b.tags.includes(key) || (key === 'Audiobook' && b.audio);

  return { BOOKS, FILTER_AFTER, lowestPrice, onSale, filterKeys, matches };
});
