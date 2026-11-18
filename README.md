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

Arrow keys or WASD to move, "New game" button to restart.

## URL parameters (for testing)

| Param | Effect |
|---|---|
| `?seed=123` | Deterministic random tiles (initial and spawned). |
| `?board=2,2,0,0,4,0,0,0,...` | Initial board: 16 values, row-major, each `0` or a power of 2. Invalid values are ignored with a console warning. No tiles are added on top. |
| `?spawn=off` | No new tile after moves. The initial two tiles are still placed unless `board` is given. |

Params combine, e.g. `?board=1024,1024,0,0,0,0,0,0,0,0,0,0,0,0,0,0&spawn=off`.

"New game" ignores `?board`, starts from a fresh seeded sequence (same `?seed` gives the same start), and keeps the best score.

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
