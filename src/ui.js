// UI layer: renders state, handles input, persists best score.
// All game rules live in game.js; URL parsing lives in params.js.

import { SIZE, createRng, newGame, applyMove, continueGame } from './game.js';
import { parseParams } from './params.js';

const BEST_KEY = '2048:best';
const SWIPE_MIN_PX = 24; // shortest finger travel that counts as a swipe

const KEY_TO_DIRECTION = {
  ArrowLeft: 'left',
  ArrowRight: 'right',
  ArrowUp: 'up',
  ArrowDown: 'down',
  a: 'left',
  d: 'right',
  w: 'up',
  s: 'down',
};

const boardEl = document.querySelector('[data-testid="board"]');
const scoreEl = document.querySelector('[data-testid="score"]');
const bestEl = document.querySelector('[data-testid="best-score"]');
const newGameBtn = document.querySelector('[data-testid="new-game-button"]');
const messagesEl = document.getElementById('messages');

const params = parseParams(window.location.search);
params.warnings.forEach((w) => console.warn(`[2048] ${w}`));

let rng = createRng(params.seed);
let state = newGame({ rng, board: params.board });
let best = loadBest();

// ---------- best score storage ----------

function loadBest() {
  try {
    const value = Number(window.localStorage.getItem(BEST_KEY));
    return Number.isFinite(value) && value > 0 ? value : 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // storage unavailable: best score just won't persist
  }
}

// ---------- rendering ----------

const cellEls = [];
for (let r = 0; r < SIZE; r++) {
  for (let c = 0; c < SIZE; c++) {
    const el = document.createElement('div');
    el.className = 'cell';
    el.dataset.testid = `cell-${r}-${c}`;
    el.dataset.row = String(r);
    el.dataset.col = String(c);
    boardEl.appendChild(el);
    cellEls.push(el);
  }
}

function button(label, testid, onClick, extraClass = '') {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = `btn ${extraClass}`.trim();
  btn.dataset.testid = testid;
  btn.textContent = label;
  btn.addEventListener('click', onClick);
  return btn;
}

function buildMessage(kind, testid, title, buttons) {
  const el = document.createElement('div');
  el.className = `message message--${kind}`;
  el.dataset.testid = testid;
  const h = document.createElement('p');
  h.className = 'message-title';
  h.textContent = title;
  const actions = document.createElement('div');
  actions.className = 'message-actions';
  buttons.forEach((b) => actions.appendChild(b));
  el.append(h, actions);
  return el;
}

function renderMessages() {
  messagesEl.replaceChildren();
  if (state.status === 'won') {
    messagesEl.appendChild(
      buildMessage('win', 'win-message', 'You win!', [
        button('Continue', 'continue-button', onContinue),
        button('New game', 'win-new-game-button', onNewGame),
      ]),
    );
  } else if (state.status === 'over') {
    messagesEl.appendChild(
      buildMessage('over', 'game-over-message', 'Game over', [
        button('New game', 'game-over-new-game-button', onNewGame),
      ]),
    );
  }
}

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

// Each cell clears its own data-merged when its animation ends, so a cell
// that is still animating is never cut short by a later move. Only cells
// that merge again restart (remove, reflow, set).
cellEls.forEach((el) =>
  el.addEventListener('animationend', (event) => {
    if (event.animationName === 'merge-burst') el.removeAttribute('data-merged');
  }),
);

function clearMerges() {
  cellEls.forEach((el) => el.removeAttribute('data-merged'));
}

// Marks the cells created by merges so CSS plays the burst animation.
function animateMerges(merged) {
  if (merged.length === 0 || reducedMotion.matches) return;
  const cells = merged.map(([r, c]) => cellEls[r * SIZE + c]);
  cells.forEach((el) => el.removeAttribute('data-merged'));
  void boardEl.offsetWidth; // flush styles so the animation restarts
  cells.forEach((el) => {
    el.dataset.merged = 'true';
  });
}

function render() {
  state.board.forEach((row, r) =>
    row.forEach((value, c) => {
      const el = cellEls[r * SIZE + c];
      el.dataset.value = String(value);
      el.textContent = value === 0 ? '' : String(value);
    }),
  );

  if (state.score > best) {
    best = state.score;
    saveBest(best);
  }
  scoreEl.textContent = String(state.score);
  bestEl.textContent = String(best);

  renderMessages();

  window.__game = {
    board: state.board.map((row) => row.slice()),
    score: state.score,
    status: state.status,
  };
}

// ---------- input ----------

function onMove(direction) {
  const next = applyMove(state, direction, rng, { spawn: params.spawn });
  if (next === state) return; // blocked or no-op move: leave the board (and any running animation) alone
  state = next;
  render();
  animateMerges(state.merged);
}

function onContinue() {
  state = continueGame(state);
  clearMerges();
  render();
}

function onNewGame() {
  // New game ignores ?board (so the win/over states can be left) but
  // restarts the seeded sequence so a seeded session is reproducible.
  rng = createRng(params.seed);
  state = newGame({ rng });
  clearMerges();
  render();
}

document.addEventListener('keydown', (event) => {
  if (event.ctrlKey || event.metaKey || event.altKey) return;
  const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
  const direction = KEY_TO_DIRECTION[key];
  if (!direction) return;
  event.preventDefault();
  onMove(direction);
});

// ---------- touch / swipe ----------
// Swipes anywhere on the screen control the game. The page itself never
// scrolls: CSS fixes the layout, and iOS Safari also needs touchmove
// cancelled explicitly to stop the rubber-band bounce.

document.addEventListener('touchmove', (event) => event.preventDefault(), { passive: false });

let swipeStart = null;

document.addEventListener('pointerdown', (event) => {
  if (event.pointerType === 'mouse') return;
  swipeStart = { id: event.pointerId, x: event.clientX, y: event.clientY };
});

document.addEventListener('pointerup', (event) => {
  if (!swipeStart || swipeStart.id !== event.pointerId) return;
  const dx = event.clientX - swipeStart.x;
  const dy = event.clientY - swipeStart.y;
  swipeStart = null;
  if (Math.max(Math.abs(dx), Math.abs(dy)) < SWIPE_MIN_PX) return;
  if (Math.abs(dx) > Math.abs(dy)) onMove(dx > 0 ? 'right' : 'left');
  else onMove(dy > 0 ? 'down' : 'up');
});

document.addEventListener('pointercancel', () => {
  swipeStart = null;
});

newGameBtn.addEventListener('click', onNewGame);

render();
