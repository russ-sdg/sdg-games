// The list of games shown on games.html. To add a game: build its product page (copy a folder such as Tyndale/), add its
// card art to Games/tools/build-game-art.py and run it, then add one entry below. tests/games-page.test.js checks the
// entry against the product page. Games appear in this order.
//   slug      folder of the product page (card links to <slug>/index.html unless `url` is set, e.g. a game on another site)
//   art       card picture: assets/games/<art>.webp, 450 x 300
//   tags      the kind of game; becomes the filter buttons once there are more than FILTER_AFTER games
//   facts     short facts shown as chips (players, ages, time). Only what the product page says.
//   price     as sold ('19.99'), or 'Free'; `was` is a struck-through list price, `badge` a short note such as 'Introductory pricing'
//   online    link to a free online version (relative to the site root, or a full URL), if there is one
//   launch    'YYYY-MM-DD' for a game not on sale yet: the card says "Coming soon" and "Launching <date>" until that day
//   featured  true to show the game on the home page (the home page shows the featured games, books and clothing in equal numbers)
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./product-core.js'));
  else root.SDGGames = factory(root.SDGCore);
})(typeof self !== 'undefined' ? self : this, function (core) {
  const GAMES = [
    { slug: '6days', title: 'Six Days', tags: ['Card game'], art: 'sixdays', artAlt: 'The Mankind card from Six Days, with the first man among the animals', price: '19.99', launch: '2026-11-14', featured: true,
      blurb: 'A family card game about the six days of creation: build them together, then score for yourself.', facts: ['2\u20136 players', 'Ages 12+', '72 cards'] },
    { slug: 'FotS', title: 'The Fruit of the Spirit', tags: ['Card game'], art: 'fots', artAlt: 'A tree with the nine fruit of the Spirit around it', price: '19.99',
      blurb: 'A take-that and give-that card game: be the first to collect all nine fruit of Galatians 5:22-23.', facts: ['Up to 4 players'] },
    { slug: 'fruity', title: 'Fruity', tags: ['Card game'], art: 'fruity', artAlt: 'A grid of fruit symbols', price: '12.99',
      blurb: 'A simple set-collecting card game that teaches pattern matching and the fruit of the Spirit.', facts: ['2–6 players', '5–10 min'] },
    { slug: 'illuminate', title: 'Illuminate', tags: ['Card game'], art: 'illuminate', artAlt: 'The four gospel writers’ symbols in coloured circles', price: '19.99',
      blurb: 'A trick-taking game with a Biblical twist: your role from the gospels turns matching cards into grace cards.', facts: [] },
    { slug: 'JfP', title: 'Journeys for Paul', tags: ['Board game'], art: 'jfp', artAlt: 'Journeys for Paul game art', price: '34.99', online: 'JfP/play/',
      blurb: 'Send three evangelists to the churches Paul planted.', facts: ['2–4 players', 'Ages 12+', '15–30 min'] },
    { slug: 'JtJ', title: 'Journeys through Jerusalem', tags: ['Board game'], art: 'jtj', artAlt: 'Journeys through Jerusalem game art', price: '49.99', featured: true,
      blurb: 'Follow Biblical characters through Jesus’ final days in Jerusalem and complete their journeys to score.', facts: ['2–6 players', '15–30 min'] },
    { slug: 'journeys-with-jesus', title: 'Journeys with Jesus', tags: ['Board game'], art: 'jwj', artAlt: 'Journeys with Jesus game art', price: '34.99',
      blurb: 'Travel with Jesus through the gospels, learning their geography and memorizing Scripture along the way.', facts: ['Up to 4 players', 'Ages 12+', '15–30 min'] },
    { slug: 'pk', title: 'Prophets & Kings', tags: ['Card game'], art: 'pk', artAlt: 'A crown and a scroll', price: '19.99',
      blurb: 'Build sets that match each Old Testament prophet with the kings of his day, or each king with his prophets.', facts: ['70 cards'] },
    { slug: 'roman-catacombs', title: 'Roman Catacombs', tags: ['Flip-and-write'], art: 'catacombs', artAlt: 'A figure with raised arms painted in a Roman catacomb', price: '34.99', online: 'roman-catacombs/play/',
      blurb: 'Be the librarian of a church in the catacombs of Rome and build a library of Scripture in canon order.', facts: ['1–6 players', 'Ages 12+', '15–30 min'] },
    { slug: 'RomanRoad', title: 'Roman Road', tags: ['Card game'], art: 'romanroad', artAlt: 'Roman Road game art', price: '34.99',
      blurb: 'A fast-paced, Nerts-style card game that presents the gospel through four verses from Romans.', facts: ['2–4 players', '15–30 min'] },
    { slug: '3x3', title: 'Three-by-Three', tags: ['Card game'], art: '3x3', artAlt: 'Three-by-Three game art', price: '9.99', was: '12.99', badge: 'Introductory pricing',
      blurb: 'A simple matching game based on the tribes of Israel: collect three sets of three.', facts: ['2–6 players', '10–20 min'] },
    { slug: 'Tyndale', title: 'Tyndale', tags: ['Board game'], art: 'tyndale', artAlt: 'William Tyndale, hunted across Europe', price: '49.99', online: 'Tyndale/play/', featured: true,
      blurb: 'One player is William Tyndale on the run, getting the Bible into English; everyone else hunts him by his clues.', facts: ['2–6 players', 'Ages 12+', '30–90 min'] },
    { slug: 'wordwords', url: 'https://wordwords.fun', title: 'WordWords', tags: ['Word game'], art: 'wordwords', artAlt: 'A word-guessing grid and keyboard', price: 'Free', online: 'https://wordwords.fun',
      blurb: 'A free word game you can play online.', facts: [] },
  ];
  const FILTER_AFTER = 6;
  const PLAY_ONLINE = 'Play online';

  const href = (g) => g.url || `${g.slug}/index.html`;
  const priceText = (g) => (g.price === 'Free' ? 'Free' : `$${g.price}`);
  // a game whose launch day has not come yet (the visitor's own date, as on the product page)
  const upcoming = (g, now = new Date()) => !!g.launch && core.daysUntil(g.launch, now) > 0;
  function filterKeys(games) {
    if (games.length <= FILTER_AFTER) return [];
    const keys = [];
    games.forEach((g) => g.tags.forEach((t) => { if (!keys.includes(t)) keys.push(t); }));
    if (games.some((g) => g.online)) keys.push(PLAY_ONLINE);
    return keys;
  }
  const matches = (g, key) => !key || g.tags.includes(key) || (key === PLAY_ONLINE && !!g.online);

  return { GAMES, FILTER_AFTER, href, priceText, upcoming, filterKeys, matches, launchLabel: core.launchLabel };
});
