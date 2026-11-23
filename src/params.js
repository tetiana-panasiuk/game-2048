// Pure parser for the testing URL parameters.
//   ?seed=123            deterministic random tiles
//   ?board=2,2,0,0,...   16 values, row-major, each 0 or a power of 2
//   ?spawn=off           no new tiles after moves

import { SIZE } from './game.js?v=5190e68f';

const MAX_TILE = 131072; // 2^17, the theoretical maximum on a 4x4 board

function isTileValue(n) {
  return n === 0 || (n >= 2 && n <= MAX_TILE && (n & (n - 1)) === 0);
}

/** "2,2,0,..." -> 4x4 array, or null if invalid. */
export function parseBoard(text) {
  if (typeof text !== 'string') return null;
  const parts = text.split(',').map((p) => p.trim());
  if (parts.length !== SIZE * SIZE) return null;
  if (!parts.every((p) => /^\d+$/.test(p))) return null;
  const values = parts.map(Number);
  if (!values.every(isTileValue)) return null;
  return Array.from({ length: SIZE }, (_, r) => values.slice(r * SIZE, (r + 1) * SIZE));
}

/**
 * Returns { seed, board, spawn, warnings }.
 * seed: integer | undefined, board: 4x4 array | null, spawn: boolean.
 */
export function parseParams(search = '') {
  const params = new URLSearchParams(search);
  const warnings = [];

  let seed;
  if (params.has('seed')) {
    const raw = params.get('seed').trim();
    if (/^-?\d+$/.test(raw)) {
      seed = Number(raw);
    } else {
      warnings.push(`Ignoring invalid seed "${raw}"`);
    }
  }

  let board = null;
  if (params.has('board')) {
    board = parseBoard(params.get('board'));
    if (!board) {
      warnings.push(
        `Ignoring invalid board "${params.get('board')}" (need 16 comma-separated values, each 0 or a power of 2)`,
      );
    }
  }

  const spawn = params.get('spawn') !== 'off';

  return { seed, board, spawn, warnings };
}
