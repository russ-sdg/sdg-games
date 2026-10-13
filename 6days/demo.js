// Six Days: the animated sample game and the stack diagram. Illustrative only - it follows the rules as
// written on the page (the real cards carry artwork and a column of icons for each kind of creation).
(function () {
  var DAYS = [
    { n: 1, name: 'Light', color: '#a85a05' },
    { n: 2, name: 'Sky & sea', color: '#2a6fa8' },
    { n: 3, name: 'Land & plants', color: '#2f7d46' },
    { n: 4, name: 'Sun & moon', color: '#2a3490' },
    { n: 5, name: 'Birds & fish', color: '#0b7777' },
    { n: 6, name: 'Animals & mankind', color: '#8e4a3d' },
  ];
  var PLAYERS = ['Ann', 'Ben', 'Cy'];

  // One entry per move. kind: start (first card of a new day) | add | close (Evening & Morning) | discard
  var STEPS = [
    { kind: 'setup', text: 'Setup: Day 1 starts face-up in the middle of the table. It only needs 1 day card, so it is already full.' },
    { who: 'Ann', kind: 'start', day: 2, label: 'Sky', pts: 2, text: 'Ann draws a card and starts Day 2 by playing a Day 2 card next to Day 1. A new kind of creation on that day: 2 points.' },
    { who: 'Ben', kind: 'add', day: 2, label: 'Sea', pts: 2, text: 'Ben adds a Day 2 card to the Day 2 stack. Sea is a new kind there: 2 points. Day 2 now has its 2 cards, so it is full.' },
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

  // The six stacks. `opts.labels` false draws plain blocks (for the diagram); `last` marks the move to animate.
  function boardHTML(state, opts) {
    var last = state.last;
    return '<div class="sd-board' + (opts.small ? ' is-small' : '') + '">' + DAYS.map(function (d) {
      var st = state.stacks[d.n - 1];
      var full = st.cards.length === d.n;
      var slots = '';
      for (var i = 0; i < d.n; i++) {
        var filled = i < st.cards.length;
        var isNew = last && (last.kind === 'start' || last.kind === 'add') && last.day === d.n && i === st.cards.length - 1;
        slots += '<div class="sd-slot' + (filled ? ' is-on' : '') + (isNew ? ' pop' : '') + '"' + (filled ? ' style="background:' + d.color + '"' : '') + '>' +
          (filled && opts.labels !== false ? st.cards[i] : '') + '</div>';
      }
      var em = '<div class="sd-slot sd-em' + (st.closed ? ' is-on' : full ? ' is-ready' : '') +
        (last && last.kind === 'close' && last.day === d.n ? ' pop' : '') + '">' + (st.closed ? 'E&amp;M' : full ? 'E&amp;M?' : '') + '</div>';
      return '<div class="sd-col"><div class="sd-day" style="color:' + d.color + '">Day ' + d.n + '</div>' + slots + em + '</div>';
    }).join('') + '</div>';
  }

  // static diagram: every day full and closed
  function renderStatic(el) {
    var state = { stacks: DAYS.map(function (d) { var c = []; for (var i = 0; i < d.n; i++) c.push(''); return { cards: c, closed: true }; }), pts: {}, last: null };
    el.innerHTML = boardHTML(state, { labels: false, small: true });
  }

  function mountPlayer(root) {
    var board = root.querySelector('[data-board]'), cap = root.querySelector('[data-sd-caption]'), scores = root.querySelector('[data-scores]');
    var range = root.querySelector('[data-range]'), playBtn = root.querySelector('[data-play]'), speed = root.querySelector('[data-speed]');
    var step = 0, timer = null, interacted = false;
    var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    var last = STEPS.length - 1;
    range.max = last;

    function draw() {
      var s = stateAt(step);
      board.innerHTML = boardHTML(s, {});
      cap.innerHTML = '<span class="sd-step">' + (step === 0 ? 'Start' : 'Move ' + step + ' of ' + last) + '</span> ' + STEPS[step].text;
      scores.innerHTML = PLAYERS.map(function (p) {
        var active = s.last && s.last.who === p;
        return '<div class="sd-score' + (active ? ' is-active' : '') + '"><span>' + p + '</span><b>' + s.pts[p] + '</b>' +
          (active && s.last.pts ? '<i>+' + s.last.pts + '</i>' : '') + '</div>';
      }).join('');
      range.value = step;
      playBtn.textContent = timer ? '⏸ Pause' : step >= last ? '↻ Replay' : '▶ Play';
      root.querySelector('[data-first]').disabled = root.querySelector('[data-back]').disabled = step === 0;
      root.querySelector('[data-fwd]').disabled = step >= last;
    }
    function stop() { clearInterval(timer); timer = null; }
    function tick() { if (step >= last) { stop(); return draw(); } step++; if (step >= last) stop(); draw(); }
    function play() {
      if (timer) { stop(); return draw(); }
      if (step >= last) step = 0;
      timer = setInterval(tick, { slow: 3400, normal: 2400, fast: 1200 }[speed.value]);
      tick();
    }
    root.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      if (b.hasAttribute('data-play')) { interacted = true; return play(); }
      if (!(b.hasAttribute('data-first') || b.hasAttribute('data-back') || b.hasAttribute('data-fwd'))) return;
      interacted = true; stop();
      if (b.hasAttribute('data-first')) step = 0;
      if (b.hasAttribute('data-back')) step = Math.max(0, step - 1);
      if (b.hasAttribute('data-fwd')) step = Math.min(last, step + 1);
      draw();
    });
    range.addEventListener('input', function () { interacted = true; stop(); step = Number(range.value); draw(); });
    speed.addEventListener('change', function () { if (timer) { stop(); play(); } });
    draw();
    // play once, the first time the demo scrolls into view (not for people who prefer reduced motion)
    if (!reduce && 'IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (entries) {
        if (entries[0].isIntersecting && !interacted && !timer && step === 0) { play(); io.disconnect(); }
      }, { threshold: 0.6 });
      io.observe(root);
    }
  }

  window.SixDaysDemo = { renderStatic: renderStatic, mountPlayer: mountPlayer, steps: STEPS, stateAt: stateAt, days: DAYS };
  document.querySelectorAll('[data-sd-static]').forEach(renderStatic);
  document.querySelectorAll('[data-sd-player]').forEach(mountPlayer);
})();
