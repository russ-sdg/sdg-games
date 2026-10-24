# Journeys with Jesus: play online

Free online version of the Journeys with Jesus board game, one person against 1 to 3 computer players. Static files only (no server).
Not linked from the rest of the site yet (the page is `noindex`); it is at `/journeys-with-jesus/play/`.

- `index.html`, `play.css`, `js/app.js`: the page and UI (setup, board, journeys in play, piles, hand, results). A game in progress is saved in the browser and can be resumed.
- `js/engine.js`: the rules, as pure functions on a plain state object (turn phases recite → draw → play → top-up).
- `js/build.js`: laying a journey by hand, card by card (tap a journey card, then your cards or the cities along its route; each card must be joined to the last by a road or boat ride). The page shows no hints about which journeys you can complete.
- `js/share.js`: the results picture (board with everyone's journeys in their colours, standings, your journeys) drawn on a canvas for download / native share / copyable text.
- `js/ai.js`: the computer players (Casual, Steady, Sharp). `js/board.js`: draws the map. `js/board-data.js`: the 24 places, roads and boat rides.
- `js/deck-data.js`: **generated** by `node tools/build-deck.mjs` from `../cards-data.js` (the gallery's list), so the deck is the printed deck, with the same card pictures. Rerun it after rebuilding the gallery.
- `engine.test.js`, `ai.test.js`, `build.test.js`, `share.test.js`: `cd journeys-with-jesus/play && node --test`. `tools/sim.mjs`: computer-vs-computer games (`node tools/sim.mjs 150 3`) to check the games end and the skill levels are ordered.

## Rule interpretations to confirm
- **Journey routes:** any route along the roads/boat rides between the two places, with a card for every place (the two ends included), no place twice. Points are the ones printed on the Journey Card.
- **Capernaum to Nain** is printed as 25 points (the 5-card route through Magdala, Cana and Nazareth), but the roads through Ptolemais and Caesarea make a 4-card route, which the game allows for the same 25 points. Every other card's points equal the square of its shortest route.
- **Extending:** more cards on top of the end of what you laid, until another in-play journey is complete. It may start at any place already laid, reusing those cards in order. A journey wholly inside what you laid (a run of it, in either direction) completes with no more cards. Either end of a journey card may be the start.
- **Wild cards:** a Region Wild Card replaces any place in its region, the Israel card any place, and a Scripture Memory Token any place (used tokens are forfeited). The game uses exact cards first, then region wilds, then the Israel card, then tokens.
- **New journeys:** a completed journey's place stays empty (with the card shown as won) while that player is laying down journeys; when they finish playing, before they draw back up, the new journey is turned up. So a journey turned up by your own completion cannot be completed in the same turn. (The printed rules say to replace it immediately; this follows how the online game was asked to work.)
- **Passing the turn on:** after a computer player's turn you press Continue, so you can look at what it completed (its journeys are drawn on the board, in its colour, until then). After your own turn the next player starts at once. Completed journeys are drawn on the board only for the turn they were completed.
- **Extending:** a journey can be extended from either end of the line you laid (the first card you lay decides which end).
- **Piles:** a gap in the four face-up piles is filled at once, so the next card you take can be the new one. When the face-down pile runs out the played cards are reshuffled into it.
- **Computer players:** Casual / Steady / Sharp differ in how often they overlook a journey they could complete, how many they lay in a turn, whether they notice extensions, and how well they recite. All-Casual games last about 9 rounds with 3 players, all-Steady about 6, all-Sharp about 4 (`node tools/sim.mjs 40 3 no steady`).
- **Reciting:** on your honor (you reveal the card and say whether you got it). Computers succeed 35% / 60% / 85% of the time by skill.
- **End:** the game ends as soon as the last Journey Card is completed (the rest of that turn is not played). A game where nobody can draw or play ends too, and there is a round limit.
