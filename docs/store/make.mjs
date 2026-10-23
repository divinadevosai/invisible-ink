// Renders slides.html to the store images: three 1280×800 screenshots and the 440×280 promo tile.
// node docs/store/capture.mjs first (real screenshots in raw/), then node docs/store/make.mjs
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const { chromium } = await import(process.env.PLAYWRIGHT ?? 'playwright');
const here = dirname(fileURLToPath(import.meta.url));
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
await page.goto(`file://${join(here, 'slides.html')}`);
await page.evaluate(() => document.fonts.ready);
for (const [id, name] of [
  ['s1', '1-uv-lamp-1280x800.png'],
  ['s2', '2-decoded-1280x800.png'],
  ['s3', '3-private-1280x800.png'],
  ['tile', 'promo-440x280.png'],
]) await page.locator(`#${id}`).screenshot({ path: join(here, name) });
await browser.close();
console.log('store images written');
