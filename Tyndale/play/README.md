# Tyndale: play online

Free online version of the Tyndale board game. Static files only (no server).

- `index.html`, `play.css`, `js/app.js`: the page and UI (hunt mode: you are a Bishop's Agent, a computer is Tyndale).
- `js/engine.js`: the rules, as pure functions on a plain state object. `js/ai.js`: the computer Tyndale and computer Agents.
- `js/board-data.js`: the 11x11 board (point colours, Printing Centres, Coastal Cities and their distance to London).
  **`check.html` draws this data over the board image so it can be verified by eye.**
- `engine.test.js`: `node --test` in this folder. `tools/sim.mjs`: computer-vs-computer simulation for balance checks.

Rule interpretations to confirm: shipping completes the next translation at once, so on a first visit to a Printing Centre that is also a port (or London) that new translation is printed and shipped in the same turn (a centre prints only once per visit, so a centre that just printed the New Testament does not also print the Pentateuch); London is a Printing Centre and a 0-move port (publish, ship and arrive in one visit); "near" for the Secret
Supporter's card means within 3 steps; a second step is allowed only after a first step onto a blue spot (plus earned bonus moves);
the Secret Supporter exists with 4+ Agent players.

Modes: **Hunt** (you are an Agent, a computer is Tyndale) and **Be Tyndale** (you plan the route; computer Agents hunt you).
In Be Tyndale the Agents' skill sets how much they are tipped off about his real position (`PEEK` in `js/ai.js`): casual none,
steady a little, sharp a lot. `?fast` on the page URL skips the pauses (for testing). Pace: normal play stops after each computer move (cards shown, move drawn on the map); accelerated play does not. `js/share.js` draws the result picture: the board with Tyndale's route and every Agent pawn's route (kept in `pawn.trail`), so you can see how close the Agents got.

