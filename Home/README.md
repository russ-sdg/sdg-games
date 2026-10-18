# Home page

`index.html` shows the featured games, books and clothing, the games you can play free online, and the email signup.
The cards are built by `js/home-page.js` using the same card builders (`js/cards.js`) as `games.html` and `books.html`.

- **Featured games / books:** put `featured: true` on an entry in `js/games-data.js` or `js/books-data.js`. They appear in list order.
- **Featured clothing:** edit `js/clothing-data.js` (the shop itself is on Printify). Add a picture to `Home/tools/build-home-art.py` and run `python3 Home/tools/build-home-art.py`.
- **Equal numbers:** `tests/home-page.test.js` fails if the featured games, books and clothing are not the same number. Change the test if that ever stops being the rule.
- **Free online games:** any game with an `online` link in `js/games-data.js` is listed automatically.
- **No-JavaScript lists:** each section in `index.html` has a plain list of links that JavaScript replaces. The tests check they match the data, so update them when you change what is featured.
- **Coming soon:** a game with a `launch` date shows "Coming soon" until that day, then its price, on the home page and `games.html` alike.
