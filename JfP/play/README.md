# Journeys for Paul - online play

Static site (no build step), served at `/JfP/play/` by Cloudflare Pages.

- `index.html`, `play.css`, `js/app.js` - UI (SVG board, setup, hand-off, results)
- `js/game.js` - session state machine (solo with simulated opponents, pass-and-play)
- `js/engine.js` - pure rules: movement, preaching/called, scoring, end of game
- `js/map-data.js` - **generated** cities, regions, labels and routes
- `assets/basemap.webp` - **generated** route-free base map (2400x1200)
- `engine.test.js` - `cd JfP/play && node --test` (Node 20+, no dependencies)

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
