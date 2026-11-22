# The Fruit of the Spirit: play online

`index.html` is a free solo game against 1 to 3 computer players (the box has up to 4 players, and teams for 4 to 6; teams are not in the online version). Linked from the product page, the games list and the home page.

- `js/engine.js` the rules as pure functions on plain JSON state: `legal(S)` lists every allowed action, `apply(S, a)` returns the next state. Seeded shuffle, so a saved game resumes.
- `js/ai.js` the computer players (casual / steady / sharp). `js/quiz.js` checks the Goodness recital. `js/app.js` the page; state is saved in `localStorage`. `?fast` skips the computers' pauses, `?seed=N` replays a deal, `?debug` exposes `window.fp`.
- Tests: `node --test` in this folder. `node tools/sim.mjs 200 3` plays computer-only games to check the rules never break.

## How the printed rules were read
- **A turn:** skip, or draw (pile or top of discard); one Fruit card and one Deed card (Joy and Faithfulness are extras); discard; draw back to five.
- **Deeds** cover one of your own showing fruit (Self-Control if it is showing). They can only be discarded while Self-Control shows (Peace is the exception). A covered fruit is earned again by playing that fruit, or redeemed by Self-Control or an opponent's Love. A hand over five that is all Deeds is kept.
- **Jealousy / Uncleanness** are played out of turn, and do not use up the turn's Deed. Uncleanness is only offered for a discarded card you could use (a fruit you are missing, or Wild).
- **Wild** is allowed only when no other Fruit card can be played (Goodness counts as playable until you fail to recite).
- **Goodness:** type the nine fruit in any order; "longsuffering", "faith", "meekness", "temperance" are accepted, and a one-letter slip is forgiven. Computer players succeed 65% / 90% / 100% of the time by skill.
- **Kindness** gives any Fruit card except Joy and Faithfulness, or a Wild card, that the opponent does not have showing.
- **Faithfulness** drawn from either pile (including when drawing back to five) must be played or discarded at once, then you draw again.
- A very long game (120 rounds) ends with the most fruit showing winning.
