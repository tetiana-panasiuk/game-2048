// Pure game logic for 2048. No DOM, no localStorage, no Math.random calls
// (randomness is injected through an `rng` function returning [0, 1)).
// No function in this module mutates its arguments.

export const SIZE = 4;
export const WIN_VALUE = 2048;
export const DIRECTIONS = ['left', 'right', 'up', 'down'];

/**
 * Returns a function producing numbers in [0, 1).
 * With a seed it is deterministic (mulberry32); without one it wraps Math.random.
 */
export function createRng(seed) {
  if (seed === undefined || seed === null) return () => Math.random();
  let a = seed >>> 0;
  return function rng() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function emptyBoard() {
  return Array.from({ length: SIZE }, () => Array(SIZE).fill(0));
}

export function cloneBoard(board) {
  return board.map((row) => row.slice());
}

export function boardsEqual(a, b) {
  return a.every((row, r) => row.every((value, c) => value === b[r][c]));
}

/** Coordinates of all empty cells, row-major. */
export function emptyCells(board) {
  const cells = [];
  board.forEach((row, r) =>
    row.forEach((value, c) => {
      if (value === 0) cells.push([r, c]);
    }),
  );
  return cells;
}

/**
 * Returns a new board with a 2 (90%) or 4 (10%) placed in a random empty cell.
 * Returns the board unchanged (same reference) when it is full.
 */
export function spawnTile(board, rng) {
  const empties = emptyCells(board);
  if (empties.length === 0) return board;
  const [r, c] = empties[Math.floor(rng() * empties.length)];
  const value = rng() < 0.9 ? 2 : 4;
  const next = cloneBoard(board);
  next[r][c] = value;
  return next;
}

/**
 * Slides one row to the left. Each tile merges at most once per move.
 * Returns { row, gained, moved, mergedAt } where mergedAt lists the indexes
 * (in the resulting row) of tiles created by a merge.
 */
export function slideRow(row) {
  const tiles = row.filter((v) => v !== 0);
  const merged = [];
  const mergedAt = [];
  let gained = 0;
  for (let i = 0; i < tiles.length; i++) {
    if (i + 1 < tiles.length && tiles[i] === tiles[i + 1]) {
      const value = tiles[i] * 2;
      merged.push(value);
      mergedAt.push(merged.length - 1);
      gained += value;
      i++; // skip the partner: a tile merges only once
    } else {
      merged.push(tiles[i]);
    }
  }
  while (merged.length < row.length) merged.push(0);
  const moved = merged.some((v, i) => v !== row[i]);
  return { row: merged, gained, moved, mergedAt };
}

function transpose(board) {
  return board[0].map((_, c) => board.map((row) => row[c]));
}

// The slide helpers return { board, gained, merged } where merged is a list
// of [row, col] coordinates of tiles created by a merge.
function slideLeft(board) {
  const results = board.map(slideRow);
  return {
    board: results.map((r) => r.row),
    gained: results.reduce((sum, r) => sum + r.gained, 0),
    merged: results.flatMap((r, row) => r.mergedAt.map((col) => [row, col])),
  };
}

function slideRight(board) {
  const { board: slid, gained, merged } = slideLeft(board.map((row) => row.slice().reverse()));
  return {
    board: slid.map((row) => row.reverse()),
    gained,
    merged: merged.map(([row, col]) => [row, SIZE - 1 - col]),
  };
}

/**
 * Applies a move in the given direction ('left' | 'right' | 'up' | 'down').
 * Returns { board, gained, moved, merged }. `merged` lists the [row, col]
 * of every tile created by a merge. No tile is spawned here.
 */
export function move(board, direction) {
  let result;
  switch (direction) {
    case 'left':
      result = slideLeft(board);
      break;
    case 'right':
      result = slideRight(board);
      break;
    case 'up': {
      const r = slideLeft(transpose(board));
      result = { board: transpose(r.board), gained: r.gained, merged: r.merged.map(([row, col]) => [col, row]) };
      break;
    }
    case 'down': {
      const r = slideRight(transpose(board));
      result = { board: transpose(r.board), gained: r.gained, merged: r.merged.map(([row, col]) => [col, row]) };
      break;
    }
    default:
      throw new Error(`Unknown direction: ${direction}`);
  }
  return { ...result, moved: !boardsEqual(board, result.board) };
}

export function hasTile(board, value) {
  return board.some((row) => row.includes(value));
}

/** True if any move would change the board. */
export function hasMoves(board) {
  if (emptyCells(board).length > 0) return true;
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (c + 1 < SIZE && board[r][c] === board[r][c + 1]) return true;
      if (r + 1 < SIZE && board[r][c] === board[r + 1][c]) return true;
    }
  }
  return false;
}

/**
 * 'won'     – a 2048 tile exists and the player has not chosen to continue
 * 'over'    – no possible moves
 * 'playing' – otherwise
 */
export function getStatus(board, keepPlaying = false) {
  if (!keepPlaying && hasTile(board, WIN_VALUE)) return 'won';
  if (!hasMoves(board)) return 'over';
  return 'playing';
}

/**
 * Creates the initial state.
 * - `board` given: used as-is (no tiles added).
 * - otherwise: empty board with two spawned tiles (always, even if spawn is off).
 */
export function newGame({ rng = createRng(), board = null } = {}) {
  let start;
  if (board) {
    start = cloneBoard(board);
  } else {
    start = spawnTile(spawnTile(emptyBoard(), rng), rng);
  }
  return { board: start, score: 0, status: getStatus(start), keepPlaying: false, merged: [] };
}

/**
 * Plays one turn. Returns the same state object if the move is not allowed
 * (game not in 'playing' status) or doesn't change the board.
 * Otherwise returns a new state with the score updated and, unless
 * `spawn` is false, one new tile. `state.merged` lists the [row, col] of the
 * tiles created by merges in this move (used by the UI for animation).
 */
export function applyMove(state, direction, rng, { spawn = true } = {}) {
  if (state.status !== 'playing') return state;
  const result = move(state.board, direction);
  if (!result.moved) return state;
  const board = spawn ? spawnTile(result.board, rng) : result.board;
  return {
    board,
    score: state.score + result.gained,
    status: getStatus(board, state.keepPlaying),
    keepPlaying: state.keepPlaying,
    merged: result.merged,
  };
}

/** Dismisses the win message and lets the player keep going. */
export function continueGame(state) {
  if (state.status !== 'won') return state;
  return { ...state, keepPlaying: true, status: getStatus(state.board, true), merged: [] };
}
