// Six Days sample game: the data and the rules check (no DOM). Loaded in the browser as window.SixDaysCore and by the
// tests in Node, which replay every move against the scoring rules printed on the page.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SixDaysCore = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  var DAYS = [
    { n: 1, name: 'Light', color: '#a85a05' },
    { n: 2, name: 'Sky', color: '#2a6fa8' },
    { n: 3, name: 'Earth, Seas, and Plants', color: '#2f7d46' },
    { n: 4, name: 'Sun, Moon, Stars', color: '#2a3490' },
    { n: 5, name: 'Birds and Fish', color: '#0b7777' },
    { n: 6, name: 'Animals and Mankind', color: '#8e4a3d' },
  ];
  var PLAYERS = ['Ann', 'Ben', 'Cy'];

  // One entry per move. kind: start (first card of a new day) | add | close (Evening & Morning) | discard
  var STEPS = [
    { kind: 'setup', text: 'Setup: Day 1 starts face-up in the middle of the table. It only needs 1 day card, so it is already full.' },
    { who: 'Ann', kind: 'start', day: 2, label: 'Sky', pts: 2, text: 'Ann draws a card and starts Day 2 by playing a Day 2 card next to Day 1. A new kind of creation on that day: 2 points.' },
    { who: 'Ben', kind: 'add', day: 2, label: 'Sky', pts: 1, text: 'Ben adds a second Sky card to the Day 2 stack. That kind is already there, so only 1 point. Day 2 now has its 2 cards, so it is full.' },
    { who: 'Cy', kind: 'close', day: 1, pts: 1, text: 'Cy plays an Evening & Morning card on the full Day 1: points equal to the day number, 1. Day 1 is closed.' },
    { who: 'Ann', kind: 'start', day: 3, label: 'Land', pts: 2, text: 'Ann starts Day 3 with a Land card: 2 points.' },
    { who: 'Ben', kind: 'close', day: 2, pts: 2, text: 'Ben closes the full Day 2 with Evening & Morning: 2 points.' },
    { who: 'Cy', kind: 'add', day: 3, label: 'Land', pts: 1, text: 'Cy adds another Land card to Day 3. That kind is already there, so only 1 point.' },
    { who: 'Ann', kind: 'discard', pts: 0, text: 'Ann has no useful play, so she discards a card face-up: 0 points.' },
    { who: 'Ben', kind: 'add', day: 3, label: 'Plants', pts: 2, text: 'Ben adds Plants to Day 3: a new kind, 2 points. Day 3 has its 3 cards, so it is full.' },
    { who: 'Cy', kind: 'close', day: 3, pts: 3, text: 'Cy closes Day 3 with Evening & Morning: 3 points. And so it goes, until all six days are full.' },
  ];

  function stateAt(i) {
    var stacks = DAYS.map(function () { return { cards: [], closed: false }; });
    stacks[0].cards.push('Light');
    var pts = {};
    PLAYERS.forEach(function (p) { pts[p] = 0; });
    for (var k = 1; k <= i; k++) {
      var s = STEPS[k];
      if (s.kind === 'start' || s.kind === 'add') stacks[s.day - 1].cards.push(s.label);
      if (s.kind === 'close') stacks[s.day - 1].closed = true;
      if (s.who) pts[s.who] += s.pts;
    }
    return { stacks: stacks, pts: pts, last: i > 0 ? STEPS[i] : null };
  }

  // Replays the sample game against the rules on the page; returns a list of problems (empty = every move is legal and
  // scored correctly).
  //   start   : play the next unplayed day's card next to the last day  -> 2 points (a new kind on an empty stack)
  //   add     : day card onto a stack that is not full or closed          -> 1 point if that kind is already there, else 2
  //   close   : Evening & Morning on a full stack, once per day           -> the day's number
  //   discard : 0 points
  function checkRules(steps) {
    var problems = [];
    var stacks = DAYS.map(function () { return { cards: [], closed: false }; });
    stacks[0].cards.push('Light');
    var started = 1;
    steps.forEach(function (s, i) {
      if (s.kind === 'setup') return;
      var at = 'move ' + i + ' (' + s.who + ' ' + s.kind + '): ';
      var st = s.day ? stacks[s.day - 1] : null;
      var want;
      if (s.kind === 'start') {
        if (s.day !== started + 1) problems.push(at + 'a new day must be the next one, not ' + s.day);
        want = 2; started++;
        stacks[s.day - 1].cards.push(s.label);
      } else if (s.kind === 'add') {
        if (!st || !st.cards.length) problems.push(at + 'day ' + s.day + ' has not been started');
        else if (st.closed) problems.push(at + 'day ' + s.day + ' is closed');
        else if (st.cards.length >= s.day) problems.push(at + 'day ' + s.day + ' is already full');
        want = st && st.cards.indexOf(s.label) >= 0 ? 1 : 2;
        st.cards.push(s.label);
      } else if (s.kind === 'close') {
        if (st.cards.length !== s.day) problems.push(at + 'day ' + s.day + ' is not full (' + st.cards.length + '/' + s.day + ')');
        if (st.closed) problems.push(at + 'day ' + s.day + ' already has its Evening & Morning card');
        want = s.day; st.closed = true;
      } else if (s.kind === 'discard') want = 0;
      else problems.push(at + 'unknown move');
      if (s.pts !== want) problems.push(at + 'scores ' + s.pts + ' but the rules give ' + want);
      var shown = new RegExp('(^|[^0-9])' + s.pts + '(\\s+points?)?([^0-9]|$)').test(s.text);
      if (!shown) problems.push(at + 'the caption does not mention ' + s.pts);
      if (s.who !== PLAYERS[(i - 1) % PLAYERS.length]) problems.push(at + 'wrong player: turns go ' + PLAYERS.join(', '));
    });
    return problems;
  }

  return { DAYS: DAYS, PLAYERS: PLAYERS, STEPS: STEPS, stateAt: stateAt, checkRules: checkRules };
});
