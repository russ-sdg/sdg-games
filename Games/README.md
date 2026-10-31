# Games list

`games.html` is a hero and a grid of cards built by `js/games-page.js` from `js/games-data.js`.

**Add a game**
1. Build its product page folder (copy a redesigned one such as `Tyndale/` or `6days/`).
2. Add its 450 x 300 card art to the `ART` table in `Games/tools/build-game-art.py` and run `python3 Games/tools/build-game-art.py` from the repo root. It writes `assets/games/<name>.webp`.
3. Add one entry to `js/games-data.js` (title, one-sentence blurb, tags, art, price, facts), and a link for it in the no-JavaScript list in `games.html`.
4. Run `node --test tests/*.js`. The tests check the entry against the product page and the files it points to.

Optional fields: `online` (free online version), `was` and `badge` (sale or introductory price), `url` (a game that lives on another site), and `launch: 'YYYY-MM-DD'` for a game that is not on sale yet. Until that day the card says "Launching <date>" instead of the price, and it switches on its own.

Once there are more than six games, filter buttons (one per tag, plus "Play online") appear on their own.
