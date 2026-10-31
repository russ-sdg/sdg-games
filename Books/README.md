# Books

The book product pages are `tyndale_book/`, `FPtF/` and `WICRBC/`; the list is `books.html`.

**Add a book**
1. Copy a product page folder (for a book with an audiobook and illustrations, `FPtF/`; for a plain book, `WICRBC/`) and edit it. Each format is a `.pp-shopify` spot with its own `data-product-id` and `data-button-text`.
2. Put the cover (and any illustrations) in `Books/tools/build-book-art.py`'s `BOOKS` table and run `python3 Books/tools/build-book-art.py` from the repo root. It writes web-sized WebP files to `assets/books/<slug>/`.
3. Add one entry to `js/books-data.js` (title, blurb, tags, cover, formats and prices), and a link for it in the no-JavaScript list in `books.html`.
4. Run `node --test tests/*.js`. The tests check the entry against the product page: cover files and size, prices and format names, audiobook flag, list prices.

Once the list has more than six books, `books.html` shows filter buttons (one per tag, plus Audiobook) on its own.
