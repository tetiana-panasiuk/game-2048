// UI layer: renders state, handles input, persists best score.
// All game rules live in game.js; URL parsing lives in params.js.

import { SIZE, createRng, newGame, applyMove, continueGame } from './game.js';
import { parseParams } from './params.js';

const BEST_KEY = '2048:best';

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
  state = applyMove(state, direction, rng, { spawn: params.spawn });
  render();
}

function onContinue() {
  state = continueGame(state);
  render();
}

function onNewGame() {
  // New game ignores ?board (so the win/over states can be left) but
  // restarts the seeded sequence so a seeded session is reproducible.
  rng = createRng(params.seed);
  state = newGame({ rng });
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

newGameBtn.addEventListener('click', onNewGame);

render();
