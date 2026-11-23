# 2048

Plain HTML, CSS and JavaScript (ES modules, no frameworks), built to practice software testing.

## Run

```
npm install
npm start        # http://localhost:8080
npm run dev      # same, and opens the browser
```

The game must be served over HTTP (ES modules don't load from `file://`).

## Structure

| File | Role |
|---|---|
| `src/game.js` | Pure game logic: moves, merges, score, win/lose. No DOM, no storage, randomness injected. |
| `src/params.js` | Pure parser for the testing URL parameters. |
| `src/ui.js` | Renders state, handles keyboard/buttons, stores best score in `localStorage` (`2048:best`), sets `window.__game`. |
| `index.html`, `styles.css` | Markup and styles. |

## Controls

Arrow keys or WASD to move, "New game" button to restart. On touch devices swipe anywhere on the screen (at least 24 px; the dominant axis decides the direction). The page is fixed (`position: fixed`, `100dvh`, `touchmove` cancelled) so it never scrolls or bounces. The hint text switches with `@media (hover: none) and (pointer: coarse)`.

## URL parameters (for testing)

| Param | Effect |
|---|---|
| `?seed=123` | Deterministic random tiles (initial and spawned). |
| `?board=2,2,0,0,4,0,0,0,...` | Initial board: 16 values, row-major, each `0` or a power of 2. Invalid values are ignored with a console warning. No tiles are added on top. |
| `?spawn=off` | No new tile after moves. The initial two tiles are still placed unless `board` is given. |
| `?theme=ocean`, `lavender`, `mint`, `midnight` | Colour theme. Overrides the saved choice; unknown names are ignored. |

Params combine, e.g. `?board=1024,1024,0,0,0,0,0,0,0,0,0,0,0,0,0,0&spawn=off`.

"New game" ignores `?board`, starts from a fresh seeded sequence (same `?seed` gives the same start), and keeps the best score.

## Colour themes

A small palette button next to "New game" opens a popover with four themes: Ocean (default), Lavender, Mint, Midnight. It closes after a choice, on a click or tap outside, on Escape, or on a second click of the button. While it is open, arrow keys, WASD and swipes don't move tiles (arrows move between options, Enter selects); the first tap or swipe outside only closes it. The choice is saved in `localStorage` (`2048:theme`) and applied before first paint by a small inline script in `index.html`. Themes are CSS variables (`:root[data-theme='…']` in `styles.css`; Ocean is the `:root` default). Every theme must keep WCAG AA contrast for tiles, text and buttons; the tests check it.

Test ids: `theme-button`, `theme-popover`, `theme-option-ocean|lavender|mint|midnight`.

## Cache busting

GitHub Pages caches files for 10 minutes. `styles.css`, `src/ui.js` and the module imports carry `?v=<hash>`. After editing `styles.css` or anything in `src/`, run `npm run bump` (`npm test` does it automatically via `pretest`) and commit the result; a test fails if the hash is stale.

## Tests

```
npm test
```

Playwright (`tests/`) runs on WebKit with iPhone 14 and iPhone SE viewports and on desktop Chrome (1280x800): required `data-testid`s and URL params, no scrolling, centering, hint text, rounded corners, WCAG AA contrast for every tile value, and swipes. `tests/screenshots.spec.js` writes review screenshots to `screenshots/` (git-ignored). Browsers: `npx playwright install chromium webkit`.

## Merge animation

When two tiles merge, the resulting tile plays a 200 ms burst (pop plus expanding ring). It only uses `transform`, `box-shadow` and `filter`, so layout never shifts, and `data-value` updates immediately. While it plays the cell has `data-merged="true"`; each cell removes the attribute itself on `animationend`, so the duration lives only in `--merge-duration` in `styles.css`. Moves that change nothing don't touch the board or any running animation. A cell that merges again mid-animation restarts it. With `prefers-reduced-motion` there is no animation and the attribute is never set.

`game.js` reports which tiles merged: `move()` returns `merged` and `applyMove()` stores it in `state.merged` as `[row, col]` pairs.

## Debug state

`window.__game` is `{ board, score, status }`, where `board` is a 4x4 array of arrays and `status` is `'playing' | 'won' | 'over'`. It is refreshed after every render. After "Continue" the status goes back to `'playing'`.

## `data-testid` reference

| Element | testid |
|---|---|
| Board | `board` |
| Cell (row, col 0-3) | `cell-{row}-{col}`, with `data-value` (0 = empty), `data-row`, `data-col` |
| Score / best score | `score`, `best-score` |
| New game button | `new-game-button` |
| Win message (in the DOM only while shown) | `win-message` |
| Win: Continue / New game | `continue-button`, `win-new-game-button` |
| Game over message (in the DOM only while shown) | `game-over-message` |
| Game over: New game | `game-over-new-game-button` |
