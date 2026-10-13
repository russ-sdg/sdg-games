// Roman Catacombs: the books of the Bible, the seven categories and the 90-card deck.
// (The card list is the one the deck-building tool roman-catacombs/tools/build-cards.py reads.)

// Category order is the scorecard's, top to bottom. `first` / `second` are the points for completing the
// category first / after someone else. `color` matches the ring colors on the printed scorecard.
export const CATS = [
  { id: 'pentateuch', label: 'Pentateuch', first: 9, second: 6, color: '#e8281f', ink: '#b81c14', books: ['Genesis', 'Exodus', 'Leviticus', 'Numbers', 'Deuteronomy'] },
  { id: 'historical', label: 'Historical Books', first: 7, second: 5, color: '#ee6f1e', ink: '#a8460a', books: ['Joshua', 'Judges', 'Ruth', '1 Samuel', '2 Samuel', '1 Kings', '2 Kings', '1 Chronicles', '2 Chronicles', 'Ezra', 'Nehemiah', 'Esther'] },
  { id: 'wisdom', label: 'Wisdom Books', first: 10, second: 7, color: '#c8472a', ink: '#a8321d', books: ['Job', 'Psalms', 'Proverbs', 'Ecclesiastes', 'Song of Solomon'] },
  { id: 'prophets', label: 'Prophets', first: 6, second: 4, color: '#1f7a1f', ink: '#1a661a', books: ['Isaiah', 'Jeremiah', 'Lamentations', 'Ezekiel', 'Daniel', 'Hosea', 'Joel', 'Amos', 'Obadiah', 'Jonah', 'Micah', 'Nahum', 'Habakkuk', 'Zephaniah', 'Haggai', 'Zechariah', 'Malachi'] },
  { id: 'gospels', label: 'Gospels & Acts', first: 9, second: 6, color: '#1f1fe0', ink: '#1a1ab8', books: ['Matthew', 'Mark', 'Luke', 'John', 'Acts'] },
  { id: 'paul', label: "Paul's Epistles", first: 7, second: 5, color: '#3d1a7a', ink: '#3d1a7a', books: ['Romans', '1 Corinthians', '2 Corinthians', 'Galatians', 'Ephesians', 'Philippians', 'Colossians', '1 Thessalonians', '2 Thessalonians', '1 Timothy', '2 Timothy', 'Titus', 'Philemon'] },
  { id: 'general', label: 'General Epistles & Revelation', first: 8, second: 5, color: '#8a1fe8', ink: '#6b14b8', books: ['Hebrews', 'James', '1 Peter', '2 Peter', '1 John', '2 John', '3 John', 'Jude', 'Revelation'] },
];

// All 66 books in canon order; `book` numbers elsewhere are indexes into this list (0-65).
export const BOOKS = [];
CATS.forEach((c, ci) => {
  c.lo = BOOKS.length;
  c.books.forEach((name) => BOOKS.push({ name, cat: ci }));
  c.hi = BOOKS.length - 1;
});

export const SLOTS = CATS.length * 3;      // 21 slots: slot s is in category floor(s / 3)

// The 90 cards (one image each, assets/roman-catacombs/cards/<id>-250.webp).
export const DECK = ["1Chronicles1v1", "1Corinthians1v2", "1John1v1", "1John2v1", "1Kings1v1", "1Peter1v1", "1Peter2v1", "1Samuel1v1", "1Thessalonians1v2", "1Timothy1v2", "2Chronicles1v1", "2Corinthians1v2", "2John1v1", "2Kings1v1", "2Peter1v1", "2Samuel1v1", "2Thessalonians1v2", "2Timothy1v2", "3John1v1", "Acts1v1", "Amos1v1", "Colossians1v2", "Daniel1v1", "Deuteronomy1v1", "Deuteronomy2v2", "Ecclesiastes1v1", "Ecclesiastes2v1", "Ephesians1v2", "Esther1v1", "Exodus1v1", "Exodus2v1", "Exodus3v1", "Ezekiel1v1", "Ezra1v1", "Galatians1v2", "Genesis1v1", "Genesis2v1", "Habakkuk1v1", "Haggai1v1", "Hebrews1v1", "Hosea1v1", "Isaiah1v1", "James1v1", "James2v1", "Jeremiah1v1", "Job1v1", "Job2v1", "Joel1v1", "John1v1", "John2v1", "John3v1", "Jonah1v1", "Joshua1v1", "Jude1v1", "Judges1v1", "Lamentations1v1", "Leviticus1v1", "Leviticus2v1", "Leviticus3v1", "Luke1v1", "Luke2v1", "Luke3v1", "Malachi1v1", "Mark1v1", "Mark2v1", "Mark3v1", "Matthew1v1", "Matthew2v1", "Micah1v1", "Nahum1v1", "Nehemiah1v1", "Numbers1v1", "Numbers2v1", "Obadiah1v1", "Philemon1v2", "Philippians1v2", "Proverbs1v1", "Proverbs2v1", "Proverbs3v1", "Psalms1v1", "Psalms2v1", "Psalms3v1", "Psalms4v1", "Revelation1v1", "Romans1v2", "Ruth1v1", "Song1v1", "Titus1v2", "Zechariah1v1", "Zephaniah1v1"];

// 'Song1v1' -> Song of Solomon; '1John2v1' -> 1 John
const TOKEN = Object.fromEntries(BOOKS.map((b, i) => [b.name.replace(/ /g, '').replace('ofSolomon', ''), i]));
export function cardBook(id) {
  const t = id.replace(/\d+v\d+$/, '');
  if (!(t in TOKEN)) throw new Error('unknown card ' + id);
  return TOKEN[t];
}
