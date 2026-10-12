# Journeys for Paul - online play

Static site (no build step), served at `/JfP/play/` by Cloudflare Pages.

- `index.html`, `play.css`, `js/app.js` - UI (SVG board, setup, hand-off, results)
- `js/game.js` - session state machine (solo against computer opponents, pass-and-play, in-person table play)
- `js/bot.js` - the computer opponents' brain: plans a legal turn for a sheet (three skill levels)
- `js/engine.js` - pure rules: movement, preaching/called, scoring, end of game
- `js/board.js` - SVG board drawing shared by the live game, the replay and the share image
- `js/replay.js` - step-by-step replay of each player's journey (results screen)
- `js/share.js` - 1200x900 result card drawn on a canvas (download / native share)
- `js/scripture.js` - Scripture snippet shown when an evangelist preaches or is called
- `js/map-data.js` - **generated** cities, regions, labels and routes
- `js/scripture-data.js` - **generated** passages (World English Bible, public domain)
- `assets/basemap.webp` - **generated** route-free base map (2400x1200)
- `engine.test.js`, `features.test.js`, `table.test.js`, `bots.test.js` - `cd JfP/play && node --test` (Node 20+, no dependencies)

## Rules implemented
Roller: one to three evangelists, each moves or - if unable to move by the rolled mode - preaches.
Other players: one evangelist. Fast game: may move, or preach if stuck, and a repeat preach calls an
evangelist even after one region. Long game: other players may only move, and being called needs
two regions (starting region counts). The preach that gets someone called is scored as the call (5),
not as a second preach (3). The game ends after the roll on which someone has all three called, or
nobody can travel any further. The die is assumed to be 2 faces each of Road, Footpath, Boat and
Player's Choice (`DIE_FACES` in `engine.js`).

## Regenerating the map
From the Affinity exports (`map-only`, `road-only`, `footpath-only`, `boat-only` SVGs):

    python3 tools/build-map.py <dir with the SVGs> <scratch dir>   # writes map-data.js + basemap-source.svg
    cp <scratch dir>/map-data.js js/
    node tools/render-basemap.mjs <scratch dir>/basemap-source.svg basemap.png   # needs playwright

then convert `basemap.png` to `assets/basemap.webp`. (The scrub of stray screenshot text in the
source art was done by hand-whitening two small boxes; see git history.)

## Scripture snippets
`tools/build-scripture.mjs` assembles `js/scripture-data.js` from the per-book JSON in
<https://github.com/TehShrike/world-english-bible> (`json/<book>.json`), so no verse text is typed by
hand. To change what a city shows, edit `CITY_PASSAGES` in the script and rerun it:

    node tools/build-scripture.mjs <dir with acts.json, revelation.json, ...> js/scripture-data.js

Cities not named in the New Testament (Mount Olympus, Delphi, Ambracia, Sparta, Chalcedon, Pessinus,
Apamea) get a general preaching verse and a note saying so. Being called as pastor shows 1 Peter 5:2.

## Replay and share image
Each sheet records every action in `sheet.history`; `sheetAt()` in `engine.js` rebuilds the board at
any step. The share image is drawn straight onto a canvas (no SVG round trip), using `Path2D` on the
same route paths as the live board.

## Same room, own phones (`kind: 'table'`)
Recreates the physical game with no networking: each phone holds ONE sheet (seat `mySeat`) and the
table coordinates out loud, exactly as with the real die.

- The roller's phone rolls the die (`roll`) and shows "Tell the table: ...". Everyone else taps what
  was announced (`announceRoll`; after Player's Choice, the mode the roller chose).
- Everyone moves on their own phone (roller: 1-3 evangelists, others: 1), then ends their turn; the
  roller advances to the next seat. Every phone is given the same player order, so each knows whose
  roll comes next. `setRoller` fixes a phone that has drifted (a missed tap).
- A phone cannot see the others' sheets, so it ends the game itself only when *its* player has all three
  called. "Nobody can move" is for the table to call: everyone taps "The game is over" (`finishNow`).
- Setup: one person lists the players and shares an invite link (`?table=1&rules=..&p=Ann&p=Ben..`);
  the others open it and tap their own name. The screen is kept awake with the Wake Lock API.
- `table.test.js` simulates several phones at one table (each knowing only its own sheet and the
  announced rolls) and checks they stay in step through whole games.

## Computer opponents (solo)
Each bot has its own sheet and plays every roll by the same rules as a person: as the roller (up to
three evangelists) or as an "other player" (one), with the fast/long preaching rules respected. A bot
that rolls Player's Choice picks the way of travel that suits its own sheet.

`bot.js` values every legal action in points - a city nobody has visited saves the -2 penalty (+2), a
new region for that evangelist is +4, a preach is +3, and the preach that gets someone called is +5 but
ends his travels, so a bot only does it once the evangelist is stuck or little is left to discover.
Skill levels differ in noise, in how many hops ahead they look for unvisited cities and regions, and in
the odd lapse (Casual only; a lapse is never a pointless call):

| level  | idea                          |
|--------|-------------------------------|
| Casual | wanders about, makes mistakes |
| Steady | sensible, short-sighted       |
| Sharp  | plans several hops ahead      |

In simulation (`bots.test.js`) a Sharp bot beats Steady, which beats Casual, in both rule sets. Bots do
not try to rush the game to a close, so in the fast game a person who preaches with every evangelist
can end it in about ten rolls, long before the bots have scored much.

## Cache busting (after you change any script or play.css)
Browsers can keep running an old cached copy of a script after a deploy (an old `app.js` with a new
`game.js` is a broken game). So `index.html` gives every module and the stylesheet a content-hash URL
(`?v=<hash>`, via an import map) and shows the hash as "version" in the page footer, and the root
`_headers` file tells Cloudflare Pages to make browsers revalidate `/JfP/play/*` on every load.

    node tools/stamp.mjs      # run after editing anything in js/ or play.css

`stamp.test.js` fails if `index.html` is stale, so you can't forget.
