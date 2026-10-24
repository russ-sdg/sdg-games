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


## Same room, own phones

`table.html` (host) and `agent.html` (each Agent) let a group play at one table with no server and no sign-up.

- **The table code** is one digit (how many Agents) plus a 6-character base-36 seed (`js/table-core.js`). Every phone deals the same
  character cards from it, so each Agent can see their own card and everyone agrees who holds the Secret Supporter (Stephen Vaughn) with 4+ Agents.
- **The host phone** runs the full engine (`js/table.js`): pawn placement, Tyndale (a person on that phone, or the computer), the answer cards,
  shipments, accusations and the results/share image. Nothing is sent anywhere; progress is saved in `localStorage` and every step can be undone.
- **An Agent's phone** (`js/agent.js`) is a private scorecard: the character card (hidden until tapped), a 1 to 3 die with the reachable spots highlighted,
  and clue tools (N, P, H, O, Rumors, nothing) for what the others report. The Agents tell the host where they landed; the host taps it in.
  Positions and clues are shared by talking, as in the physical game.
- **Rules interpretations**: a table Agent rolls their own die, so `agentMove(..., { free: true })` accepts any spot not held by another pawn
  (the host checks the distance by eye, as at a physical table). The Secret Supporter is shown near/far, and the host asks what they report.
  The answer cards are for the Agent being asked only; the host phone does see them.
- `js/boardview.js` draws the board for both pages. `table-core.test.js` covers the code, the shared deal and free moves.
