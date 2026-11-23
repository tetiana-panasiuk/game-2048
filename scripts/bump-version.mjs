// Cache busting for GitHub Pages (which serves files with max-age=600).
// Adds ?v=<hash of the assets> to styles.css, src/ui.js and the module
// imports, so a browser always fetches fresh files after a change.
//
//   node scripts/bump-version.mjs          update the hash in place
//   node scripts/bump-version.mjs --check  exit 1 if it is out of date
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const VERSION = /\?v=[0-9a-f]+/g;
const read = (f) => readFileSync(join(root, f), 'utf8');

const assets = ['styles.css', ...readdirSync(join(root, 'src')).filter((f) => f.endsWith('.js')).sort().map((f) => `src/${f}`)];
const hash = createHash('sha1');
for (const f of assets) hash.update(f).update(read(f).replace(VERSION, ''));
const v = hash.digest('hex').slice(0, 8);

const edits = {
  'index.html': (s) =>
    s.replace(/href="styles\.css(\?v=[0-9a-f]+)?"/, `href="styles.css?v=${v}"`).replace(/src="src\/ui\.js(\?v=[0-9a-f]+)?"/, `src="src/ui.js?v=${v}"`),
};
for (const f of assets.filter((a) => a.endsWith('.js'))) {
  edits[f] = (s) => s.replace(/from '(\.\/[\w-]+\.js)(\?v=[0-9a-f]+)?'/g, `from '$1?v=${v}'`);
}

const stale = [];
for (const [file, fn] of Object.entries(edits)) {
  const before = read(file);
  const after = fn(before);
  if (after !== before) {
    stale.push(file);
    if (!process.argv.includes('--check')) writeFileSync(join(root, file), after);
  }
}

if (process.argv.includes('--check')) {
  if (stale.length) {
    console.error(`Cache-busting version is out of date (${stale.join(', ')}). Run: npm run bump`);
    process.exit(1);
  }
  console.log(`Cache-busting version ${v} is up to date`);
} else {
  console.log(stale.length ? `Updated to ?v=${v}: ${stale.join(', ')}` : `Already at ?v=${v}`);
}
