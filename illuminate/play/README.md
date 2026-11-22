# Illuminate: play online

`index.html` is a free solo game against 1 to 3 computer players (the box says 2 to 4). Linked from the Illuminate page, the games list and the home page.

- `js/cards.js` the 48 playing cards: suit, chapter, verse, role symbols and the four star cards. The symbols were read from the card pictures.
- `js/engine.js` the rules as pure functions on plain JSON state: `legal(S)` lists every allowed action, `apply(S, a)` returns the next state. Seeded shuffle, so a saved game resumes.
- `js/ai.js` the computer players (casual / steady / sharp). `js/share.js` the result picture. `js/app.js` the page; state is saved in `localStorage`. `?fast` skips the computers' pauses, `?seed=N` replays a deal, `?debug` exposes `window.il`.
- Tests: `node --test` in this folder. `node tools/sim.mjs 20 3 standard` plays computer-only games to check the rules never break and to compare the skills.

## How the printed rules were read
- **Hands:** 1 card in the first hand, one more each hand, to 12 (6 hands, or 23 going up to 12 and back down, are options). The dealer rotates left; the player to the dealer's left bids first and leads the first trick; the winner of a trick leads the next.
- **Bidding and scoring** are as printed, including "all" or "nothing" in the 6- and 12-card hands (all: 2N points and everyone else 0 if you take every trick; nothing: 2N - 2 x tricks won). "Not Perfect bidding" stops the dealer's bid making the bids add up to the number of cards.
- **Grace:** a card with your role's symbol is Grace if "Grace!" is proclaimed. You choose when you play it. If you play it plain, each other player may proclaim it for you (the computer players do so to make a player win a trick they do not want). Roles are judged at the moment the card is played.
- **Star cards:** Matthew 19:30 (the lowest card of any Gospel wins), Mark 14:27 (the player who led wins), Luke 19:24 (roles rotate to the right at once: you take your left neighbour's role), John 1:5 (Grace is disabled for the whole trick). If a trick has both a Matthew 19:30 and a Mark 14:27, the one played last decides.
- **The computer players** deal the unseen cards at random many times, play each hand out, and bid what scores best.
