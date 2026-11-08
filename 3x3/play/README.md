# Three-by-Three: play online

`index.html` is a free solo game against 1 to 5 computer players (the box says 2 to 6 players). Linked from the Three-by-Three page, the games list and the home page.

- `js/engine.js` the rules as pure functions on plain JSON state (seeded shuffle, so a saved game resumes). A card is its tribe number, 1 to 13.
- `js/ai.js` the computer players (casual / steady / sharp). `js/app.js` the page. State is saved in `localStorage`. `?fast` skips the computers' pauses, `?seed=N` replays a deal, `?debug` exposes `window.tt`.
- Tests: `node --test` in this folder. `node tools/sim.mjs 150 3` plays computer-only games to compare the skills.

## How the printed rules were read
- **Asking for a card:** "highest" / "lowest" mean the highest / lowest card in that hand *not yet shown this turn*, so asking for the highest twice shows the top two cards. You can ask yourself ("show my highest").
- **A turn:** two cards one at a time; if they match, a third. All three matching takes the set; anything else puts every card back. The page pauses on the result so you can memorise it.
- **Replacing cards:** hands that gave up cards draw back to three, then matrix holes are filled, from the draw pile while it lasts.
- **"No sets in play":** done automatically. If no tribe has all three cards in hands or the matrix (counting a hand's lone middle card as out of play, since it cannot be shown without showing a different card first), three more cards join the matrix (12, then 15, ...). With nothing left to add, the game ends and the most sets wins.
- **Winning:** three sets of three, or the Levi set, ends the game at once.
- **Who goes first** is chosen at random.

## The computer players
They only know what has been shown (and their own hand); nothing is peeked at. Each remembers where cards were shown until the hand or matrix spot changes.

- **casual** forgets 40% of what it knows each turn and turns over a random card 20% of the time.
- **steady** forgets 10% each turn.
- **sharp** remembers everything. It goes straight for any two cards it knows match, otherwise it explores and then uses what it knows.

The optional "Remind me what has been shown" checkbox marks face-down cards with what you were shown earlier.
