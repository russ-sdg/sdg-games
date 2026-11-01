# Prophets & Kings: play online

`index.html` is a free solo game against 1 to 5 computer players (the box says 1 to 6 players). Linked from the Prophets & Kings page, the games list and the home page.

- `js/deck-data.js` the 70 cards and who matches whom, from the designer's grid (`Prophets Kings - PK Grid.csv`) and checked against the lists printed on the cards. `js/engine.js` the rules as pure functions on plain JSON state (seeded shuffle, so a saved game resumes). `js/ai.js` the computer players (casual / steady / sharp).
- `js/app.js` the page. State is saved in `localStorage`. `?fast` skips the computers' pauses, `?seed=N` replays a deal, `?debug` exposes `window.pk`.
- Tests: `node --test` in this folder. `node tools/sim.mjs 150 3` plays computer-only games to compare the skills.
- The pictures are the gallery's (`assets/pk-web/cards/`); Jeroboam II (3 copies) and Darius (2) share one picture each, as in the printed deck.

## How the printed rules were read
The page's rules leave a few things open; these are the choices made, so they are easy to change:

- **Drawing:** you take cards one at a time until you hold 7: from the draw pile, the top of any of the 4 discard piles, or a blind (random) card from another player's hand, in any mix. An emptied discard pile is refilled from the draw pile at once, and that counts as taking from the draw pile.
- **A set** is a head card on top plus cards behind it that each match the head. A new set needs a prophet and a king who match (you choose which goes on top). A card can be added to a set you own if it matches the head and no card of that name is in the set already. Two sets may share a head name (there are several Elisha cards).
- **Discarding:** only when you hold more than 5, down to exactly 5, onto any discard pile. Discarding ends the turn; with 5 or fewer you simply end your turn.
- **The end:** when the last card leaves the draw pile, the player who took it finishes their turn (drawing up to 7, playing, discarding) and the game ends. A safety limit of 80 rounds also ends it.
- **Scoring:** 2 / 3 / 4 / 5 / 6 / 7 cards score 2 / 5 / 10 / 25 / 50 / 100, counting the head. The longest possible set is 7 (Elisha with six kings, Isaiah with five, Jeremiah with six).
- **Who goes first** is chosen at random.

## The computer players
They plan the whole hand (which cards start sets, which join sets, what to keep), and only use what a person at the table could see: their hand, the top of each discard pile, the sets on the table and which cards an opponent picked up face-up and has not played. A blind card from the draw pile or a hand is valued by the average of the cards they cannot see.

- **casual** wanders (random draws 30% of the time), overlooks some plays and ignores what its discards hand to others.
- **steady** plans well, prefers sets that can still grow, and avoids discarding a card an opponent could add to a set.
- **sharp** also remembers the cards opponents picked up (so it will take a blind card from a hand holding a known good one) and guards its discards more closely.

In `tools/sim.mjs` runs casual clearly trails; steady and sharp are close (sharp's extra care shows up mostly with more players).

## Not done yet
Pass and play with friends on one phone, and a shareable result picture, as Six Days has.
