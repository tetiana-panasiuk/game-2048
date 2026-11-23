import { test } from '@playwright/test';

// Not assertions: captures screenshots into ./screenshots for visual review.
const states = {
  start: '/?seed=7',
  merge: '/?board=2,2,4,8,0,0,16,16,32,0,0,64,0,0,128,128&spawn=off',
  numbers: '/?board=2,4,8,16,32,64,128,256,512,1024,0,2048,4096,8192,16384,131072&spawn=off',
  win: '/?board=1024,1024,0,0,0,0,0,0,0,0,0,0,0,0,0,0&spawn=off',
  popover: '/?board=2,2,4,8,0,0,16,16,32,0,0,64,0,0,128,128&spawn=off',
  over: '/?board=2,4,2,4,4,2,4,2,2,4,2,4,4,2,4,2&spawn=off',
};

const themes = ['', 'lavender', 'mint', 'midnight'];

for (const theme of themes) {
for (const [name, url] of Object.entries(states)) {
  test(`screenshot ${theme || 'default'} ${name}`, async ({ page }, testInfo) => {
    await page.goto(theme ? `${url}&theme=${theme}` : url);
    if (name === 'win') await page.keyboard.press('ArrowLeft');
    if (name === 'popover') await page.getByTestId('theme-button').click();
    if (name === 'numbers') await page.getByTestId('continue-button').click(); // dismiss the win overlay
    await page.waitForTimeout(350); // let the merge burst finish
    await page.screenshot({ path: `screenshots/${theme || 'default'}-${testInfo.project.name}-${name}.png` });
  });
}
}
