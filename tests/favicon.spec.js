import { test, expect } from '@playwright/test';

// Width and height are stored big-endian at bytes 16-23 of a PNG.
const pngSize = (buf) => ({ w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) });

test.describe('favicon', () => {
  test('index.html declares the svg icon, the 32px png fallback and the apple touch icon', async ({ page }) => {
    await page.goto('/');
    const links = await page.evaluate(() =>
      [...document.querySelectorAll('link[rel~="icon"], link[rel="apple-touch-icon"]')].map((l) => ({
        rel: l.getAttribute('rel'),
        href: l.getAttribute('href'),
        type: l.getAttribute('type'),
        sizes: l.getAttribute('sizes'),
      })),
    );
    expect(links).toContainEqual({ rel: 'icon', href: 'favicon.svg', type: 'image/svg+xml', sizes: null });
    expect(links).toContainEqual({ rel: 'icon', href: 'favicon-32.png', type: 'image/png', sizes: '32x32' });
    expect(links).toContainEqual({ rel: 'apple-touch-icon', href: 'apple-touch-icon.png', type: null, sizes: null });
  });

  test('every icon file is served with the right type and size', async ({ request }) => {
    const svg = await request.get('/favicon.svg');
    expect(svg.status()).toBe(200);
    expect(svg.headers()['content-type']).toContain('image/svg+xml');
    expect(await svg.text()).toContain('viewBox="0 0 32 32"');

    const png32 = await request.get('/favicon-32.png');
    expect(png32.status()).toBe(200);
    expect(png32.headers()['content-type']).toContain('image/png');
    expect(pngSize(await png32.body())).toEqual({ w: 32, h: 32 });

    const touch = await request.get('/apple-touch-icon.png');
    expect(touch.status()).toBe(200);
    expect(touch.headers()['content-type']).toContain('image/png');
    expect(pngSize(await touch.body())).toEqual({ w: 180, h: 180 });
  });

  test('the browser actually loads the icons without errors', async ({ page }) => {
    const failed = [];
    page.on('response', (r) => {
      if (/favicon|apple-touch-icon/.test(r.url()) && !r.ok()) failed.push(`${r.status()} ${r.url()}`);
    });
    await page.goto('/');
    const sizes = await page.evaluate(async () => {
      const load = (href) =>
        new Promise((res) => {
          const i = new Image();
          i.onload = () => res([i.naturalWidth > 0]);
          i.onerror = () => res([false]);
          i.src = href;
        });
      return Promise.all(['favicon.svg', 'favicon-32.png', 'apple-touch-icon.png'].map(async (h) => (await load(h))[0]));
    });
    expect(sizes).toEqual([true, true, true]);
    expect(failed).toEqual([]);
  });
});
