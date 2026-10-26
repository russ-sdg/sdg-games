# Six Days: play online

`index.html` is a free solo game against 1 to 5 computer players (the box says 2 to 6 players). Linked from the Six Days page, the games list and the home page.

- `js/engine.js` the rules as pure functions on plain JSON state (seeded shuffles, so a saved game resumes exactly). `js/ai.js` the computer players (casual / steady / sharp). `js/deck-data.js` is generated: `node 6days/play/tools/build-deck.mjs`.
- `js/app.js` the page. State is saved in `localStorage`. `?fast` skips the computers' pauses, `?seed=N` replays a deal, `?debug` exposes `window.sixdays`.
- `js/share.js` draws the shareable result picture (the six days with every card, and the scores); `share.test.js` checks the headline and message.
- Tests: `node --test` in this folder. `node tools/sim.mjs 300 3` plays computer-only games (casual should trail steady and sharp).

## The deck
40 Day cards (1, 7, 7, 8, 8, 9 for Days 1 to 6) and 6 Evening & Morning cards. Point cards are not simulated one by one: a play just scores its points (they are 22 double-sided 1/2 cards and one each of 3, 4, 5 and 6, enough that the pile never runs out).

## How the printed rules were read
The page's rules leave a few things open; these are the choices made, so they are easy to change:

- **Starting a day:** only the next day's own card (a Day 2 card next to Day 1) starts a day: 2 points.
- **Adding:** a day card goes on its own day's stack or any *later* stack that is started, not full and not closed ("onto its own or a later day's stack"). So a Day 4 card can go on Day 6. Scores 1 point if a card of the same name (kind) is already on that stack, otherwise 2.
- **Closing:** Evening & Morning goes on a full, unclosed stack, once per stack, for the day's number in points. Day cards can no longer be added to a closed day.
- **Draw:** the draw pile or the top of any discard pile; a turn is draw, then play *or* discard one card, so you always hold 2 cards between turns.
- **Empty discard piles** are refilled from the draw pile at the end of a turn. If the draw pile runs out, the discards (all but each pile's top card) are shuffled back in, up to 3 times; after that, or after 80 rounds, the game ends and the points stand.
- **The game ends** the moment every stack holds its full number of day cards; most points wins (ties share the win).
