import { test, expect } from '@playwright/test';

const isMobile = (testInfo) => testInfo.project.name.startsWith('iphone');

const THEMES = ['', 'lavender', 'mint', 'midnight'];
const TILE_VALUES = [2, 4, 8, 16, 32, 64, 128, 256, 512, 1024, 2048, 4096, 8192, 16384, 32768, 65536, 131072];

function luminance([r, g, b]) {
  const c = [r, g, b].map((v) => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}
const rgb = (s) => s.match(/\d+(\.\d+)?/g).slice(0, 3).map(Number);

async function swipe(page, from, to) {
  // Synthetic touch pointer events on the document: exercises the swipe handler
  // (real finger gestures can't be produced the same way in WebKit).
  await page.evaluate(([a, b]) => {
    const fire = (type, p) =>
      document.dispatchEvent(
        new PointerEvent(type, { pointerType: 'touch', pointerId: 7, clientX: p.x, clientY: p.y, bubbles: true }),
      );
    fire('pointerdown', a);
    fire('pointerup', b);
  }, [from, to]);
}

test.describe('required hooks still work', () => {
  test('data-testid attributes are present', async ({ page }) => {
    await page.goto('/');
    for (const id of ['board', 'score', 'best-score', 'new-game-button', 'cell-0-0', 'cell-3-3']) {
      await expect(page.getByTestId(id)).toBeVisible();
    }
    await expect(page.locator('[data-testid^="cell-"]')).toHaveCount(16);
  });

  test('?board and ?spawn=off still work', async ({ page }) => {
    await page.goto('/?board=2,2,4,4,0,0,0,0,0,0,0,0,0,0,0,0&spawn=off');
    expect(await page.evaluate(() => window.__game.board[0])).toEqual([2, 2, 4, 4]);
    await page.keyboard.press('ArrowLeft');
    expect(await page.evaluate(() => window.__game.board[0])).toEqual([4, 8, 0, 0]);
    expect(await page.evaluate(() => window.__game.board.flat().filter(Boolean).length)).toBe(2);
  });

  test('?seed is deterministic', async ({ page }) => {
    await page.goto('/?seed=42');
    const a = await page.evaluate(() => JSON.stringify(window.__game.board));
    await page.reload();
    expect(await page.evaluate(() => JSON.stringify(window.__game.board))).toBe(a);
  });
});

test.describe('page is fixed', () => {
  test('nothing scrolls and nothing overflows', async ({ page }) => {
    await page.goto('/');
    const m = await page.evaluate(() => {
      window.scrollTo(0, 200);
      document.scrollingElement.scrollTop = 200;
      const de = document.documentElement;
      return {
        scrollY: window.scrollY,
        scrollTop: document.scrollingElement.scrollTop,
        overflowY: de.scrollHeight - de.clientHeight,
        overflowX: de.scrollWidth - de.clientWidth,
        bodyPos: getComputedStyle(document.body).position,
      };
    });
    expect(m.scrollY).toBe(0);
    expect(m.scrollTop).toBe(0);
    expect(m.overflowY).toBeLessThanOrEqual(0);
    expect(m.overflowX).toBeLessThanOrEqual(0);
    expect(m.bodyPos).toBe('fixed');
  });

  test('touchmove is cancelled so Safari cannot bounce', async ({ page }) => {
    await page.goto('/');
    const prevented = await page.evaluate(() => {
      const e = new Event('touchmove', { bubbles: true, cancelable: true });
      document.body.dispatchEvent(e);
      return e.defaultPrevented;
    });
    expect(prevented).toBe(true);
  });

  test('layout is centered in the viewport', async ({ page }) => {
    await page.goto('/');
    const { box, vw, vh, top, bottom } = await page.evaluate(() => {
      const r = document.querySelector('[data-testid="board"]').getBoundingClientRect();
      const h = document.querySelector('.header').getBoundingClientRect();
      return { box: r, vw: innerWidth, vh: innerHeight, top: h.top, bottom: r.bottom };
    });
    // horizontal: board centered
    expect(Math.abs(box.x + box.width / 2 - vw / 2)).toBeLessThan(1.5);
    // vertical: gap above header ≈ gap below board
    expect(Math.abs(top - (vh - bottom))).toBeLessThan(2);
    expect(top).toBeGreaterThanOrEqual(0);
    expect(bottom).toBeLessThanOrEqual(vh);
  });
});

test.describe('hint text', () => {
  test('matches the input type', async ({ page }, testInfo) => {
    await page.goto('/');
    const touch = page.getByText('Swipe to join the tiles.');
    const desktop = page.getByText('Use arrow keys or WASD to join the tiles.');
    if (isMobile(testInfo)) {
      await expect(touch).toBeVisible();
      await expect(desktop).toBeHidden();
    } else {
      await expect(desktop).toBeVisible();
      await expect(touch).toBeHidden();
    }
  });
});

test.describe('design', () => {
  test('board and tiles are rounded, including empty cells', async ({ page }) => {
    await page.goto('/?board=2,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0&spawn=off');
    const r = await page.evaluate(() => ({
      board: parseFloat(getComputedStyle(document.querySelector('[data-testid="board"]')).borderTopLeftRadius),
      tile: parseFloat(getComputedStyle(document.querySelector('[data-testid="cell-0-0"]')).borderTopLeftRadius),
      empty: parseFloat(getComputedStyle(document.querySelector('[data-testid="cell-1-1"]')).borderTopLeftRadius),
    }));
    expect(r).toEqual({ board: 16, tile: 10, empty: 10 });
  });

  for (const theme of THEMES) {
    test(`every tile value passes WCAG AA and the palette is cool (${theme || 'default'})`, async ({ page }) => {
      for (const v of TILE_VALUES) {
        await page.goto(`/?board=${v},0,0,0,0,0,0,0,0,0,0,0,0,0,0,0&spawn=off${theme ? `&theme=${theme}` : ''}`);
        const { bg, fg } = await page.evaluate(() => {
          const s = getComputedStyle(document.querySelector('[data-testid="cell-0-0"]'));
          return { bg: s.backgroundColor, fg: s.color };
        });
        expect(contrast(rgb(bg), rgb(fg)), `tile ${v} ${bg} / ${fg}`).toBeGreaterThanOrEqual(4.5);
        const [r, , b] = rgb(bg);
        expect(b, `tile ${v} should not be warm (${bg})`).toBeGreaterThanOrEqual(r - 10);
      }
    });

    test(`text, buttons and score boxes pass WCAG AA (${theme || 'default'})`, async ({ page }) => {
      await page.goto(`/?seed=1${theme ? `&theme=${theme}` : ''}`);
      const c = await page.evaluate(() => {
        const st = (el) => getComputedStyle(el);
        const pageBg = st(document.body).backgroundColor;
        return {
          title: [st(document.querySelector('h1')).color, pageBg],
          hint: [st(document.querySelector('.hint')).color, pageBg],
          button: [st(document.querySelector('[data-testid="new-game-button"]')).color, st(document.querySelector('[data-testid="new-game-button"]')).backgroundColor],
          score: [st(document.querySelector('[data-testid="score"]')).color, st(document.querySelector('.score-box')).backgroundColor],
          label: [st(document.querySelector('.score-label')).color, st(document.querySelector('.score-box')).backgroundColor],
        };
      });
      for (const [name, [fg, bg]] of Object.entries(c)) {
        expect(contrast(rgb(fg), rgb(bg)), `${name}: ${fg} on ${bg}`).toBeGreaterThanOrEqual(4.5);
      }
    });
  }

  for (const theme of THEMES) {
    test(`tile colours are all different (${theme || 'default'})`, async ({ page }) => {
      const seen = new Map();
      for (const v of TILE_VALUES.slice(0, 11)) {
        await page.goto(`/?board=${v},0,0,0,0,0,0,0,0,0,0,0,0,0,0,0&spawn=off${theme ? `&theme=${theme}` : ''}`);
        const bg = await page.evaluate(() => getComputedStyle(document.querySelector('[data-testid="cell-0-0"]')).backgroundColor);
        expect(seen.has(bg), `${v} has the same colour as ${seen.get(bg)}`).toBe(false);
        seen.set(bg, v);
      }
    });
  }
});

test.describe('swipes anywhere on the screen', () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(!isMobile(testInfo), 'touch only');
  });

  test('swipe outside the board moves tiles', async ({ page }) => {
    await page.goto('/?board=2,2,0,0,0,0,0,0,0,0,0,0,0,0,0,0&spawn=off');
    const vw = page.viewportSize().width;
    // start in the top-left corner, far from the board
    await swipe(page, { x: vw - 10, y: 10 }, { x: 10, y: 14 });
    expect(await page.evaluate(() => window.__game.board[0])).toEqual([4, 0, 0, 0]);
    await swipe(page, { x: 10, y: 10 }, { x: vw - 10, y: 12 });
    expect(await page.evaluate(() => window.__game.board[0])).toEqual([0, 0, 0, 4]);
    await swipe(page, { x: 20, y: 10 }, { x: 22, y: 150 });
    expect(await page.evaluate(() => window.__game.board[3])).toEqual([0, 0, 0, 4]);
    await swipe(page, { x: 20, y: 150 }, { x: 22, y: 10 });
    expect(await page.evaluate(() => window.__game.board[0])).toEqual([0, 0, 0, 4]);
  });

  test('short tap does not move tiles', async ({ page }) => {
    await page.goto('/?board=2,2,0,0,0,0,0,0,0,0,0,0,0,0,0,0&spawn=off');
    await swipe(page, { x: 100, y: 100 }, { x: 104, y: 102 });
    expect(await page.evaluate(() => window.__game.board[0])).toEqual([2, 2, 0, 0]);
  });

  test('New game button still works by tap', async ({ page }) => {
    await page.goto('/?board=2,2,0,0,0,0,0,0,0,0,0,0,0,0,0,0&spawn=off');
    await page.getByTestId('new-game-button').tap();
    expect(await page.evaluate(() => window.__game.board.flat().filter(Boolean).length)).toBe(2);
  });
});

