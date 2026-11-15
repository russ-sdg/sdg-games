# Journeys through Jerusalem: play online

Free online version of the Journeys through Jerusalem board game, one person against 1 to 5 computer players. Static files only (no server).
Linked from the Journeys through Jerusalem page, the games list and the home page; it is at `/JtJ/play/`.

- `index.html`, `play.css`, `js/app.js`: the page and UI (setup, your map, your Character Card, the other players, a log, results). A game in progress is saved in the browser and can be resumed. `?fast` skips pauses, `?seed=N` replays a deal, `?debug` exposes `window.jtj`.
- `js/engine.js`: the rules, as pure functions on a plain state object (seeded shuffle and die, so a saved game resumes). Phases: start (choose a card and a square) → roll → move → resolve → pick (after a completed journey).
- `js/map-data.js`: the map mat as a graph: 94 squares read off `assets/jtj-web/map.webp` (pixel coordinates on the 1200 px picture), joined to the squares they touch. The page draws the printed map and lays tappable squares and your token over it. `node tools/draw-map.mjs > graph.json` writes the graph so it can be drawn over the picture and checked by eye.
- `js/cards.js`: the 18 Character Cards (sites, Scripture, points), read off the printed cards. The card pictures are the gallery's (`assets/jtj-web/cards/`). `icons/` are the 11 site icons, cut from the map's key.
- `js/scripture-data.js`: **generated** by `tools/build-scripture.mjs` from the World English Bible (public domain; the `world-english-bible` npm package): the text of every passage on the cards. When you finish a move on a site on your card, the passage for that site pops up; sites you have reached keep a "Read" link on your card panel.
- `js/ai.js`: the computer players (Casual, Steady, Sharp). `js/share.js`: the results picture, drawn on a canvas for download / native share / copyable text.
- `engine.test.js`, `ai.test.js`, `share.test.js`: `cd JtJ/play && node --test`. `tools/sim.mjs`: computer-vs-computer games (`node tools/sim.mjs 100 3 mixed`) to check the games end and the skill levels are ordered.

## Rule interpretations to confirm
- **Everyone moves at once:** the die passes to the left each round (the first roller is random). You choose where to finish before seeing what the computers did; they move after you have chosen, with no peeking.
- **Moving:** up to the number rolled, along the paths. You finish on any square 1 to N squares away. **Staying put is allowed** ("up to"), and counts as finishing there: that is the only way to circle a site you are already standing on after drawing a new card (the printed rules do not say). Passing over a site does not count; only finishing on it does.
- **Tokens:** the six token colours are the six square colours. You start on any square of your colour (not a white site square).
- **Marks:** any site you finish on is circled. Only sites on your current card count for completing it and for the 5 points at the end; marks are wiped when you complete a journey. A site you stand on when you draw your new card must be left and re-entered, or you stay put on it.
- **Completing:** as soon as all the sites on your card are circled, on any round. Everyone who completes on the same roll completes, in turn order from the roller. Each draws two cards, keeps one, and the other goes to the bottom of the deck. If only one card is left, you must play it.
- **The end:** when anyone has completed an Apostle, a Friend of Jesus and an Enemy of Christ (everyone who completes on that roll still scores, and nobody draws again), or when a player completes a journey and there is no card left to draw. A safety limit of 150 rolls also ends it.
- **Scoring:** the points on the journeys you completed, plus 5 for each site visited on your journey still under way; most points wins, then most journeys, then it is shared.
- **Printed points:** the points are the ones printed on each card (they are not simply a count of sites), e.g. Peter 170, Judas 130, Nicodemus 30.
- **Taps:** taps on the map are caught on the map itself and go to the nearest square you can choose, so a redraw in the middle of a tap cannot lose it. The map is not redrawn when a phone's address bar moves.
- **Not included:** the team-play, longer-game and Scripture-reading variants.

## The computer players
They plan like a traveller: for the sites still to visit, the order that takes the fewest expected rolls (`expectedRolls`: a roll of the distance or more arrives, smaller rolls get you part of the way), and each roll they finish on the square that leaves the shortest expected journey. They choose cards by points per expected roll, nudged toward categories they have not completed.

- **casual** is noisy, wanders now and then and misjudges cards. **steady** is a little noisy. **sharp** plans exactly.
- With 3 players a game lasts about 60 rolls all-Casual, 43 all-Steady and about 38 all-Sharp (`node tools/sim.mjs 100 3 sharp`).
