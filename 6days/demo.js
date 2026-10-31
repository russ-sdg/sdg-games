// Six Days: the animated sample game and the stack diagram (data and rules check: demo-core.js). Illustrative only - it follows the rules as
// written on the page (the real cards carry artwork and a column of icons for each kind of creation).
(function () {
  var core = window.SixDaysCore;
  var DAYS = core.DAYS, PLAYERS = core.PLAYERS, STEPS = core.STEPS, stateAt = core.stateAt;

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
