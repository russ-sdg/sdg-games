// Stamps index.html with a content hash of the game's scripts and stylesheet, so a browser that cached an
// older copy is forced to fetch the new one (an old app.js with a new game.js is a broken game).
//   node tools/stamp.mjs          rewrite index.html
//   node tools/stamp.mjs --check  exit 1 if index.html is stale (used by stamp.test.js)
//
// The hash goes in: the stylesheet link, the entry script, an import map that gives every module
// import a versioned URL, and the "Version" text in the page footer.
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const modules = () => readdirSync(join(ROOT, 'js')).filter((f) => f.endsWith('.js')).sort();

export function computeHash() {
  const h = createHash('sha1');
  for (const f of modules()) h.update(f).update(readFileSync(join(ROOT, 'js', f)));
  h.update('play.css').update(readFileSync(join(ROOT, 'play.css')));
  return h.digest('hex').slice(0, 8);
}

export function stamped(html, hash = computeHash()) {
  const map = JSON.stringify({ imports: Object.fromEntries(modules().map((f) => [`./js/${f}`, `./js/${f}?v=${hash}`])) }, null, 8)
    .replace(/\n}$/, '\n    }');
  return html
    .replace(/<link href="play\.css[^"]*" rel="stylesheet" \/>/, `<link href="play.css?v=${hash}" rel="stylesheet" />`)
    .replace(/<script type="importmap">[\s\S]*?<\/script>/, `<script type="importmap">\n    ${map}\n    </script>`)
    .replace(/<script type="module" src="js\/app\.js[^"]*"><\/script>/, `<script type="module" src="js/app.js?v=${hash}"></script>`)
    .replace(/(<span id="build">)[^<]*(<\/span>)/, `$1${hash}$2`);
}

const indexPath = join(ROOT, 'index.html');
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const html = readFileSync(indexPath, 'utf8');
  const next = stamped(html);
  if (process.argv.includes('--check')) process.exit(next === html ? 0 : 1);
  writeFileSync(indexPath, next);
  console.log(`index.html stamped with ${computeHash()}`);
}