test.describe('desktop keyboard', () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(isMobile(testInfo), 'desktop only');
  });
  test('arrows and WASD move tiles', async ({ page }) => {
    await page.goto('/?board=2,2,0,0,0,0,0,0,0,0,0,0,0,0,0,0&spawn=off');
    await page.keyboard.press('d');
    expect(await page.evaluate(() => window.__game.board[0])).toEqual([0, 0, 0, 4]);
    await page.keyboard.press('ArrowDown');
    expect(await page.evaluate(() => window.__game.board[3])).toEqual([0, 0, 0, 4]);
  });
});

test.describe('colour theme picker (palette button + popover)', () => {
  const bodyBg = (page) => page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  const NAMES = ['ocean', 'lavender', 'mint', 'midnight'];
  const open = async (page) => {
    await page.getByTestId('theme-button').click();
    await expect(page.getByTestId('theme-popover')).toBeVisible();
  };
  const board = (page) => page.evaluate(() => JSON.stringify(window.__game.board));

  test('there is no swatch row under the board any more', async ({ page }) => {
    await page.goto('/');
    expect(await page.locator('.themes').count()).toBe(0);
    await expect(page.getByTestId('theme-popover')).toBeHidden();
  });

  test('icon button sits next to New game with the same height', async ({ page }) => {
    await page.goto('/');
    const r = await page.evaluate(() => {
      const q = (id) => document.querySelector(`[data-testid="${id}"]`).getBoundingClientRect();
      const a = q('theme-button'), b = q('new-game-button');
      return { ah: a.height, bh: b.height, aRight: a.right, bLeft: b.left, aTop: a.top, bTop: b.top, text: document.querySelector('[data-testid="theme-button"]').textContent.trim() };
    });
    expect(r.ah).toBeCloseTo(r.bh, 0);
    expect(r.aTop).toBeCloseTo(r.bTop, 0);
    expect(r.aRight).toBeLessThanOrEqual(r.bLeft);
    expect(r.text).toBe(''); // icon only
  });

  test('opens on click with four options, ocean active', async ({ page }) => {
    await page.goto('/');
    const btn = page.getByTestId('theme-button');
    await expect(btn).toHaveAttribute('aria-expanded', 'false');
    await open(page);
    await expect(btn).toHaveAttribute('aria-expanded', 'true');
    for (const n of NAMES) await expect(page.getByTestId(`theme-option-${n}`)).toBeVisible();
    await expect(page.getByTestId('theme-option-ocean')).toHaveAttribute('aria-checked', 'true');
  });

  test('options are 20px circles with a tap area of at least 36px, inside the screen', async ({ page }) => {
    await page.goto('/');
    await open(page);
    const r = await page.evaluate(() => {
      const o = document.querySelector('[data-testid="theme-option-mint"]');
      const b = o.getBoundingClientRect();
      const dot = getComputedStyle(o, '::before');
      const p = document.querySelector('[data-testid="theme-popover"]').getBoundingClientRect();
      return { w: b.width, h: b.height, dotInset: parseFloat(dot.top), left: p.left, right: p.right, vw: innerWidth };
    });
    expect(r.w).toBeGreaterThanOrEqual(36);
    expect(r.h).toBeGreaterThanOrEqual(36);
    expect(r.w - 2 * r.dotInset).toBe(20); // visible circle
    expect(r.left).toBeGreaterThanOrEqual(0);
    expect(r.right).toBeLessThanOrEqual(r.vw);
  });

  test('choosing a theme applies it, closes the popover and marks the active one', async ({ page }) => {
    await page.goto('/');
    const ocean = await bodyBg(page);
    for (const t of ['lavender', 'mint', 'midnight']) {
      await open(page);
      await page.getByTestId(`theme-option-${t}`).click();
      await expect(page.getByTestId('theme-popover')).toBeHidden();
      await expect(page.locator('html')).toHaveAttribute('data-theme', t);
      expect(await bodyBg(page)).not.toBe(ocean);
      await open(page);
      await expect(page.getByTestId(`theme-option-${t}`)).toHaveAttribute('aria-checked', 'true');
      await expect(page.getByTestId('theme-option-ocean')).toHaveAttribute('aria-checked', 'false');
      await page.keyboard.press('Escape');
    }
    await open(page);
    await page.getByTestId('theme-option-ocean').click();
    await expect(page.locator('html')).not.toHaveAttribute('data-theme', /.+/);
    expect(await bodyBg(page)).toBe(ocean);
  });

  test('choice is remembered after reload', async ({ page }) => {
    await page.goto('/');
    await open(page);
    await page.getByTestId('theme-option-midnight').click();
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'midnight');
    await open(page);
    await expect(page.getByTestId('theme-option-midnight')).toHaveAttribute('aria-checked', 'true');
  });

  test('?theme= overrides the saved choice; unknown names fall back to it', async ({ page }) => {
    await page.goto('/');
    await open(page);
    await page.getByTestId('theme-option-midnight').click();
    await page.goto('/?theme=mint');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'mint');
    await page.goto('/?theme=ocean');
    await expect(page.locator('html')).not.toHaveAttribute('data-theme', /.+/);
    await page.goto('/?theme=hotpink');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'midnight');
  });

  test('closes on Escape, on the icon again, and on a click outside', async ({ page }) => {
    await page.goto('/');
    const pop = page.getByTestId('theme-popover');
    await open(page);
    await page.keyboard.press('Escape');
    await expect(pop).toBeHidden();
    await expect(page.getByTestId('theme-button')).toBeFocused();
    await open(page);
    await page.getByTestId('theme-button').click();
    await expect(pop).toBeHidden();
    await open(page);
    await page.mouse.click(5, 5);
    await expect(pop).toBeHidden();
    await expect(page.locator('html')).not.toHaveAttribute('data-theme', /.+/); // nothing was chosen
  });

  test('clicks inside the popover (not on an option) keep it open', async ({ page }) => {
    await page.goto('/');
    await open(page);
    const box = await page.getByTestId('theme-popover').boundingBox();
    await page.mouse.click(box.x + box.width / 2, box.y + 3); // padding strip above the options
    await expect(page.getByTestId('theme-popover')).toBeVisible();
  });

  test('picking a theme does not touch the game', async ({ page }) => {
    await page.goto('/?board=2,2,0,0,0,0,0,0,0,0,0,0,0,0,0,0&spawn=off');
    await open(page);
    await page.getByTestId('theme-option-lavender').click();
    expect(await page.evaluate(() => window.__game.board[0])).toEqual([2, 2, 0, 0]);
    expect(await page.evaluate(() => window.__game.score)).toBe(0);
  });

  test('game keys do nothing while the popover is open, and work again after', async ({ page }, testInfo) => {
    test.skip(isMobile(testInfo), 'keyboard');
    await page.goto('/?board=2,2,0,0,0,0,0,0,0,0,0,0,0,0,0,0&spawn=off');
    const start = await board(page);
    await open(page);
    for (const k of ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'a', 'd', 'w', 's']) await page.keyboard.press(k);
    await expect(page.getByTestId('theme-popover')).toBeVisible();
    expect(await board(page)).toBe(start);
    await page.keyboard.press('Escape');
    await page.keyboard.press('ArrowLeft');
    expect(await page.evaluate(() => window.__game.board[0])).toEqual([4, 0, 0, 0]);
  });

  test('arrow keys move focus between options and Enter selects', async ({ page }, testInfo) => {
    test.skip(isMobile(testInfo), 'keyboard');
    await page.goto('/');
    await open(page);
    await expect(page.getByTestId('theme-option-ocean')).toBeFocused();
    await page.keyboard.press('ArrowRight');
    await expect(page.getByTestId('theme-option-lavender')).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('theme-popover')).toBeHidden();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'lavender');
  });

  test('swipes do not move tiles while the popover is open; the first outside swipe only closes it', async ({ page }, testInfo) => {
    test.skip(!isMobile(testInfo), 'touch');
    await page.goto('/?board=2,2,0,0,0,0,0,0,0,0,0,0,0,0,0,0&spawn=off');
    const vw = page.viewportSize().width;
    await open(page);
    // swipe starts outside the popover
    await swipe(page, { x: vw - 10, y: 400 }, { x: 10, y: 405 });
    await expect(page.getByTestId('theme-popover')).toBeHidden();
    expect(await page.evaluate(() => window.__game.board[0])).toEqual([2, 2, 0, 0]);
    // popover closed: the next swipe moves tiles again
    await swipe(page, { x: vw - 10, y: 400 }, { x: 10, y: 405 });
    expect(await page.evaluate(() => window.__game.board[0])).toEqual([4, 0, 0, 0]);
  });

  test('tapping the icon and an option works by touch', async ({ page }, testInfo) => {
    test.skip(!isMobile(testInfo), 'touch');
    await page.goto('/');
    await page.getByTestId('theme-button').tap();
    await expect(page.getByTestId('theme-popover')).toBeVisible();
    await page.getByTestId('theme-option-mint').tap();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'mint');
    await expect(page.getByTestId('theme-popover')).toBeHidden();
  });

  for (const theme of THEMES) {
    test(`icon is muted but visible: contrast >= 3:1 (${theme || 'default'})`, async ({ page }) => {
      await page.goto(`/?seed=1${theme ? `&theme=${theme}` : ''}`);
      const [fg, bg] = await page.evaluate(() => {
        const s = getComputedStyle(document.querySelector('[data-testid="theme-button"]'));
        return [s.color, s.backgroundColor];
      });
      expect(contrast(rgb(fg), rgb(bg))).toBeGreaterThanOrEqual(3);
    });
  }
});
