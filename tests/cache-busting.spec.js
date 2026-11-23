import { test, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';

test('cache-busting version is up to date (run `npm run bump` if this fails)', () => {
  expect(() => execFileSync('node', ['scripts/bump-version.mjs', '--check'], { stdio: 'pipe' })).not.toThrow();
});

test('assets are requested with ?v= and the game still loads', async ({ page }) => {
  const urls = [];
  page.on('request', (r) => urls.push(r.url()));
  await page.goto('/?board=2,2,0,0,0,0,0,0,0,0,0,0,0,0,0,0&spawn=off');
  await expect(page.getByTestId('board')).toBeVisible();
  for (const name of ['styles.css', 'src/ui.js', 'src/game.js', 'src/params.js']) {
    expect(urls.some((u) => u.includes(`${name}?v=`)), `${name} should carry ?v=`).toBe(true);
  }
  expect(await page.evaluate(() => window.__game.board[0])).toEqual([2, 2, 0, 0]);
});
